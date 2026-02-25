const express = require('express');
const multer = require('multer');
const path = require('path');
const config = require('./src/config');
const webhookRouter = require('./src/webhook');
const ai = require('./src/ai');
const knowledgeBase = require('./src/knowledgeBase');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// File upload config
const storage = multer.diskStorage({
    destination: config.UPLOAD_DIR,
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.txt', '.md', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`File type not supported: ${ext}. Allowed: ${allowed.join(', ')}`));
        }
    },
});

// ─── Webhook Routes ────────────────────────────────────
app.use('/webhook', webhookRouter);

// ─── API Routes ────────────────────────────────────────

// Upload document
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const doc = await knowledgeBase.addDocument(req.file);
        res.json({ success: true, document: doc });
    } catch (error) {
        console.error('Upload error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// List documents
app.get('/api/documents', (req, res) => {
    const docs = knowledgeBase.listDocuments();
    res.json({ documents: docs });
});

// Delete document
app.delete('/api/documents/:id', (req, res) => {
    try {
        const doc = knowledgeBase.removeDocument(req.params.id);
        res.json({ success: true, removed: doc });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Chat test
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const reply = await ai.generateResponse(message);
        res.json({ reply });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Settings
app.get('/api/settings', (req, res) => {
    res.json(ai.getSettings());
});

app.post('/api/settings', (req, res) => {
    const updated = ai.updateSettings(req.body);
    res.json({ success: true, settings: updated });
});

// Status
app.get('/api/status', (req, res) => {
    const stats = knowledgeBase.getStats();
    res.json({
        status: 'running',
        webhookUrl: `${req.protocol}://${req.get('host')}/webhook`,
        ai: {
            provider: 'Google Gemini',
            model: 'gemini-2.0-flash',
            configured: !!config.GEMINI_API_KEY,
        },
        facebook: {
            configured: !!config.FB_PAGE_ACCESS_TOKEN,
        },
        knowledgeBase: stats,
        uptime: process.uptime(),
    });
});

// ─── Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
});

// ─── Start Server ──────────────────────────────────────
ai.initAI();

app.listen(config.PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║      🏨 Hotel Chatbot - FB Messenger        ║
╠══════════════════════════════════════════════╣
║  Server:    http://localhost:${config.PORT}            ║
║  Webhook:   http://localhost:${config.PORT}/webhook    ║
║  Admin UI:  http://localhost:${config.PORT}            ║
╠══════════════════════════════════════════════╣
║  AI:        Google Gemini ${config.GEMINI_API_KEY ? '✅' : '❌'}               ║
║  Facebook:  ${config.FB_PAGE_ACCESS_TOKEN ? '✅ Configured' : '❌ Not configured'}                  ║
╚══════════════════════════════════════════════╝
  `);
});

module.exports = app;
