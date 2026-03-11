const path = require('path');
const fs = require('fs');

// Use separate test DB
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'test_features.db');
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

const { tenants, conversations, messages, notifications, orders, paymentHistory, db } = require('../src/database');

afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});

// ─── Conversations Tests (F01) ───
describe('Conversations', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('conv@test.com', 'Conv Hotel');
        tenantId = tenant.id;
    });

    test('create conversation', () => {
        const conv = conversations.create(tenantId, 'PSID_001', 'Khách 1');
        expect(conv).toBeDefined();
        expect(conv.tenant_id).toBe(tenantId);
        expect(conv.sender_id).toBe('PSID_001');
        expect(conv.mode).toBe('ai');
    });

    test('getBySender', () => {
        const conv = conversations.getBySender(tenantId, 'PSID_001');
        expect(conv).toBeDefined();
        expect(conv.sender_name).toBe('Khách 1');
    });

    test('getOrCreate returns existing', () => {
        const conv = conversations.getOrCreate(tenantId, 'PSID_001', 'Khách 1');
        expect(conv.sender_id).toBe('PSID_001');
    });

    test('getOrCreate creates new', () => {
        const conv = conversations.getOrCreate(tenantId, 'PSID_002', 'Khách 2');
        expect(conv.sender_id).toBe('PSID_002');
        expect(conv.mode).toBe('ai');
    });

    test('updateMode to human', () => {
        const conv = conversations.getBySender(tenantId, 'PSID_001');
        conversations.updateMode(conv.id, 'human', 'Khách yêu cầu gặp nhân viên');
        const updated = conversations.getById(conv.id);
        expect(updated.mode).toBe('human');
        expect(updated.handoff_reason).toBe('Khách yêu cầu gặp nhân viên');
    });

    test('updateMode back to ai', () => {
        const conv = conversations.getBySender(tenantId, 'PSID_001');
        conversations.updateMode(conv.id, 'ai');
        const updated = conversations.getById(conv.id);
        expect(updated.mode).toBe('ai');
    });

    test('getByTenant returns all conversations', () => {
        const convs = conversations.getByTenant(tenantId);
        expect(convs.length).toBe(2);
    });

    test('conversations isolated between tenants', () => {
        const other = tenants.create('conv2@test.com', 'Other Hotel');
        conversations.create(other.id, 'PSID_OTHER', 'Other Guest');
        const myConvs = conversations.getByTenant(tenantId);
        const otherConvs = conversations.getByTenant(other.id);
        expect(myConvs.every(c => c.tenant_id === tenantId)).toBe(true);
        expect(otherConvs.length).toBe(1);
    });
});

// ─── Messages Tests (F01) ───
describe('Messages', () => {
    let conversationId;

    beforeAll(() => {
        const tenant = tenants.create('msg@test.com', 'Msg Hotel');
        const conv = conversations.create(tenant.id, 'PSID_MSG', 'Guest');
        conversationId = conv.id;
    });

    test('create guest message', () => {
        const msg = messages.create(conversationId, 'guest', 'Xin chào!');
        expect(msg).toBeDefined();
        expect(msg.sender_type).toBe('guest');
        expect(msg.content).toBe('Xin chào!');
    });

    test('create ai message', () => {
        const msg = messages.create(conversationId, 'ai', 'Chào bạn! Tôi có thể giúp gì?');
        expect(msg.sender_type).toBe('ai');
    });

    test('create human message', () => {
        const msg = messages.create(conversationId, 'human', 'Xin chào, tôi là nhân viên hỗ trợ.');
        expect(msg.sender_type).toBe('human');
    });

    test('getByConversation returns ordered messages', () => {
        const msgs = messages.getByConversation(conversationId);
        expect(msgs.length).toBe(3);
        expect(msgs[0].sender_type).toBe('guest');
        expect(msgs[1].sender_type).toBe('ai');
        expect(msgs[2].sender_type).toBe('human');
    });

    test('getByConversation with limit', () => {
        const msgs = messages.getByConversation(conversationId, 2);
        expect(msgs.length).toBe(2);
    });
});

