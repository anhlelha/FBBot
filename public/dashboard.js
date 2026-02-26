(function () {
    // ─── Auth Check ───
    let currentTenant = null;

    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            const data = await res.json();
            if (!res.ok || !data.tenant) {
                window.location.href = '/';
                return;
            }
            currentTenant = data.tenant;
            document.getElementById('userEmail').textContent = data.tenant.email;
            document.getElementById('userPlan').textContent = data.tenant.plan.toUpperCase();
            document.getElementById('userAvatar').textContent = data.tenant.name.charAt(0).toUpperCase();
            document.getElementById('tenantName').textContent = data.tenant.name;
            loadDashboard();
            loadDocuments();
            loadSettings();
        } catch (e) {
            window.location.href = '/';
        }
    }

    // ─── Navigation ───
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById('page-' + page).classList.add('active');
        });
    });

    // ─── Dashboard ───
    async function loadDashboard() {
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();

            document.getElementById('statTokens').textContent = data.tenant.tokens_used.toLocaleString();
            document.getElementById('statTokenLimit').textContent = `/ ${data.tenant.token_limit.toLocaleString()} limit`;
            document.getElementById('statDocs').textContent = data.knowledgeBase.totalDocuments;
            document.getElementById('statChunks').textContent = data.knowledgeBase.totalChunks;

            if (data.fbConnected) {
                document.getElementById('statFb').textContent = '✅ Đã kết nối';
                document.getElementById('statFbName').textContent = data.fbPageName;
            } else {
                document.getElementById('statFb').textContent = '❌ Chưa kết nối';
            }

            document.getElementById('dashSubtitle').textContent = `${data.tenant.name} — Plan: ${data.tenant.plan}`;
        } catch (e) {
            console.error('Dashboard load error:', e);
        }
    }

    // ─── Documents ───
    async function loadDocuments() {
        try {
            const res = await fetch('/api/documents');
            const docs = await res.json();
            const list = document.getElementById('docsList');

            if (docs.length === 0) {
                list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px">Chưa có tài liệu nào. Upload file để bắt đầu!</p>';
                return;
            }

            list.innerHTML = docs.map(doc => `
        <div class="doc-item" data-id="${doc.id}">
          <div class="doc-info">
            <div class="doc-icon">${doc.type === 'pdf' ? '📄' : '📝'}</div>
            <div>
              <div class="doc-name">${doc.filename}</div>
              <div class="doc-meta">${doc.chunks_count} chunks · ${(doc.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <div class="doc-actions">
            <button class="btn btn-danger" onclick="deleteDoc('${doc.id}')">Xoá</button>
          </div>
        </div>
      `).join('');
        } catch (e) {
            console.error('Docs load error:', e);
        }
    }

    window.deleteDoc = async function (id) {
        if (!confirm('Xoá tài liệu này?')) return;
        try {
            await fetch('/api/documents/' + id, { method: 'DELETE' });
            loadDocuments();
            loadDashboard();
        } catch (e) {
            alert('Lỗi khi xoá tài liệu');
        }
    };

    // ─── Upload ───
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const uploadStatus = document.getElementById('uploadStatus');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--color-primary)'; });
    uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        if (e.dataTransfer.files.length) uploadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) uploadFile(fileInput.files[0]); });

    async function uploadFile(file) {
        uploadStatus.hidden = false;
        uploadStatus.className = 'upload-status loading';
        uploadStatus.textContent = `⏳ Đang upload và xử lý "${file.name}"...`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/documents', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                uploadStatus.className = 'upload-status success';
                uploadStatus.textContent = `✅ "${data.filename}" — ${data.chunks} chunks đã được tạo`;
                loadDocuments();
                loadDashboard();
            } else {
                uploadStatus.className = 'upload-status error';
                uploadStatus.textContent = `❌ Lỗi: ${data.error}`;
            }
        } catch (e) {
            uploadStatus.className = 'upload-status error';
            uploadStatus.textContent = '❌ Lỗi kết nối server';
        }

        fileInput.value = '';
        setTimeout(() => { uploadStatus.hidden = true; }, 5000);
    }

    // ─── Chat ───
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;

        appendMsg('user', msg);
        chatInput.value = '';

        const loadingEl = appendMsg('bot loading', '⏳ Đang suy nghĩ...');

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg }),
            });
            const data = await res.json();
            loadingEl.remove();

            if (res.ok) {
                appendMsg('bot', data.reply);
            } else {
                appendMsg('bot', '❌ ' + (data.error || 'Lỗi'));
            }
        } catch (e) {
            loadingEl.remove();
            appendMsg('bot', '❌ Lỗi kết nối server');
        }
    });

    function appendMsg(cls, text) {
        const div = document.createElement('div');
        div.className = 'chat-msg ' + cls;
        div.textContent = text;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    // ─── Settings ───
    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();

            document.getElementById('setBotName').value = data.settings.bot_name;
            document.getElementById('setSystemPrompt').value = data.settings.system_prompt;

            const fbStatus = document.getElementById('fbStatus');
            if (data.fb?.page_id) {
                fbStatus.innerHTML = `<div class="fb-connected">✅ Đã kết nối: <strong>${data.fb.page_name}</strong> (${data.fb.page_id})</div>`;
            } else {
                fbStatus.innerHTML = '<div class="fb-disconnected">❌ Chưa kết nối Facebook Page</div>';
            }
        } catch (e) {
            console.error('Settings load error:', e);
        }
    }

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bot_name: document.getElementById('setBotName').value,
                    system_prompt: document.getElementById('setSystemPrompt').value,
                }),
            });
            alert('✅ Đã lưu cài đặt!');
        } catch (e) {
            alert('❌ Lỗi khi lưu');
        }
    });

    document.getElementById('connectFbBtn').addEventListener('click', async () => {
        const token = document.getElementById('setFbToken').value.trim();
        const pageId = document.getElementById('setFbPageId').value.trim();
        if (!token) return alert('Vui lòng nhập Page Access Token');

        try {
            const res = await fetch('/api/fb-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page_access_token: token, page_id: pageId || null }),
            });
            const data = await res.json();

            if (res.ok) {
                alert(`✅ Đã kết nối: ${data.page_name} (${data.page_id})`);
                loadSettings();
                loadDashboard();
            } else {
                alert('❌ ' + data.error);
            }
        } catch (e) {
            alert('❌ Lỗi kết nối');
        }
    });

    // ─── Logout ───
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    });

    // Init
    checkAuth();
})();
