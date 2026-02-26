const express = require('express');
const multer = require('multer');
const path = require('path');
const cookieSession = require('cookie-session');
const config = require('./src/config');
const ai = require('./src/ai');
const webhookRouter = require('./src/webhook');
const { requireAuth, requireOwner, handleGoogleLogin, isOwner } = require('./src/auth');
const { tenants, fbConfig, settings, documents, whitelist } = require('./src/database');
const knowledgeBase = require('./src/knowledgeBase');
const tenantManager = require('./src/tenantManager');
const messenger = require('./src/messenger');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_FILE_SIZE } });

// ─── Middleware ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
    name: 'ai4all_session',
    keys: [config.SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
}));

// Static files (serve from root so landing.css, dashboard.js, etc. work)
app.use(express.static(path.join(__dirname, 'public')));

// ─── Webhook (no auth) ───
app.use('/webhook', webhookRouter);

// ─── Auth Routes ───
app.post('/api/auth/google', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

        const { tenant } = await handleGoogleLogin(idToken);
        req.session.tenantId = tenant.id;

        res.json({
            tenant: {
                id: tenant.id,
                email: tenant.email,
                name: tenant.name,
                plan: tenant.plan,
            },
            isOwner: isOwner(tenant.email),
            redirect: isOwner(tenant.email) ? '/owner.html' : '/dashboard.html',
        });
    } catch (error) {
        console.error('❌ Auth error:', error.message);
        res.status(401).json({ error: error.message });
    }
});

// Dev-mode login (only when Google OAuth not configured)
app.post('/api/auth/dev-login', (req, res) => {
    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_ID !== 'your_google_client_id_here') {
        return res.status(403).json({ error: 'Dev login disabled in production' });
    }

    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    let tenant = tenants.getByEmail(email);
    if (!tenant) {
        tenant = tenants.create(email, name || email.split('@')[0]);
        console.log(`🆕 [DEV] New tenant created: ${email} (${tenant.plan})`);
    }

    req.session.tenantId = tenant.id;
    res.json({
        tenant: { id: tenant.id, email: tenant.email, name: tenant.name, plan: tenant.plan },
        isOwner: isOwner(tenant.email),
        redirect: isOwner(tenant.email) ? '/owner.html' : '/dashboard.html',
    });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({
        tenant: {
            id: req.tenant.id,
            email: req.tenant.email,
            name: req.tenant.name,
            plan: req.tenant.plan,
            status: req.tenant.status,
        },
        isOwner: isOwner(req.tenant.email),
    });
});

app.post('/api/auth/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
});

// ─── Tenant Dashboard API ───
app.get('/api/dashboard', requireAuth, (req, res) => {
    const tenant = req.tenant;
    const stats = knowledgeBase.getStats(tenant.id);
    const fb = fbConfig.get(tenant.id);
    const tenantSettings = settings.get(tenant.id);

    res.json({
        tenant: {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            plan: tenant.plan,
            token_limit: tenant.token_limit,
            tokens_used: tenant.tokens_used,
        },
        knowledgeBase: stats,
        fbConnected: !!fb?.page_id,
        fbPageName: fb?.page_name || null,
        settings: tenantSettings,
    });
});

// ─── Documents API (tenant-scoped) ───
app.get('/api/documents', requireAuth, (req, res) => {
    const docs = knowledgeBase.listDocuments(req.tenant.id);
    res.json(docs);
});

app.post('/api/documents', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const instance = tenantManager.getTenantInstance(req.tenant.id);
        const result = await knowledgeBase.addDocument(req.tenant.id, req.file, instance.vectorStore);
        res.json(result);
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
    const doc = documents.getById(req.params.id);
    if (!doc || doc.tenant_id !== req.tenant.id) {
        return res.status(404).json({ error: 'Document not found' });
    }

    const instance = tenantManager.getTenantInstance(req.tenant.id);
    knowledgeBase.removeDocument(req.params.id, instance.vectorStore);
    res.json({ ok: true });
});

