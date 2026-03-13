const path = require('path');
const fs = require('fs');

// Use separate test DB
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test.db');
process.env.DB_PATH = TEST_DB_PATH;
process.env.OWNER_EMAIL = 'owner@test.com';
process.env.GEMINI_API_KEY = '';
process.env.GOOGLE_CLIENT_ID = '';

// Clean test DB before each run
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
}

// Force config to pick up test values
jest.resetModules();
const config = require('../src/config');
config.DB_PATH = TEST_DB_PATH;
config.OWNER_EMAIL = 'owner@test.com';

const { tenants, fbConfig, settings, documents, whitelist, db } = require('../src/database');

afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});

// ─── Whitelist Tests ───
describe('Whitelist', () => {
    test('owner email is auto-seeded', () => {
        expect(whitelist.isWhitelisted('owner@test.com')).toBe(true);
    });

    test('add email to whitelist', () => {
        const result = whitelist.add('partner@test.com', 'owner@test.com');
        expect(result).toBe(true);
        expect(whitelist.isWhitelisted('partner@test.com')).toBe(true);
    });

    test('duplicate email returns false', () => {
        const result = whitelist.add('partner@test.com', 'owner@test.com');
        expect(result).toBe(false);
    });

    test('case-insensitive check', () => {
        whitelist.add('case@test.com', 'owner@test.com');
        expect(whitelist.isWhitelisted('CASE@TEST.COM')).toBe(true);
    });

    test('remove email from whitelist', () => {
        whitelist.add('removeme@test.com', 'owner@test.com');
        whitelist.remove('removeme@test.com');
        expect(whitelist.isWhitelisted('removeme@test.com')).toBe(false);
    });

    test('getAll returns all entries', () => {
        const all = whitelist.getAll();
        expect(all.length).toBeGreaterThanOrEqual(2);
        expect(all.some(e => e.email === 'owner@test.com')).toBe(true);
    });
});

// ─── Tenants Tests ───
describe('Tenants', () => {
    let tenantId;

    test('create tenant (not whitelisted) → trial plan', () => {
        const tenant = tenants.create('user@test.com', 'Test Hotel');
        expect(tenant).toBeDefined();
        expect(tenant.email).toBe('user@test.com');
        expect(tenant.name).toBe('Test Hotel');
        expect(tenant.plan).toBe('trial');
        expect(tenant.status).toBe('active');
        expect(tenant.tokens_used).toBe(0);
        tenantId = tenant.id;
    });

    test('create tenant (whitelisted) → whitelist plan', () => {
        whitelist.add('vip@test.com', 'owner@test.com');
        const tenant = tenants.create('vip@test.com', 'VIP Hotel');
        expect(tenant.plan).toBe('whitelist');
        expect(tenant.token_limit).toBe(999999999);
    });

    test('getByEmail', () => {
        const tenant = tenants.getByEmail('user@test.com');
        expect(tenant).toBeDefined();
        expect(tenant.id).toBe(tenantId);
    });

    test('getById', () => {
        const tenant = tenants.getById(tenantId);
        expect(tenant).toBeDefined();
        expect(tenant.email).toBe('user@test.com');
    });

    test('update tenant fields', () => {
        tenants.update(tenantId, { plan: 'basic', token_limit: 50000 });
        const tenant = tenants.getById(tenantId);
        expect(tenant.plan).toBe('basic');
        expect(tenant.token_limit).toBe(50000);
    });

    test('update ignores invalid fields', () => {
        tenants.update(tenantId, { hacked: 'yes', email: 'evil@test.com' });
        const tenant = tenants.getById(tenantId);
        expect(tenant.email).toBe('user@test.com'); // unchanged
    });

    test('incrementTokens', () => {
        tenants.incrementTokens(tenantId, 100);
        const tenant = tenants.getById(tenantId);
        expect(tenant.tokens_used).toBe(100);

        tenants.incrementTokens(tenantId, 50);
        const updated = tenants.getById(tenantId);
        expect(updated.tokens_used).toBe(150);
    });

    test('getAll returns all tenants', () => {
        const all = tenants.getAll();
        expect(all.length).toBeGreaterThanOrEqual(2);
    });

    test('getStats', () => {
        const stats = tenants.getStats();
        expect(stats.total).toBeGreaterThanOrEqual(2);
        expect(stats.active).toBeGreaterThanOrEqual(2);
        expect(stats.totalTokens).toBeGreaterThanOrEqual(150);
    });

    test('duplicate email throws', () => {
        expect(() => tenants.create('user@test.com', 'Dup')).toThrow();
    });
});

