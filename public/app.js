/* ─── Hotel Chatbot Admin - Frontend Logic ───────────── */

// ─── Tab Navigation ─────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tabName) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

// ─── Dashboard ──────────────────────────────────────────
async function loadStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        document.getElementById('stat-docs').textContent = data.knowledgeBase?.totalDocuments || 0;
        document.getElementById('stat-chunks').textContent = data.knowledgeBase?.totalChunks || 0;

        // AI Status
        const aiEl = document.getElementById('stat-ai');
        aiEl.textContent = data.ai?.configured ? '✅ Active' : '❌ Off';

        // FB Status
        const fbEl = document.getElementById('stat-fb');
        fbEl.textContent = data.facebook?.configured ? '✅ Connected' : '❌ Off';

        // Webhook URL
        document.getElementById('webhook-url').textContent = data.webhookUrl || 'N/A';

        // Server status
        const statusBadge = document.getElementById('server-status');
        const dot = statusBadge.querySelector('.status-dot');
        const label = statusBadge.querySelector('span');
        dot.classList.add('online');
        label.textContent = 'Server Online';

        // Config status in settings
        document.getElementById('cfg-gemini').textContent = data.ai?.configured ? '✅ Đã cấu hình' : '❌ Chưa cấu hình';
        document.getElementById('cfg-gemini').className = `config-badge ${data.ai?.configured ? 'ok' : 'missing'}`;

        document.getElementById('cfg-fb-token').textContent = data.facebook?.configured ? '✅ Đã cấu hình' : '❌ Chưa cấu hình';
        document.getElementById('cfg-fb-token').className = `config-badge ${data.facebook?.configured ? 'ok' : 'missing'}`;

        document.getElementById('cfg-fb-secret').textContent = '—';
        document.getElementById('cfg-fb-secret').className = 'config-badge';

    } catch (err) {
        console.error('Failed to load status:', err);
        const dot = document.querySelector('.status-dot');
        dot.classList.add('offline');
        dot.classList.remove('online');
        document.querySelector('.status-badge span').textContent = 'Server Offline';
    }
}

function copyWebhookUrl() {
    const url = document.getElementById('webhook-url').textContent;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Đã copy webhook URL!', 'success');
    });
}

// ─── Knowledge Base ─────────────────────────────────────
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
    fileInput.value = '';
});

async function uploadFile(file) {
    const progress = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    const uploadZoneEl = document.getElementById('upload-zone');

    uploadZoneEl.style.display = 'none';
    progress.style.display = 'block';
    progressText.textContent = `Đang xử lý: ${file.name}...`;

    try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (data.success) {
            showToast(`✅ Upload thành công: ${file.name} (${data.document.chunks} chunks)`, 'success');
            await loadDocuments();
            await loadStatus();
        } else {
            showToast(`❌ Lỗi: ${data.error}`, 'error');
        }
    } catch (err) {
        showToast(`❌ Upload thất bại: ${err.message}`, 'error');
    } finally {
        progress.style.display = 'none';
        uploadZoneEl.style.display = 'flex';
    }
}

async function loadDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        const list = document.getElementById('document-list');
        const count = document.getElementById('doc-count');

        count.textContent = data.documents.length;

        if (data.documents.length === 0) {
            list.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <p>Chưa có tài liệu nào. Upload tài liệu để bắt đầu.</p>
        </div>`;
            return;
        }

        list.innerHTML = data.documents.map(doc => {
            const icon = getFileIcon(doc.type);
            const size = formatFileSize(doc.size);
            return `
        <div class="doc-item" id="doc-${doc.id}">
          <div class="doc-info">
            <span class="doc-icon">${icon}</span>
            <div class="doc-details">
              <div class="doc-name">${doc.filename}</div>
              <div class="doc-meta">${size} • ${doc.chunks} chunks • ${formatDate(doc.uploadedAt)}</div>
            </div>
          </div>
          <button class="doc-delete" onclick="deleteDocument('${doc.id}')" title="Xóa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;
        }).join('');

    } catch (err) {
        console.error('Failed to load documents:', err);
    }
}

async function deleteDocument(docId) {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;

    try {
        const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        const data = await res.json();

        if (data.success) {
            showToast(`🗑️ Đã xóa: ${data.removed.filename}`, 'info');
            await loadDocuments();
            await loadStatus();
        } else {
            showToast(`❌ Lỗi: ${data.error}`, 'error');
        }
    } catch (err) {
        showToast(`❌ Xóa thất bại: ${err.message}`, 'error');
    }
}

// ─── Chat Test ──────────────────────────────────────────
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

let isSendingMessage = false;

if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Check for common IME composition issue
        // But note: most browsers don't fire submit during composition, 
        // but we add guards inside sendChatMessage just in case.
        sendChatMessage();
    });
}

async function sendChatMessage() {
    if (isSendingMessage) return;

    const message = chatInput.value.trim();
    if (!message) return;

    isSendingMessage = true;

    try {
        // Add user message
        appendMessage(message, 'user');
        chatInput.value = '';

        // Show typing indicator
        const typingEl = appendTypingIndicator();

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        });

        const data = await res.json();

        // Remove typing indicator
        typingEl.remove();

        if (data.reply) {
            appendMessage(data.reply, 'bot');
        } else {
            appendMessage(`Lỗi: ${data.error}`, 'bot');
        }
    } catch (err) {
        showToast(`Lỗi kết nối: ${err.message}`, 'error');
    } finally {
        isSendingMessage = false;
    }
}

function appendMessage(text, sender) {
    const isUser = sender === 'user';
    const avatar = isUser ? '👤' : '🏨';
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    div.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <p>${escapeHtml(text)}</p>
      <span class="message-time">${time}</span>
    </div>`;

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

function appendTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message bot-message';
    div.innerHTML = `
    <div class="message-avatar">🏨</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
}

// ─── Settings ───────────────────────────────────────────
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        document.getElementById('system-prompt').value = data.systemPrompt || '';
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

async function saveSettings() {
    const systemPrompt = document.getElementById('system-prompt').value.trim();
    if (!systemPrompt) {
        showToast('System prompt không được để trống', 'error');
        return;
    }

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt }),
        });

        const data = await res.json();
        if (data.success) {
            showToast('✅ Đã lưu system prompt!', 'success');
        } else {
            showToast(`❌ Lỗi: ${data.error}`, 'error');
        }
    } catch (err) {
        showToast(`❌ Lưu thất bại: ${err.message}`, 'error');
    }
}

function resetPrompt() {
    const defaultPrompt = 'Bạn là nhân viên lễ tân khách sạn chuyên nghiệp. Hãy trả lời khách hàng một cách lịch sự, thân thiện và hữu ích. Sử dụng thông tin từ tài liệu được cung cấp để trả lời chính xác. Nếu không biết câu trả lời, hãy nói rằng bạn sẽ chuyển câu hỏi đến bộ phận phù hợp.';
    document.getElementById('system-prompt').value = defaultPrompt;
    showToast('Đã reset system prompt về mặc định', 'info');
}

// ─── Utility Functions ──────────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getFileIcon(type) {
    const icons = { '.pdf': '📕', '.txt': '📄', '.md': '📝', '.csv': '📊' };
    return icons[type] || '📄';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoStr) {
    return new Date(isoStr).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

// ─── Initialize ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadStatus();
    loadDocuments();
    loadSettings();

    // Refresh status every 30s
    setInterval(loadStatus, 30000);
});