// ─── Chat API (tenant-scoped) ───
app.post('/api/chat', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Missing message' });

        const reply = await tenantManager.generateResponseForTenant(req.tenant.id, message);
        res.json({ reply });
    } catch (error) {
        console.error('❌ Chat error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── Settings API (tenant-scoped) ───
app.get('/api/settings', requireAuth, (req, res) => {
    const tenantSettings = settings.get(req.tenant.id);
    const fb = fbConfig.get(req.tenant.id);
    res.json({ settings: tenantSettings, fb });
});

app.put('/api/settings', requireAuth, (req, res) => {
    try {
        const current = settings.get(req.tenant.id);
        const { system_prompt, ai_model, bot_name } = req.body;
        settings.update(req.tenant.id, {
            system_prompt: system_prompt || current.system_prompt,
            ai_model: ai_model || current.ai_model || config.DEFAULT_AI_MODEL,
            bot_name: bot_name || current.bot_name || config.DEFAULT_BOT_NAME,
        });
        tenantManager.clearTenantInstance(req.tenant.id);
        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Settings update error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── FB Config API (tenant-scoped) ───
app.post('/api/fb-config', requireAuth, async (req, res) => {
    try {
        const { page_access_token, page_id } = req.body;
        if (!page_access_token) return res.status(400).json({ error: 'Missing page_access_token' });

        let finalPageId = page_id;
        let finalPageName = 'User Provided Page';

        try {
            // Auto-detect page_id and page_name
            const pageInfo = await messenger.getPageInfo(page_access_token);
            finalPageId = pageInfo.id;
            finalPageName = pageInfo.name;
        } catch (error) {
            console.log(`⚠️ Auto-detect failed: ${error.message}`);
            if (!finalPageId) {
                return res.status(400).json({
                    error: `Lỗi API (thiếu quyền): ${error.message}. Vui lòng nhập thêm Page ID thủ công ở ô bên trên.`
                });
            }
            console.log(`✅ Using manual page_id: ${finalPageId}`);
        }

        fbConfig.upsert(req.tenant.id, {
            page_access_token,
            page_id: finalPageId,
            page_name: finalPageName,
        });

        console.log(`✅ [${req.tenant.email}] FB Page connected: ${finalPageName} (${finalPageId})`);
        res.json({ page_id: finalPageId, page_name: finalPageName });
    } catch (error) {
        console.error('❌ FB config error:', error.message);
        res.status(400).json({ error: error.message || 'Invalid token or could not connect to FB Page' });
    }
});

app.delete('/api/fb-config', requireAuth, (req, res) => {
    fbConfig.upsert(req.tenant.id, { page_access_token: null, page_id: null, page_name: null });
    res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// OWNER ADMIN API
// ═══════════════════════════════════════════════════

app.get('/api/owner/stats', requireOwner, (req, res) => {
    const stats = tenants.getStats();
    const allTenants = tenants.getAll();
    const totalMessages = allTenants.reduce((sum, t) => sum + t.tokens_used, 0);
    res.json({ ...stats, totalMessages });
});

app.get('/api/owner/tenants', requireOwner, (req, res) => {
    const allTenants = tenants.getAll();
    const enriched = allTenants.map(t => {
        const fb = fbConfig.get(t.id);
        const docStats = knowledgeBase.getStats(t.id);
        return {
            ...t,
            fbConnected: !!fb?.page_id,
            fbPageName: fb?.page_name,
            documentsCount: docStats.totalDocuments,
        };
    });
    res.json(enriched);
});

app.put('/api/owner/tenants/:id', requireOwner, (req, res) => {
    const { status, plan, token_limit } = req.body;
    tenants.update(req.params.id, { status, plan, token_limit });
    res.json({ ok: true });
});

// ─── Whitelist API ───
app.get('/api/owner/whitelist', requireOwner, (req, res) => {
    res.json(whitelist.getAll());
});

app.post('/api/owner/whitelist', requireOwner, (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const added = whitelist.add(email, req.tenant.email);
    if (!added) return res.status(409).json({ error: 'Email already in whitelist' });

    res.json({ ok: true });
});

app.delete('/api/owner/whitelist/:email', requireOwner, (req, res) => {
    if (req.params.email === config.OWNER_EMAIL) {
        return res.status(400).json({ error: 'Cannot remove owner email' });
    }
    whitelist.remove(req.params.email);
    res.json({ ok: true });
});

// ─── Page Routes ───
app.get('/', (req, res) => {
    const fs = require('fs');
    const html = fs.readFileSync(path.join(__dirname, 'public', 'landing.html'), 'utf8')
        .replace(/%GOOGLE_CLIENT_ID%/g, config.GOOGLE_CLIENT_ID || '');
    res.type('html').send(html);
});
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/owner.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'owner.html')));

// ─── Start Server ───
ai.initAI();

app.listen(config.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🏨 AI4All Platform Started         ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  🌐 http://localhost:${config.PORT}               ║`);
    console.log(`║  👑 Owner: ${config.OWNER_EMAIL}     ║`);
    console.log(`║  📡 Webhook: /webhook                    ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
