const express = require('express');
const config = require('./config');
const messenger = require('./messenger');
const tenantManager = require('./tenantManager');

const router = express.Router();

// Webhook verification (GET)
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.FB_VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
    }

    console.warn('⚠️ Webhook verification failed');
    res.sendStatus(403);
});

// Webhook events (POST) — single endpoint, route by page_id
router.post('/', async (req, res) => {
    const body = req.body;

    if (body.object !== 'page') {
        return res.sendStatus(404);
    }

    // Respond immediately to FB (avoid timeout)
    res.sendStatus(200);

    for (const entry of body.entry || []) {
        const pageId = entry.id;

        // Lookup tenant by page_id
        const tenantFb = tenantManager.getTenantByPageId(pageId);
        if (!tenantFb) {
            console.warn(`⚠️ No tenant found for page_id: ${pageId}`);
            continue;
        }

        for (const event of entry.messaging || []) {
            await handleMessageEvent(event, tenantFb);
        }
    }
});

async function handleMessageEvent(event, tenantFb) {
    const senderId = event.sender?.id;
    if (!senderId) return;

    // Skip echo messages
    if (event.message?.is_echo) return;

    const token = tenantFb.page_access_token;

    if (event.message?.text) {
        const userMessage = event.message.text;
        const tenantId = tenantFb.tenant_id;

        console.log(`💬 [${tenantFb.name}] Message from ${senderId}: ${userMessage.substring(0, 50)}...`);

        try {
            await messenger.sendTypingIndicator(senderId, 'typing_on', token);

            const reply = await tenantManager.generateResponseForTenant(tenantId, userMessage);

            await messenger.sendMessage(senderId, reply, token);
            await messenger.sendTypingIndicator(senderId, 'typing_off', token);

            console.log(`✅ [${tenantFb.name}] Reply sent to ${senderId}`);
        } catch (error) {
            console.error(`❌ [${tenantFb.name}] Error handling message:`, error.message);
            try {
                await messenger.sendMessage(senderId, 'Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.', token);
            } catch (e) {
                // ignore send error
            }
        }
    }
}

module.exports = router;
