const express = require('express');
const multer = require('multer');
const path = require('path');
const cookieSession = require('cookie-session');
const config = require('./src/config');
const ai = require('./src/ai');
const webhookRouter = require('./src/webhook');
const { requireAuth, requireOwner, requireOwnerRedirect, handleGoogleLogin, isOwner } = require('./src/auth');
const { tenants, fbConfig, settings, documents, folders, whitelist, conversations, messages, notifications, orders, platformSettings, plansMgr } = require('./src/database');
const knowledgeBase = require('./src/knowledgeBase');
const tenantManager = require('./src/tenantManager');
const messenger = require('./src/messenger');
const conversationModule = require('./src/conversation');
const payment = require('./src/payment');
const vertexRag = require('./src/vertexRag');
const googleDrive = require('./src/googleDrive');

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
            corpus_name: req.tenant.corpus_name,
            _googleClientId: config.GOOGLE_CLIENT_ID,
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

    const fs = require('fs');
    const logMsg = `[${new Date().toISOString()}] Dashboard hit: ${tenant.email}, corpus: ${tenant.corpus_name}\n`;
    fs.appendFileSync('DEBUG.LOG', logMsg);

    res.json({
        tenant: {
            id: tenant.id,
            name: tenant.name,
            email: tenant.email,
            plan: tenant.plan,
            token_limit: tenant.token_limit,
            tokens_used: tenant.tokens_used,
            corpus_name: tenant.corpus_name,
        },
        knowledgeBase: stats,
        fbConnected: !!fb?.page_id,
        fbPageName: fb?.page_name || null,
        settings: tenantSettings,
    });
});

// ─── Documents API (tenant-scoped) ───
app.get('/api/documents', requireAuth, (req, res) => {
    const folderId = req.query.folder_id;
    let docs;
    if (folderId === 'root') {
        docs = knowledgeBase.listDocuments(req.tenant.id, null);
    } else if (folderId) {
        docs = knowledgeBase.listDocuments(req.tenant.id, folderId);
    } else {
        docs = knowledgeBase.listDocuments(req.tenant.id);
    }
    res.json(docs);
});