// ─── FB Config Tests ───
describe('FB Config', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('fb@test.com', 'FB Hotel');
        tenantId = tenant.id;
    });

    test('upsert creates new config', () => {
        fbConfig.upsert(tenantId, {
            page_access_token: 'token123',
            page_id: 'PAGE_001',
            page_name: 'Test Page',
        });
        const config = fbConfig.get(tenantId);
        expect(config).toBeDefined();
        expect(config.page_access_token).toBe('token123');
        expect(config.page_id).toBe('PAGE_001');
        expect(config.page_name).toBe('Test Page');
    });

    test('upsert updates existing config', () => {
        fbConfig.upsert(tenantId, {
            page_access_token: 'token456',
            page_name: 'Updated Page',
        });
        const config = fbConfig.get(tenantId);
        expect(config.page_access_token).toBe('token456');
        expect(config.page_name).toBe('Updated Page');
        expect(config.page_id).toBe('PAGE_001'); // unchanged
    });

    test('getByPageId finds tenant', () => {
        const result = fbConfig.getByPageId('PAGE_001');
        expect(result).toBeDefined();
        expect(result.tenant_id).toBe(tenantId);
        expect(result.email).toBe('fb@test.com');
        expect(result.status).toBe('active');
    });

    test('getByPageId returns null for unknown page', () => {
        const result = fbConfig.getByPageId('UNKNOWN_PAGE');
        expect(result).toBeUndefined();
    });
});

// ─── Settings Tests ───
describe('Tenant Settings', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('settings@test.com', 'Settings Hotel');
        tenantId = tenant.id;
    });

    test('default settings created with tenant', () => {
        const s = settings.get(tenantId);
        expect(s).toBeDefined();
        expect(s.ai_model).toBe('gemini-2.5-flash');
        expect(s.bot_name).toBe('AI Assistant');
        expect(s.system_prompt).toBeTruthy();
    });

    test('update settings', () => {
        settings.update(tenantId, {
            system_prompt: 'Custom prompt',
            bot_name: 'Hotel Bot',
            ai_model: 'gemini-pro',
        });
        const s = settings.get(tenantId);
        expect(s.system_prompt).toBe('Custom prompt');
        expect(s.bot_name).toBe('Hotel Bot');
        expect(s.ai_model).toBe('gemini-pro');
    });

    test('update ignores invalid fields', () => {
        settings.update(tenantId, { hacked: 'evil', tenant_id: 'fake' });
        const s = settings.get(tenantId);
        expect(s.tenant_id).toBe(tenantId); // unchanged
    });
});

// ─── Documents Tests ───
describe('Documents', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('docs@test.com', 'Docs Hotel');
        tenantId = tenant.id;
    });

    test('create document', () => {
        const docId = documents.create(tenantId, 'test.txt', '/tmp/test.txt', 1024, 'txt');
        expect(docId).toBeTruthy();

        const doc = documents.getById(docId);
        expect(doc.filename).toBe('test.txt');
        expect(doc.tenant_id).toBe(tenantId);
        expect(doc.size).toBe(1024);
    });

    test('updateChunks', () => {
        const docId = documents.create(tenantId, 'chunked.txt', '/tmp/chunked.txt', 2048, 'txt');
        documents.updateChunks(docId, 5);
        const doc = documents.getById(docId);
        expect(doc.chunks_count).toBe(5);
    });

    test('getByTenant returns tenant docs', () => {
        const docs = documents.getByTenant(tenantId);
        expect(docs.length).toBe(2);
    });

    test('getStatsByTenant', () => {
        const stats = documents.getStatsByTenant(tenantId);
        expect(stats.totalDocuments).toBe(2);
        expect(stats.totalChunks).toBe(5);
    });

    test('delete document', () => {
        const docId = documents.create(tenantId, 'deleteme.txt', '/tmp/nonexistent.txt', 100, 'txt');
        const doc = documents.delete(docId);
        expect(doc.filename).toBe('deleteme.txt');
        expect(documents.getById(docId)).toBeUndefined();
    });

    test('docs isolated between tenants', () => {
        const other = tenants.create('other@test.com', 'Other');
        documents.create(other.id, 'other.txt', '/tmp/other.txt', 500, 'txt');
        const myDocs = documents.getByTenant(tenantId);
        const otherDocs = documents.getByTenant(other.id);
        expect(myDocs.every(d => d.tenant_id === tenantId)).toBe(true);
        expect(otherDocs.every(d => d.tenant_id === other.id)).toBe(true);
    });
});

// VectorStore tests removed as the module is no longer used in the project.