// ─── Notifications Tests (F01) ───
describe('Notifications', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('notif@test.com', 'Notif Hotel');
        tenantId = tenant.id;
    });

    test('create notification', () => {
        const notif = notifications.create(tenantId, 'handoff', 'Khách yêu cầu hỗ trợ', 'Chi tiết...', 'conv_123');
        expect(notif).toBeDefined();
        expect(notif.type).toBe('handoff');
        expect(notif.is_read).toBe(0);
    });

    test('countUnread', () => {
        notifications.create(tenantId, 'new_message', 'Tin nhắn mới', 'Nội dung', null);
        expect(notifications.countUnread(tenantId)).toBe(2);
    });

    test('getUnread returns only unread', () => {
        const unread = notifications.getUnread(tenantId);
        expect(unread.length).toBe(2);
    });

    test('markRead', () => {
        const unread = notifications.getUnread(tenantId);
        notifications.markRead(unread[0].id);
        expect(notifications.countUnread(tenantId)).toBe(1);
    });

    test('getAll returns all', () => {
        const all = notifications.getAll(tenantId);
        expect(all.length).toBe(2);
    });
});

// ─── Orders Tests (F02) ───
describe('Orders', () => {
    let tenantId;

    beforeAll(() => {
        const tenant = tenants.create('order@test.com', 'Order Hotel');
        tenantId = tenant.id;
    });

    test('create order', () => {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const order = orders.create(tenantId, 'basic', 200000, 'AI4ALL ORD TEST01', expiresAt);
        expect(order).toBeDefined();
        expect(order.id).toMatch(/^ORD-/);
        expect(order.plan).toBe('basic');
        expect(order.amount).toBe(200000);
        expect(order.status).toBe('pending');
    });

    test('getByTransferContent', () => {
        const order = orders.getByTransferContent('AI4ALL ORD TEST01');
        expect(order).toBeDefined();
        expect(order.amount).toBe(200000);
    });

    test('markPaid', () => {
        const order = orders.getByTransferContent('AI4ALL ORD TEST01');
        orders.markPaid(order.id, 'SEPAY_TX_123');
        const updated = orders.getById(order.id);
        expect(updated.status).toBe('paid');
        expect(updated.sepay_transaction_id).toBe('SEPAY_TX_123');
        expect(updated.paid_at).toBeTruthy();
    });

    test('getByTenant returns tenant orders', () => {
        const tenantOrders = orders.getByTenant(tenantId);
        expect(tenantOrders.length).toBe(1);
    });

    test('getByTransferContent returns null for paid orders', () => {
        const order = orders.getByTransferContent('AI4ALL ORD TEST01');
        expect(order).toBeUndefined(); // already paid, not pending
    });

    test('countPendingByTenant', () => {
        expect(orders.countPendingByTenant(tenantId)).toBe(0); // previous was marked paid
    });

    test('expireOld expires past-due orders', () => {
        const pastExpiry = '2020-01-01 00:00:00';
        orders.create(tenantId, 'pro', 500000, 'AI4ALL ORD EXPIRED', pastExpiry);
        const expired = orders.expireOld();
        expect(expired).toBe(1);
        const order = orders.getByTransferContent('AI4ALL ORD EXPIRED');
        expect(order).toBeUndefined(); // expired, not pending
    });

    test('getTotalRevenue', () => {
        const revenue = orders.getTotalRevenue();
        expect(revenue.total).toBe(200000);
        expect(revenue.count).toBe(1);
    });
});

// ─── Payment History Tests (F02) ───
describe('Payment History', () => {
    let tenantId;
    let orderId;

    beforeAll(() => {
        const tenant = tenants.create('pay@test.com', 'Pay Hotel');
        tenantId = tenant.id;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const order = orders.create(tenantId, 'basic', 200000, 'AI4ALL ORD PAYTEST', expiresAt);
        orderId = order.id;
    });

    test('create payment history entry', () => {
        paymentHistory.create(tenantId, orderId, 'trial', 'basic', 200000);
        const history = paymentHistory.getByTenant(tenantId);
        expect(history.length).toBe(1);
        expect(history[0].plan_from).toBe('trial');
        expect(history[0].plan_to).toBe('basic');
    });
});

