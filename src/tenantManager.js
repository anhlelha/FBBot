const ai = require('./ai');
const VectorStore = require('./vectorStore');
const knowledgeBase = require('./knowledgeBase');
const { tenants, fbConfig, settings, documents } = require('./database');

// In-memory cache: tenant AI instances & vector stores
const tenantInstances = new Map();

function getTenantInstance(tenantId) {
    if (tenantInstances.has(tenantId)) {
        return tenantInstances.get(tenantId);
    }

    const tenant = tenants.getById(tenantId);
    if (!tenant) return null;

    const tenantSettings = settings.get(tenantId);
    const vectorStore = new VectorStore();

    // Load knowledge back into vector store from DB
    knowledgeBase.loadTenantKnowledge(tenantId, vectorStore);

    const instance = {
        tenant,
        settings: tenantSettings,
        vectorStore,
    };

    tenantInstances.set(tenantId, instance);
    return instance;
}

function clearTenantInstance(tenantId) {
    tenantInstances.delete(tenantId);
}

async function generateResponseForTenant(tenantId, userMessage) {
    const instance = getTenantInstance(tenantId);
    if (!instance) throw new Error('Tenant not found');

    const { tenant, vectorStore } = instance;
    const tenantSettings = settings.get(tenantId);

    // Check token limit (skip for whitelist/pro)
    if (tenant.plan !== 'whitelist' && tenant.plan !== 'pro') {
        if (tenant.tokens_used >= tenant.token_limit) {
            return 'Xin lỗi, tài khoản đã hết hạn mức token. Vui lòng nâng cấp gói để tiếp tục sử dụng.';
        }
    }

    // Search context from tenant's vector store
    let context = '';
    if (vectorStore.size > 0) {
        const queryEmbedding = await ai.getEmbedding(userMessage);
        const results = vectorStore.search(queryEmbedding, 5);
        if (results.length > 0) {
            context = results.map(r => r.text).join('\n\n---\n\n');
        }
    }

    const aiResult = await ai.generateResponse(userMessage, tenantSettings, context);
    const responseText = aiResult.text;

    // Use PRECISE totalTokenCount from Gemini
    let tokensUsed = aiResult.tokensUsed;

    // Add estimation for embedding if query was made (approx 1 token per 4 chars for query)
    if (vectorStore.size > 0) {
        tokensUsed += Math.ceil(userMessage.length / 4);
    }

    tenants.incrementTokens(tenantId, tokensUsed);

    // Refresh cached tenant data
    const updated = tenants.getById(tenantId);
    if (instance) instance.tenant = updated;

    return responseText;
}

function getTenantByPageId(pageId) {
    return fbConfig.getByPageId(pageId);
}

module.exports = {
    getTenantInstance,
    clearTenantInstance,
    generateResponseForTenant,
    getTenantByPageId,
};
