const ai = require('./ai');
const vertexRag = require('./vertexRag');
const { tenants, fbConfig, settings } = require('./database');

// In-memory cache: tenant AI instances & corpus names
const tenantInstances = new Map();

function getTenantInstance(tenantId) {
    if (tenantInstances.has(tenantId)) {
        return tenantInstances.get(tenantId);
    }

    const tenant = tenants.getById(tenantId);
    if (!tenant) return null;

    const tenantSettings = settings.get(tenantId);

    const instance = {
        tenant,
        settings: tenantSettings,
        corpusName: tenant.corpus_name,
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

    const { tenant, corpusName } = instance;
    const tenantSettings = settings.get(tenantId);

    // Check token limit (skip for whitelist/pro)
    if (tenant.plan !== 'whitelist' && tenant.plan !== 'pro') {
        if (tenant.tokens_used >= tenant.token_limit) {
            return 'Xin lỗi, tài khoản đã hết hạn mức token. Vui lòng nâng cấp gói để tiếp tục sử dụng.';
        }
    }

    // Search context from Vertex AI RAG Corpus
    let context = '';
    if (corpusName) {
        try {
            const results = await vertexRag.retrieveContexts(corpusName, userMessage, 5);
            if (results.length > 0) {
                context = results.map(r => r.text).join('\n\n---\n\n');
            }
        } catch (error) {
            console.error(`⚠️ [${tenantId}] RAG Retrieval Error:`, error.message);
            // Fallback: Continue without context if RAG fails
        }
    }

    const aiResult = await ai.generateResponse(userMessage, tenantSettings, context);
    const responseText = aiResult.text;

    // Use PRECISE totalTokenCount from Gemini
    const tokensUsed = aiResult.tokensUsed;

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
