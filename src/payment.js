const crypto = require('crypto');
const config = require('./config');
const { tenants, orders, paymentHistory, plansMgr } = require('./database');

async function getPlans() {
    const plans = plansMgr.getActive();
    return plans.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
        // Backward compatibility for old UI keys if needed
        doc_limit: p.id === 'pro' ? -1 : (p.id === 'basic' ? 10 : 3),
        description: p.id === 'pro' ? 'Dành cho KS lớn' : (p.id === 'basic' ? 'Gói phổ biến cho KS nhỏ' : 'Gói tùy chỉnh')
    }));
}

function createOrder(tenantId, planId) {
    const plan = plansMgr.getById(planId);
    if (!plan || !plan.is_active) throw new Error(`Invalid or inactive plan: ${planId}`);

    const amount = plan.price;
    if (amount <= 0 && plan.id !== 'trial') throw new Error('Cannot create order for free plan');

    // Rate limit: max 5 pending orders per tenant
    const pending = orders.countPendingByTenant(tenantId);
    if (pending >= 5) throw new Error('Quá nhiều đơn hàng đang chờ. Vui lòng đợi hoặc huỷ đơn cũ.');

    // Expire old orders first
    orders.expireOld();

    const code = crypto.randomUUID().substring(0, 8).toUpperCase();
    const transferContent = `AI4ALL ORD ${code}`;

    // Expire after 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    const order = orders.create(tenantId, plan, amount, transferContent, expiresAt);

    return {
        ...order,
        qr_url: generateQRUrl(order),
        bank_account: config.SEPAY_BANK_ACCOUNT,
        bank_name: config.SEPAY_BANK_NAME,
        account_name: config.SEPAY_ACCOUNT_NAME,
    };
}

function generateQRUrl(order) {
    const bankName = config.SEPAY_BANK_NAME;
    const accountNo = config.SEPAY_BANK_ACCOUNT;
    const amount = order.amount;
    const content = encodeURIComponent(order.transfer_content);
    const accountName = encodeURIComponent(config.SEPAY_ACCOUNT_NAME);

    return `https://img.vietqr.io/image/${bankName}-${accountNo}-compact.png?amount=${amount}&addInfo=${content}&accountName=${accountName}`;
}

function handleSepayWebhook(body, apiKey) {
    // Verify API key
    if (apiKey !== `Apikey ${config.SEPAY_API_KEY}`) {
        throw new Error('Invalid API key');
    }

    // Only process incoming transfers
    if (body.transferType !== 'in') {
        return { status: 'ignored', reason: 'Not an incoming transfer' };
    }

    const content = (body.content || '').trim();
    const amount = body.transferAmount;

    // Find matching order by transfer content
    const order = orders.getByTransferContent(content);
    if (!order) {
        console.warn(`⚠️ [SePay] No matching order for content: "${content}"`);
        return { status: 'no_match', content };
    }

    // Verify amount
    if (amount < order.amount) {
        console.warn(`⚠️ [SePay] Amount mismatch: expected ${order.amount}, got ${amount}`);
        return { status: 'amount_mismatch', expected: order.amount, received: amount };
    }

    // Mark order as paid
    orders.markPaid(order.id, String(body.id));

    // Get current tenant info for plan transition log
    const tenant = tenants.getById(order.tenant_id);
    const planFrom = tenant.plan;

    // Upgrade tenant plan
    const planDetails = plansMgr.getById(order.plan);
    const newTokenLimit = planDetails ? planDetails.token_limit : config.DEFAULT_TRIAL_TOKEN_LIMIT;

    tenants.update(order.tenant_id, {
        plan: order.plan,
        token_limit: newTokenLimit,
    });

    // Log payment history
    paymentHistory.create(order.tenant_id, order.id, planFrom, order.plan, order.amount);

    console.log(`✅ [SePay] Order ${order.id} paid! Tenant ${tenant.email}: ${planFrom} → ${order.plan}`);

    return { status: 'success', orderId: order.id, plan: order.plan };
}

module.exports = {
    getPlans,
    createOrder,
    generateQRUrl,
    handleSepayWebhook,
};
