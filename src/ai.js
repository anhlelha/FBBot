const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

let genAI;
let model;
let embedModel;

// In-memory settings (can be updated via API)
let settings = {
    systemPrompt: config.SYSTEM_PROMPT,
};

/**
 * Initialize Gemini AI client
 */
function initAI() {
    if (!config.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY not set. AI responses will be disabled.');
        return;
    }
    genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    console.log('🤖 Gemini AI initialized (gemini-2.5-flash + gemini-embedding-001)');
}

/**
 * Generate embedding for a text
 */
async function getEmbedding(text) {
    if (!embedModel) throw new Error('AI not initialized');
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts
 */
async function getEmbeddings(texts) {
    const embeddings = [];
    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < texts.length; i += 5) {
        const batch = texts.slice(i, i + 5);
        const batchResults = await Promise.all(
            batch.map(text => getEmbedding(text))
        );
        embeddings.push(...batchResults);
    }
    return embeddings;
}

/**
 * Generate AI response for a user message
 */
async function generateResponse(userMessage) {
    if (!model) {
        return 'Xin lỗi, hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.';
    }

    try {
        // Search knowledge base for relevant context
        let context = '';
        try {
            // Lazy require to avoid circular dependency
            const knowledgeBase = require('./knowledgeBase');
            const relevantDocs = await knowledgeBase.search(userMessage);
            if (relevantDocs.length > 0) {
                context = '\n\n--- THÔNG TIN TỪ TÀI LIỆU KHÁCH SẠN ---\n' +
                    relevantDocs.map(doc => doc.text).join('\n\n') +
                    '\n--- HẾT THÔNG TIN ---\n';
            }
        } catch (err) {
            console.error('⚠️ Knowledge base search error:', err.message);
        }

        const prompt = `${settings.systemPrompt}
${context}

Tin nhắn từ khách hàng: ${userMessage}

Hãy trả lời bằng tiếng Việt, ngắn gọn và thân thiện. Nếu có thông tin từ tài liệu, hãy sử dụng nó để trả lời chính xác.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Truncate if too long for Messenger (limit is 2000 chars)
        if (response.length > 1900) {
            return response.substring(0, 1900) + '...';
        }

        return response;
    } catch (error) {
        console.error('❌ AI generation error:', error.message);
        return 'Xin lỗi, tôi gặp sự cố khi xử lý tin nhắn. Vui lòng thử lại sau hoặc liên hệ trực tiếp khách sạn.';
    }
}

/**
 * Get/Update settings
 */
function getSettings() {
    return { ...settings };
}

function updateSettings(newSettings) {
    if (newSettings.systemPrompt) {
        settings.systemPrompt = newSettings.systemPrompt;
    }
    return getSettings();
}

module.exports = {
    initAI,
    getEmbedding,
    getEmbeddings,
    generateResponse,
    getSettings,
    updateSettings,
};
