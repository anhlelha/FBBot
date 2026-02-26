const config = require('./config');

async function sendMessage(recipientId, text, pageAccessToken) {
    const url = 'https://graph.facebook.com/v21.0/me/messages';
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pageAccessToken}`,
            },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text },
                messaging_type: 'RESPONSE',
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('❌ Messenger API error:', error);
            throw new Error(error.error?.message || 'Failed to send message');
        }

        return await response.json();
    } catch (error) {
        console.error('❌ Failed to send message:', error.message);
        throw error;
    }
}

async function sendTypingIndicator(recipientId, action, pageAccessToken) {
    const url = 'https://graph.facebook.com/v21.0/me/messages';
    try {
        await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pageAccessToken}`,
            },
            body: JSON.stringify({
                recipient: { id: recipientId },
                sender_action: action,
            }),
        });
    } catch (error) {
        console.error('⚠️ Typing indicator error:', error.message);
    }
}

async function getPageInfo(pageAccessToken) {
    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${pageAccessToken}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Invalid token');
        }
        return await response.json();
    } catch (error) {
        console.error('❌ Failed to get page info:', error.message);
        throw error;
    }
}

module.exports = { sendMessage, sendTypingIndicator, getPageInfo };
