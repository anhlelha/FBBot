const config = require('./config');

/**
 * Send a text message via Facebook Messenger Send API
 */
async function sendMessage(recipientId, text) {
    const url = 'https://graph.facebook.com/v21.0/me/messages';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.FB_PAGE_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text },
                messaging_type: 'RESPONSE',
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('❌ FB Send API error:', data.error);
        } else {
            console.log('✅ Message sent to:', recipientId);
        }
        return data;
    } catch (error) {
        console.error('❌ Failed to send message:', error.message);
        throw error;
    }
}

/**
 * Send typing indicator to show the bot is processing
 */
async function sendTypingIndicator(recipientId, action = 'typing_on') {
    const url = 'https://graph.facebook.com/v21.0/me/messages';

    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.FB_PAGE_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
                recipient: { id: recipientId },
                sender_action: action,
            }),
        });
    } catch (error) {
        console.error('❌ Failed to send typing indicator:', error.message);
    }
}

module.exports = { sendMessage, sendTypingIndicator };
