const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('./config');

// Ensure data directory exists
const dataDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'trial',
    status TEXT NOT NULL DEFAULT 'active',
    token_limit INTEGER NOT NULL DEFAULT ${config.DEFAULT_TRIAL_TOKEN_LIMIT},
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenant_fb_config (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    page_access_token TEXT,
    verify_token TEXT,
    app_secret TEXT,
    page_id TEXT,
    page_name TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    system_prompt TEXT NOT NULL DEFAULT '${config.DEFAULT_SYSTEM_PROMPT.replace(/'/g, "''")}',
    ai_model TEXT NOT NULL DEFAULT '${config.DEFAULT_AI_MODEL}',
    bot_name TEXT NOT NULL DEFAULT '${config.DEFAULT_BOT_NAME}',
    tools_config TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    chunks_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS whitelist_emails (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    added_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_tenant_fb_page ON tenant_fb_config(page_id);
`);

function generateId() {
    return crypto.randomUUID();
}

// ─── Tenants ───
const tenants = {
    create(email, name) {
        const id = generateId();
        const isWhitelisted = whitelist.isWhitelisted(email);
        const plan = isWhitelisted ? 'whitelist' : 'trial';
        const tokenLimit = isWhitelisted ? 999999999 : config.DEFAULT_TRIAL_TOKEN_LIMIT;

        db.prepare(`INSERT INTO tenants (id, email, name, plan, token_limit) VALUES (?, ?, ?, ?, ?)`)
            .run(id, email, name, plan, tokenLimit);

        db.prepare(`INSERT INTO tenant_settings (tenant_id) VALUES (?)`)
            .run(id);

        return this.getById(id);
    },

    getById(id) {
        return db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(id);
    },

    getByEmail(email) {
        return db.prepare(`SELECT * FROM tenants WHERE email = ?`).get(email);
    },

    getAll() {
        return db.prepare(`SELECT * FROM tenants ORDER BY created_at DESC`).all();
    },

    update(id, fields) {
        const allowed = ['name', 'plan', 'status', 'token_limit', 'tokens_used'];
        const sets = [];
        const values = [];
        for (const [key, val] of Object.entries(fields)) {
            if (allowed.includes(key)) {
                sets.push(`${key} = ?`);
                values.push(val);
            }
        }
        if (sets.length === 0) return;
        values.push(id);
        db.prepare(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    },

    incrementTokens(id, count) {
        db.prepare(`UPDATE tenants SET tokens_used = tokens_used + ? WHERE id = ?`).run(count, id);
    },

    getStats() {
        const total = db.prepare(`SELECT COUNT(*) as count FROM tenants`).get().count;
        const active = db.prepare(`SELECT COUNT(*) as count FROM tenants WHERE status = 'active'`).get().count;
        const totalTokens = db.prepare(`SELECT COALESCE(SUM(tokens_used), 0) as total FROM tenants`).get().total;
        return { total, active, totalTokens };
    },
};

// ─── FB Config ───
const fbConfig = {
    get(tenantId) {
        return db.prepare(`SELECT * FROM tenant_fb_config WHERE tenant_id = ?`).get(tenantId);
    },

    upsert(tenantId, data) {
        const existing = this.get(tenantId);
        if (existing) {
            const sets = [];
            const values = [];
            for (const [key, val] of Object.entries(data)) {
                if (['page_access_token', 'verify_token', 'app_secret', 'page_id', 'page_name'].includes(key)) {
                    sets.push(`${key} = ?`);
                    values.push(val);
                }
            }
            sets.push(`updated_at = datetime('now')`);
            values.push(tenantId);
            db.prepare(`UPDATE tenant_fb_config SET ${sets.join(', ')} WHERE tenant_id = ?`).run(...values);
        } else {
            db.prepare(`INSERT INTO tenant_fb_config (tenant_id, page_access_token, verify_token, app_secret, page_id, page_name) VALUES (?, ?, ?, ?, ?, ?)`)
                .run(tenantId, data.page_access_token || null, data.verify_token || null, data.app_secret || null, data.page_id || null, data.page_name || null);
        }
    },

    getByPageId(pageId) {
        return db.prepare(`
      SELECT tfc.*, t.id as tenant_id, t.email, t.name, t.status, t.plan, t.token_limit, t.tokens_used
      FROM tenant_fb_config tfc
      JOIN tenants t ON t.id = tfc.tenant_id
      WHERE tfc.page_id = ? AND t.status = 'active'
    `).get(pageId);
    },
};

// ─── Tenant Settings ───
const settings = {
    get(tenantId) {
        return db.prepare(`SELECT * FROM tenant_settings WHERE tenant_id = ?`).get(tenantId);
    },

    update(tenantId, data) {
        const allowed = ['system_prompt', 'ai_model', 'bot_name', 'tools_config'];
        const sets = [];
        const values = [];
        for (const [key, val] of Object.entries(data)) {
            if (allowed.includes(key)) {
                sets.push(`${key} = ?`);
                values.push(key === 'tools_config' && typeof val !== 'string' ? JSON.stringify(val) : val);
            }
        }
        if (sets.length === 0) return;
        sets.push(`updated_at = datetime('now')`);
        values.push(tenantId);
        db.prepare(`UPDATE tenant_settings SET ${sets.join(', ')} WHERE tenant_id = ?`).run(...values);
    },
};

// ─── Documents ───
const documents = {
    create(tenantId, filename, filePath, size, type) {
        const id = generateId();
        db.prepare(`INSERT INTO documents (id, tenant_id, filename, path, size, type) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(id, tenantId, filename, filePath, size, type);
        return id;
    },

    updateChunks(id, chunksCount) {
        db.prepare(`UPDATE documents SET chunks_count = ? WHERE id = ?`).run(chunksCount, id);
    },

    getByTenant(tenantId) {
        return db.prepare(`SELECT * FROM documents WHERE tenant_id = ? ORDER BY created_at DESC`).all(tenantId);
    },

    getById(id) {
        return db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id);
    },

    delete(id) {
        const doc = this.getById(id);
        if (doc && fs.existsSync(doc.path)) {
            fs.unlinkSync(doc.path);
        }
        db.prepare(`DELETE FROM documents WHERE id = ?`).run(id);
        return doc;
    },

    getStatsByTenant(tenantId) {
        const row = db.prepare(`SELECT COUNT(*) as totalDocs, COALESCE(SUM(chunks_count), 0) as totalChunks FROM documents WHERE tenant_id = ?`).get(tenantId);
        return { totalDocuments: row.totalDocs, totalChunks: row.totalChunks };
    },
};

// ─── Whitelist ───
const whitelist = {
    add(email, addedBy) {
        const id = generateId();
        try {
            db.prepare(`INSERT INTO whitelist_emails (id, email, added_by) VALUES (?, ?, ?)`).run(id, email.toLowerCase(), addedBy);
            return true;
        } catch (e) {
            if (e.message.includes('UNIQUE')) return false;
            throw e;
        }
    },

    remove(email) {
        db.prepare(`DELETE FROM whitelist_emails WHERE email = ?`).run(email.toLowerCase());
    },

    isWhitelisted(email) {
        return !!db.prepare(`SELECT 1 FROM whitelist_emails WHERE email = ?`).get(email.toLowerCase());
    },

    getAll() {
        return db.prepare(`SELECT * FROM whitelist_emails ORDER BY created_at DESC`).all();
    },
};

// Seed owner email into whitelist if not exists
whitelist.add(config.OWNER_EMAIL, 'system');

console.log('💾 SQLite database initialized at', config.DB_PATH);

module.exports = { db, tenants, fbConfig, settings, documents, whitelist };
