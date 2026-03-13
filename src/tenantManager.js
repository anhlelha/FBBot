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

    // 1. Check Usage Limits (Skip check if limit is -1 or 0)
    if (tenant.request_limit > 0 && tenant.requests_used >= tenant.request_limit) {
        return 'Bạn đã hết lượt request trong tháng này. Vui lòng nâng cấp gói cước để tiếp tục.';
    }
    if (tenant.token_limit > 0 && tenant.tokens_used >= tenant.token_limit) {
        return 'Bạn đã hết hạn mức Token. Vui lòng nâng cấp gói cước để tiếp tục.';
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

    // 3. Update Usage (Tokens & Requests)
    const tokensUsed = aiResult.tokensUsed || 0;
    tenants.incrementTokens(tenantId, tokensUsed);
    tenants.incrementRequests(tenantId);

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
