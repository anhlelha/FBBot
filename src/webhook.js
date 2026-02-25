const express = require('express');
const config = require('./config');
const messenger = require('./messenger');
const ai = require('./ai');

const router = express.Router();

/**
 * GET /webhook - Verification endpoint
 * Facebook sends a GET request to verify the webhook URL
 */
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.FB_VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        return res.status(200).send(challenge);
    }

    console.warn('❌ Webhook verification failed. Token mismatch.');
    return res.sendStatus(403);
});

/**
 * POST /webhook - Receive message events from Facebook
 */
router.post('/', async (req, res) => {
    const body = req.body;

    // DEBUG: Log everything received
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 POST /webhook received at:', new Date().toISOString());
    console.log('📨 Body object:', body.object);
    console.log('📨 Full body:', JSON.stringify(body, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Verify this is a page subscription
    if (body.object !== 'page') {
        console.log('⚠️ Not a page event, returning 404. Object:', body.object);
        return res.sendStatus(404);
    }

    // Return 200 immediately to prevent timeout
    res.status(200).send('EVENT_RECEIVED');

    // Process each entry
    for (const entry of body.entry || []) {
        console.log('📋 Entry ID:', entry.id);
        console.log('📋 Messaging events:', (entry.messaging || []).length);
        for (const event of entry.messaging || []) {
            await handleMessageEvent(event);
        }
    }
});

/**
 * Handle individual message events
 */
async function handleMessageEvent(event) {
    const senderId = event.sender?.id;
    if (!senderId) return;

    // Handle text messages
    if (event.message?.text) {
        const userMessage = event.message.text;
        console.log(`📩 Message from ${senderId}: "${userMessage}"`);

        try {
            // Show typing indicator
            await messenger.sendTypingIndicator(senderId, 'typing_on');

            // Generate AI response
            const reply = await ai.generateResponse(userMessage);
            console.log(`🤖 Reply: "${reply.substring(0, 100)}..."`);

            // Send response
            await messenger.sendMessage(senderId, reply);

            // Turn off typing
            await messenger.sendTypingIndicator(senderId, 'typing_off');
        } catch (error) {
            console.error('❌ Error handling message:', error.message);
            try {
                await messenger.sendMessage(senderId, 'Xin lỗi, tôi gặp sự cố. Vui lòng thử lại sau.');
            } catch (sendError) {
                console.error('❌ Failed to send error message:', sendError.message);
            }
        }
    }

    // Handle attachments (images, files, etc.)
    if (event.message?.attachments) {
        try {
            await messenger.sendMessage(senderId, 'Cảm ơn bạn đã gửi file. Hiện tại tôi chỉ có thể xử lý tin nhắn văn bản. Vui lòng gõ câu hỏi của bạn.');
        } catch (error) {
            console.error('❌ Error handling attachment:', error.message);
        }
    }
}

module.exports = router;