// ─── Hand-off Detection Tests (F01) ───
describe('Hand-off Detection', () => {
    const conversation = require('../src/conversation');

    test('detects Vietnamese hand-off keywords', () => {
        expect(conversation.detectHandoff('Tôi muốn gặp nhân viên')).toBe('gặp nhân viên');
        expect(conversation.detectHandoff('cho tôi nói chuyện người thật')).toBe('nói chuyện người thật');
        expect(conversation.detectHandoff('gọi hotline cho tôi')).toBe('hotline');
    });

    test('returns null for normal messages', () => {
        expect(conversation.detectHandoff('Phòng bao nhiêu tiền?')).toBeNull();
        expect(conversation.detectHandoff('Khách sạn có bể bơi không?')).toBeNull();
    });

    test('checkAIHandoff detects [HANDOFF] marker', () => {
        expect(conversation.checkAIHandoff('Tôi không biết câu trả lời. [HANDOFF]')).toBe(true);
        expect(conversation.checkAIHandoff('Phòng có giá 500k/đêm.')).toBe(false);
    });

    test('cleanHandoffResponse removes marker', () => {
        expect(conversation.cleanHandoffResponse('Xin lỗi, tôi không biết. [HANDOFF]'))
            .toBe('Xin lỗi, tôi không biết.');
    });
});


// ─── Webhook Tests (F02) ───
describe('SePay Webhook', () => {
    const payment = require('../src/payment');
    const { tenants, orders, paymentHistory } = require('../src/database');
    const config = require('../src/config');
    let tenantId;
    let orderId;

    beforeAll(() => {
        config.SEPAY_API_KEY = 'TEST_KEY';
        const tenant = tenants.create('webhook@test.com', 'Webhook Hotel');
        tenantId = tenant.id;
    });

    beforeEach(() => {
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const order = orders.create(tenantId, 'pro', 500000, 'AI4ALL ORD WHKTEST' + Date.now() + Math.random(), expiresAt);
        orderId = order.id;
    });

    test('throws error on invalid API key', () => {
        expect(() => payment.handleSepayWebhook({}, 'Apikey INVALID_KEY')).toThrow('Invalid API key');
    });

    test('ignores non-incoming transfers', () => {
        const result = payment.handleSepayWebhook({ transferType: 'out' }, 'Apikey TEST_KEY');
        expect(result.status).toBe('ignored');
    });

    test('returns no_match for invalid content', () => {
        const result = payment.handleSepayWebhook({ transferType: 'in', content: 'INVALID CONTENT' }, 'Apikey TEST_KEY');
        expect(result.status).toBe('no_match');
    });

    test('returns amount_mismatch for insufficient amount', () => {
        const order = orders.getById(orderId);
        const result = payment.handleSepayWebhook({
            transferType: 'in',
            content: order.transfer_content,
            transferAmount: 100000, // < 500000
        }, 'Apikey TEST_KEY');
        expect(result.status).toBe('amount_mismatch');
    });

    test('processes valid payment successfully with transaction', () => {
        const order = orders.getById(orderId);
        const result = payment.handleSepayWebhook({
            transferType: 'in',
            content: order.transfer_content,
            transferAmount: 500000,
            id: 12345
        }, 'Apikey TEST_KEY');

        expect(result.status).toBe('success');
        expect(result.orderId).toBe(orderId);

        // Verify order status
        const updatedOrder = orders.getById(orderId);
        expect(updatedOrder.status).toBe('paid');

        // Verify tenant upgraded
        const tenant = tenants.getById(tenantId);
        expect(tenant.plan).toBe('pro');

        // Verify payment history
        const history = paymentHistory.getByTenant(tenantId);
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].order_id).toBe(orderId);
    });
});
