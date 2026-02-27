(function () {
    // Platform Chat Widget for AI4All
    // Created as a replacement for the deprecated FB Chat Plugin

    const styles = `
        #platform-chat-widget {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        #platform-chat-button {
            width: 60px;
            height: 60px;
            border-radius: 30px;
            background: #f97316;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            color: white;
        }
        #platform-chat-button:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
        }
        #platform-chat-window {
            position: absolute;
            bottom: 80px;
            right: 0;
            width: 360px;
            height: 500px;
            background: #111;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            box-shadow: 0 12px 24px rgba(0,0,0,0.5);
            display: none;
            flex-direction: column;
            overflow: hidden;
            animation: chatSlideUp 0.3s ease-out;
        }
        @keyframes chatSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .chat-header {
            padding: 16px;
            background: #1a1a1a;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .chat-header-info h4 {
            margin: 0; color: #fff; font-size: 15px; font-weight: 600;
        }
        .chat-header-info p {
            margin: 0; color: #888; font-size: 12px;
        }
        .chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #0a0a0a;
        }
        .chat-message {
            max-width: 85%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 14px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .message-bot {
            align-self: flex-start;
            background: #222;
            color: #eee;
            border-bottom-left-radius: 2px;
        }
        .message-user {
            align-self: flex-end;
            background: #f97316;
            color: white;
            border-bottom-right-radius: 2px;
        }
        .chat-input-area {
            padding: 16px;
            background: #1a1a1a;
            border-top: 1px solid rgba(255,255,255,0.05);
            display: flex;
            gap: 8px;
        }
        .chat-input {
            flex: 1;
            background: #222;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px;
            padding: 8px 16px;
            color: white;
            font-size: 14px;
            outline: none;
        }
        .chat-send {
            background: #f97316;
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .typing-indicator {
            font-size: 12px; color: #666; font-style: italic; margin-bottom: 4px; display: none;
        }
    `;

    // Inject Styles
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // Create HTML structure
    const widget = document.createElement('div');
    widget.id = 'platform-chat-widget';
    widget.innerHTML = `
        <div id="platform-chat-window">
            <div class="chat-header">
                <div style="width:10px;height:10px;background:#22c55e;border-radius:50%"></div>
                <div class="chat-header-info">
                    <h4>AI4All Assistant</h4>
                    <p>Luôn sẵn sàng hỗ trợ bạn</p>
                </div>
                <button id="close-chat" style="margin-left:auto;background:none;border:none;color:#555;cursor:pointer;font-size:20px">&times;</button>
            </div>
            <div class="chat-messages" id="chat-messages">
                <div class="chat-message message-bot">Xin chào! Tôi là trợ lý ảo của AI4All. Tôi có thể giúp gì cho bạn về bảng giá hoặc tính năng của nền tảng?</div>
            </div>
            <div id="typing" class="typing-indicator" style="padding: 0 16px">AI đang trả lời...</div>
            <div class="chat-input-area">
                <input type="text" class="chat-input" id="chat-input" placeholder="Nhập tin nhắn..." autocomplete="off">
                <button class="chat-send" id="chat-send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
        <div id="platform-chat-button">
            <svg id="chat-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        </div>
    `;
    document.body.appendChild(widget);

    const btn = document.getElementById('platform-chat-button');
    const win = document.getElementById('platform-chat-window');
    const close = document.getElementById('close-chat');
    const input = document.getElementById('chat-input');
    const send = document.getElementById('chat-send');
    const messages = document.getElementById('chat-messages');
    const typing = document.getElementById('typing');

    let isOpen = false;

    btn.onclick = () => {
        isOpen = !isOpen;
        win.style.display = isOpen ? 'flex' : 'none';
        if (isOpen) input.focus();
    };

    close.onclick = (e) => {
        e.stopPropagation();
        isOpen = false;
        win.style.display = 'none';
    };

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        addMessage(text, 'user');

        typing.style.display = 'block';
        messages.scrollTop = messages.scrollHeight;

        try {
            const res = await fetch('/api/platform/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            typing.style.display = 'none';

            if (res.ok) {
                addMessage(data.reply, 'bot');
            } else {
                addMessage('Xin lỗi, tôi gặp chút sự cố kỹ thuật. Vui lòng thử lại sau.', 'bot');
            }
        } catch (err) {
            typing.style.display = 'none';
            addMessage('Không thể kết nối máy chủ.', 'bot');
        }
    }

    function addMessage(text, side) {
        const div = document.createElement('div');
        div.className = `chat-message message-${side}`;
        div.innerText = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    }

    send.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

})();
