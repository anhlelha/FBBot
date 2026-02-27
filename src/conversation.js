const config = require('./config');
const { conversations, messages, notifications } = require('./database');
const messenger = require('./messenger');

function detectHandoff(messageText) {
    const lower = messageText.toLowerCase();
    for (const keyword of config.HANDOFF_KEYWORDS) {
        if (lower.includes(keyword)) {
            return keyword;
        }
    }
    return null;
}

function checkAIHandoff(aiResponse) {
    return aiResponse.includes('[HANDOFF]');
}

function cleanHandoffResponse(aiResponse) {
    return aiResponse.replace('[HANDOFF]', '').trim();
}

function triggerHandoff(conversationId, tenantId, reason, senderName) {
    conversations.updateMode(conversationId, 'human', reason);

    notifications.create(
        tenantId,
        'handoff',
        '🔔 Khách yêu cầu hỗ trợ',
        `${senderName || 'Khách hàng'}: "${reason}"`,
        conversationId
    );

    console.log(`🔄 [Hand-off] Conversation ${conversationId} → human mode (${reason})`);
}

function saveMessage(conversationId, senderType, content) {
    conversations.touchLastMessage(conversationId);
    return messages.create(conversationId, senderType, content);
}

async function sendHumanReply(conversationId, content, pageAccessToken) {
    const conv = conversations.getById(conversationId);
    if (!conv) throw new Error('Conversation not found');

    await messenger.sendMessage(conv.sender_id, content, pageAccessToken);
    saveMessage(conversationId, 'human', content);

    return { ok: true };
}

module.exports = {
    detectHandoff,
    checkAIHandoff,
    cleanHandoffResponse,
    triggerHandoff,
    saveMessage,
    sendHumanReply,
};
