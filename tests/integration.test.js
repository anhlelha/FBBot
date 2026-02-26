const path = require('path');
const fs = require('fs');

// Use separate test DB
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_api.db');
process.env.DB_PATH = TEST_DB_PATH;
process.env.OWNER_EMAIL = 'owner@test.com';
process.env.GEMINI_API_KEY = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.SESSION_SECRET = 'test_secret';

if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);

const config = require('../src/config');
config.DB_PATH = TEST_DB_PATH;
config.OWNER_EMAIL = 'owner@test.com';

const { tenants, whitelist, settings, fbConfig, db } = require('../src/database');
const { isOwner } = require('../src/auth');

afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─── Auth Logic Tests ───
describe('Auth Logic', () => {
    test('isOwner returns true for owner email', () => {
        expect(isOwner('owner@test.com')).toBe(true);
    });

    test('isOwner returns false for non-owner', () => {
        expect(isOwner('user@test.com')).toBe(false);
    });
});

// ─── Whitelist → Tenant Creation Flow ───
describe('Registration Flow', () => {
    test('non-whitelisted user gets trial plan', () => {
        const tenant = tenants.create('regular@test.com', 'Regular Hotel');
        expect(tenant.plan).toBe('trial');
        expect(tenant.token_limit).toBe(config.DEFAULT_TRIAL_TOKEN_LIMIT);
    });

    test('whitelisted user gets unlimited whitelist plan', () => {
        whitelist.add('vip@test.com', 'owner@test.com');
        const tenant = tenants.create('vip@test.com', 'VIP Hotel');
        expect(tenant.plan).toBe('whitelist');
        expect(tenant.token_limit).toBe(999999999);
    });

    test('owner email is always in whitelist', () => {
        expect(whitelist.isWhitelisted('owner@test.com')).toBe(true);
    });
});

// ─── Webhook Routing Flow ───
describe('Webhook Routing', () => {
    test('FB page_id maps to correct tenant', () => {
        const tenant = tenants.create('hotel1@test.com', 'Hotel One');
        fbConfig.upsert(tenant.id, {
            page_access_token: 'tok1',
            page_id: 'PAGE_100',
            page_name: 'Hotel One Page',
        });

        const result = fbConfig.getByPageId('PAGE_100');
        expect(result).toBeDefined();
        expect(result.tenant_id).toBe(tenant.id);
        expect(result.name).toBe('Hotel One');
        expect(result.page_access_token).toBe('tok1');
    });

    test('suspended tenant not returned by getByPageId', () => {
        const tenant = tenants.create('suspended@test.com', 'Suspended Hotel');
        fbConfig.upsert(tenant.id, {
            page_access_token: 'tokX',
            page_id: 'PAGE_SUSPENDED',
            page_name: 'Suspended Page',
        });
        tenants.update(tenant.id, { status: 'suspended' });

        const result = fbConfig.getByPageId('PAGE_SUSPENDED');
        expect(result).toBeUndefined();
    });
});

// ─── Token Limit Enforcement ───
describe('Token Limits', () => {
    test('token usage can be incremented', () => {
        const tenant = tenants.create('tokens@test.com', 'Token Hotel');
        tenants.incrementTokens(tenant.id, 100);
        const updated = tenants.getById(tenant.id);
        expect(updated.tokens_used).toBe(100);
    });

    test('trial user has correct default limit', () => {
        const tenant = tenants.create('trial@test.com', 'Trial Hotel');
        expect(tenant.token_limit).toBe(config.DEFAULT_TRIAL_TOKEN_LIMIT);
    });

    test('owner can update tenant token limit', () => {
        const tenant = tenants.create('limit@test.com', 'Limit Hotel');
        tenants.update(tenant.id, { token_limit: 100000 });
        const updated = tenants.getById(tenant.id);
        expect(updated.token_limit).toBe(100000);
    });
});

// ─── Multi-Tenant Isolation ───
describe('Tenant Isolation', () => {
    test('settings are isolated per tenant', () => {
        const t1 = tenants.create('iso1@test.com', 'Iso 1');
        const t2 = tenants.create('iso2@test.com', 'Iso 2');

        settings.update(t1.id, { system_prompt: 'Prompt for Hotel 1' });
        settings.update(t2.id, { system_prompt: 'Prompt for Hotel 2' });

        expect(settings.get(t1.id).system_prompt).toBe('Prompt for Hotel 1');
        expect(settings.get(t2.id).system_prompt).toBe('Prompt for Hotel 2');
    });

    test('FB configs are isolated per tenant', () => {
        const t1 = tenants.create('fb1@test.com', 'FB 1');
        const t2 = tenants.create('fb2@test.com', 'FB 2');

        fbConfig.upsert(t1.id, { page_id: 'P1', page_name: 'Page 1', page_access_token: 'tok_1' });
        fbConfig.upsert(t2.id, { page_id: 'P2', page_name: 'Page 2', page_access_token: 'tok_2' });

        expect(fbConfig.getByPageId('P1').tenant_id).toBe(t1.id);
        expect(fbConfig.getByPageId('P2').tenant_id).toBe(t2.id);
    });
});