app.post('/api/documents', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const instance = tenantManager.getTenantInstance(req.tenant.id);

        // 1. Ensure Corpus exists for this tenant
        let corpusName = instance.corpusName;
        if (!corpusName) {
            console.log(`🏗️ Creating new RAG Corpus for tenant ${req.tenant.id}...`);
            corpusName = await vertexRag.createCorpus(`corpus-${req.tenant.id}`);

            // Persist to DB
            tenants.update(req.tenant.id, { corpus_name: corpusName });

            // Refresh instance cache
            instance.corpusName = corpusName;
        }

        // 2. Add document via Vertex AI
        const folderId = req.body?.folder_id || null;
        const result = await knowledgeBase.addDocument(req.tenant.id, req.file, corpusName, folderId);
        res.json(result);
    } catch (error) {
        console.error('❌ Upload error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
    try {
        const doc = documents.getById(req.params.id);
        if (!doc || doc.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Document not found' });
        }

        await knowledgeBase.removeDocument(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Delete error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/documents/:id/view', requireAuth, (req, res) => {
    try {
        const doc = documents.getById(req.params.id);
        if (!doc || doc.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const fs = require('fs');
        if (!fs.existsSync(doc.path)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        res.sendFile(doc.path);
    } catch (error) {
        console.error('❌ View error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/documents/:id/download', requireAuth, (req, res) => {
    try {
        const doc = documents.getById(req.params.id);
        if (!doc || doc.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const fs = require('fs');
        if (!fs.existsSync(doc.path)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        res.download(doc.path, doc.filename);
    } catch (error) {
        console.error('❌ Download error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── Folders API (tenant-scoped) ───
app.get('/api/folders', requireAuth, (req, res) => {
    const parentId = req.query.parent_id || null;
    const folderList = folders.getByTenant(req.tenant.id, parentId);
    res.json(folderList);
});

app.post('/api/folders', requireAuth, (req, res) => {
    try {
        const { name, parent_id } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Missing folder name' });
        const folder = folders.create(req.tenant.id, name.trim(), parent_id || null);
        res.json(folder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/folders/:id', requireAuth, (req, res) => {
    try {
        const folder = folders.getById(req.params.id);
        if (!folder || folder.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Missing folder name' });
        folders.rename(req.params.id, name.trim());
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/folders/:id', requireAuth, (req, res) => {
    try {
        const folder = folders.getById(req.params.id);
        if (!folder || folder.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Folder not found' });
        }
        folders.delete(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Document Move API ───
app.put('/api/documents/:id/move', requireAuth, (req, res) => {
    try {
        const doc = documents.getById(req.params.id);
        if (!doc || doc.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const { folder_id } = req.body;
        documents.moveToFolder(req.params.id, folder_id || null);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Google Drive Import API ───
app.post('/api/documents/import-gdrive', requireAuth, async (req, res) => {
    try {
        const { fileIds, accessToken, folder_id } = req.body;
        if (!fileIds || !fileIds.length || !accessToken) {
            return res.status(400).json({ error: 'Missing fileIds or accessToken' });
        }

        const tenantData = tenants.getById(req.tenant.id);
        let corpusName = tenantData.corpus_name;
        if (!corpusName) {
            corpusName = await vertexRag.createCorpus(`corpus-${req.tenant.id}`);
            tenants.update(req.tenant.id, { corpus_name: corpusName });
            const instance = tenantManager.getTenantInstance(req.tenant.id);
            if (instance) instance.corpusName = corpusName;
        }

        const results = [];
        for (const fileId of fileIds) {
            try {
                console.log(`📥 [GDrive] Downloading file ${fileId}...`);
                const fileData = await googleDrive.downloadFile(fileId, accessToken);

                const fakeFile = {
                    originalname: fileData.filename,
                    buffer: fileData.buffer,
                    size: fileData.size,
                };
                let result;
                try {
                    result = await knowledgeBase.addDocument(
                        req.tenant.id, fakeFile, corpusName, folder_id || null, 'gdrive'
                    );
                } catch (addErr) {
                    if (addErr.message && addErr.message.includes('NOT_FOUND') && addErr.message.includes('RagCorpus')) {
                        console.log(`[GDrive] Corpus not found. Recreating corpus for tenant ${req.tenant.id}...`);
                        corpusName = await vertexRag.createCorpus(`corpus-${req.tenant.id}`);
                        tenants.update(req.tenant.id, { corpus_name: corpusName });
                        const instance = tenantManager.getTenantInstance(req.tenant.id);
                        if (instance) instance.corpusName = corpusName;

                        result = await knowledgeBase.addDocument(
                            req.tenant.id, fakeFile, corpusName, folder_id || null, 'gdrive'
                        );
                    } else {
                        throw addErr;
                    }
                }
                results.push({ fileId, ...result, status: 'ok' });
            } catch (err) {
                console.error(`❌ [GDrive] Error importing ${fileId}:`, err.message);
                results.push({ fileId, status: 'error', error: err.message });
            }
        }
        res.json({ imported: results });
    } catch (error) {
        console.error('❌ GDrive import error:', error.message);
        res.status(500).json({ error: error.message });
    }
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
        const { system_prompt, ai_model, bot_name, topic_whitelist, block_competitors, restrict_payment } = req.body;
        settings.update(req.tenant.id, {
            system_prompt: system_prompt || current.system_prompt,
            ai_model: ai_model || current.ai_model || config.DEFAULT_AI_MODEL,
            bot_name: bot_name || current.bot_name || config.DEFAULT_BOT_NAME,
            topic_whitelist: topic_whitelist !== undefined ? topic_whitelist : current.topic_whitelist,
            block_competitors: block_competitors !== undefined ? (block_competitors ? 1 : 0) : current.block_competitors,
            restrict_payment: restrict_payment !== undefined ? (restrict_payment ? 1 : 0) : current.restrict_payment,
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
// F01: LIVE CHAT HAND-OFF API
// ═══════════════════════════════════════════════════

app.get('/api/conversations', requireAuth, (req, res) => {
    const convs = conversations.getByTenant(req.tenant.id);
    const enriched = convs.map(c => {
        const lastMsg = messages.getByConversation(c.id, 1);
        return { ...c, last_message: lastMsg[lastMsg.length - 1] || null };
    });
    res.json(enriched);
});

app.get('/api/conversations/:id/messages', requireAuth, (req, res) => {
    const conv = conversations.getById(req.params.id);
    if (!conv || conv.tenant_id !== req.tenant.id) {
        return res.status(404).json({ error: 'Conversation not found' });
    }
    const msgs = messages.getByConversation(req.params.id, parseInt(req.query.limit) || 50);
    res.json(msgs);
});

app.post('/api/conversations/:id/reply', requireAuth, async (req, res) => {
    try {
        const conv = conversations.getById(req.params.id);
        if (!conv || conv.tenant_id !== req.tenant.id) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Missing message' });

        const fb = fbConfig.get(req.tenant.id);
        if (!fb?.page_access_token) {
            return res.status(400).json({ error: 'Facebook page not connected' });
        }

        await conversationModule.sendHumanReply(conv.id, message, fb.page_access_token);
        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Reply error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/conversations/:id/mode', requireAuth, (req, res) => {
    const conv = conversations.getById(req.params.id);
    if (!conv || conv.tenant_id !== req.tenant.id) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    const { mode } = req.body;
    if (!['ai', 'human', 'paused'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be: ai, human, paused' });
    }

    conversations.updateMode(req.params.id, mode);
    console.log(`🔄 [${req.tenant.email}] Conversation ${req.params.id} → ${mode} mode`);
    res.json({ ok: true, mode });
});

app.get('/api/notifications', requireAuth, (req, res) => {
    const notifs = notifications.getAll(req.tenant.id, parseInt(req.query.limit) || 20);
    const unreadCount = notifications.countUnread(req.tenant.id);
    res.json({ notifications: notifs, unreadCount });
});

app.put('/api/notifications/:id/read', requireAuth, (req, res) => {
    notifications.markRead(parseInt(req.params.id));
    res.json({ ok: true });
});

// ═══════════════════════════════════════════════════
// F02: SEPAY PAYMENT API
// ═══════════════════════════════════════════════════

app.get('/api/plans', async (req, res) => {
    try {
        const activePlans = await payment.getPlans();
        res.json(activePlans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/orders', requireAuth, (req, res) => {
    try {
        const { plan } = req.body;
        if (!plan) return res.status(400).json({ error: 'Missing plan' });

        const order = payment.createOrder(req.tenant.id, plan);
        res.json(order);
    } catch (error) {
        console.error('❌ Create order error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
    const order = orders.getById(req.params.id);
    if (!order || order.tenant_id !== req.tenant.id) {
        return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
});

app.get('/api/orders', requireAuth, (req, res) => {
    const tenantOrders = orders.getByTenant(req.tenant.id);
    res.json(tenantOrders);
});

// SePay Webhook (no auth middleware, uses API key)
app.post('/api/sepay/webhook', (req, res) => {
    try {
        const apiKey = req.headers.authorization;
        const result = payment.handleSepayWebhook(req.body, apiKey);
        res.json(result);
    } catch (error) {
        console.error('❌ SePay webhook error:', error.message);
        res.status(401).json({ error: error.message });
    }
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
            fbPageId: fb?.page_id,
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

// Owner — Orders & Revenue (F02)
app.get('/api/owner/orders', requireOwner, (req, res) => {
    res.json(orders.getAll());
});

app.get('/api/owner/revenue', requireOwner, (req, res) => {
    const monthly = orders.getRevenueByMonth();
    const total = orders.getTotalRevenue();
    res.json({ monthly, total });
});

// ─── Platform Settings API ───
app.get('/api/owner/platform-settings', requireOwner, (req, res) => {
    res.json(platformSettings.getAll());
});

app.put('/api/owner/platform-settings', requireOwner, (req, res) => {
    try {
        const { hard_guardrails } = req.body;
        if (hard_guardrails !== undefined) {
            platformSettings.set('hard_guardrails', hard_guardrails);
        }
        res.json({ ok: true });
    } catch (error) {
        console.error('❌ Update platform settings error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── Owner Plans API (F06) ───
app.get('/api/owner/plans', requireOwner, (req, res) => {
    res.json(plansMgr.getAll());
});

app.post('/api/owner/plans', requireOwner, (req, res) => {
    try {
        const { id, name, price, token_limit, features, is_active } = req.body;
        if (!id || !name || price === undefined) return res.status(400).json({ error: 'Missing required fields' });

        const plan = plansMgr.create(id, name, price, token_limit, JSON.stringify(features), is_active);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/owner/plans/:id', requireOwner, (req, res) => {
    try {
        const { name, price, token_limit, features, is_active } = req.body;
        const updateData = { name, price, token_limit, is_active };
        if (features) updateData.features = JSON.stringify(features);

        const plan = plansMgr.update(req.params.id, updateData);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/owner/plans/:id', requireOwner, (req, res) => {
    try {
        plansMgr.delete(req.params.id);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── Page Routes ───
app.get('/', (req, res) => {
    const fs = require('fs');
    const html = fs.readFileSync(path.join(__dirname, 'public', 'landing.html'), 'utf8')
        .replace(/%GOOGLE_CLIENT_ID%/g, config.GOOGLE_CLIENT_ID || '');
    res.type('html').send(html);
});
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/owner.html', requireOwnerRedirect, (req, res) => res.sendFile(path.join(__dirname, 'public', 'owner.html')));

// ─── Start Server ───
ai.initAI();

// Periodic cleanup: expire old orders every 5 minutes
setInterval(() => {
    const expired = orders.expireOld();
    if (expired > 0) console.log(`🧹 Expired ${expired} old order(s)`);
}, 5 * 60 * 1000);

app.listen(config.PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🏨 AI4All Platform Started         ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  🌐 http://localhost:${config.PORT}               ║`);
    console.log(`║  👑 Owner: ${config.OWNER_EMAIL}     ║`);
    console.log(`║  📡 Webhook: /webhook                    ║`);
    console.log(`║  💳 SePay: ${config.SEPAY_ENV} mode             ║`);
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
