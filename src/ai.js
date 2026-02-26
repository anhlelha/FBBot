const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

let genAI;
let model;
let embedModel;

function initAI() {
    if (!config.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY not set. AI responses will be disabled.');
        return;
    }
    genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: config.DEFAULT_AI_MODEL });
    embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    console.log(`🤖 Gemini AI initialized (${config.DEFAULT_AI_MODEL} + gemini-embedding-001)`);
}

async function generateResponse(userMessage, systemPrompt, context) {
    if (!model) {
        return 'Xin lỗi, hệ thống AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.';
    }

    const prompt = systemPrompt || config.DEFAULT_SYSTEM_PROMPT;

    let fullPrompt = `Hướng dẫn hệ thống: ${prompt}\n\n`;
    if (context) {
        fullPrompt += `Thông tin tham khảo:\n${context}\n\n`;
    }
    fullPrompt += `Tin nhắn của khách hàng: ${userMessage}\n\nTrả lời:`;

    try {
        const result = await model.generateContent(fullPrompt);
        return result.response.text();
    } catch (error) {
        console.error('❌ AI generation error:', error.message);
        return 'Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
    }
}

async function getEmbedding(text) {
    if (!embedModel) throw new Error('AI not initialized');
    const result = await embedModel.embedContent(text);
    return result.embedding.values;
}

module.exports = { initAI, generateResponse, getEmbedding };
