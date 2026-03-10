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

            // Set corpus label if available
            if (data.tenant.corpus_name) {
                const badge = document.getElementById('corpusBadge');
                badge.textContent = `Corpus ID: ${data.tenant.corpus_name.split('/').pop()}`;
                badge.title = data.tenant.corpus_name;
                badge.hidden = false;
            }

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

            if (data.tenant.corpus_name) {
                const corpusId = data.tenant.corpus_name.split('/').pop();
                document.getElementById('statCorpus').textContent = corpusId;
                document.getElementById('statCorpus').title = data.tenant.corpus_name;
            } else {
                document.getElementById('statCorpus').textContent = 'Chưa tạo';
            }

            if (data.fbConnected) {
                document.getElementById('statFb').textContent = '✅ Đã kết nối';
                document.getElementById('statFbName').textContent = data.fbPageName;
            } else {
                document.getElementById('statFb').textContent = '❌ Chưa kết nối';
                document.getElementById('statFbName').textContent = '';
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

            document.getElementById('setBotName').value = data.settings.bot_name || '';
            document.getElementById('setSystemPrompt').value = data.settings.system_prompt || '';
            document.getElementById('setTopicWhitelist').value = data.settings.topic_whitelist || '';
            document.getElementById('setBlockCompetitors').checked = !!data.settings.block_competitors;
            document.getElementById('setRestrictPayment').checked = !!data.settings.restrict_payment;

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
                    topic_whitelist: document.getElementById('setTopicWhitelist').value,
                    block_competitors: document.getElementById('setBlockCompetitors').checked ? 1 : 0,
                    restrict_payment: document.getElementById('setRestrictPayment').checked ? 1 : 0,
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

    // ═══════════════════════════════════════════════════
    // F01: NOTIFICATIONS
    // ═══════════════════════════════════════════════════
    const notifBell = document.getElementById('notifBell');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifBadge = document.getElementById('notifBadge');
    const notifList = document.getElementById('notifList');
    const livechatBadge = document.getElementById('livechatBadge');

    notifBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.hidden = !notifDropdown.hidden;
        if (!notifDropdown.hidden) loadNotifications();
    });

    document.addEventListener('click', () => { notifDropdown.hidden = true; });
    notifDropdown.addEventListener('click', (e) => e.stopPropagation());

    async function loadNotifications() {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();

            // Update badge
            if (data.unreadCount > 0) {
                notifBadge.textContent = data.unreadCount;
                notifBadge.hidden = false;
                livechatBadge.textContent = data.unreadCount;
                livechatBadge.hidden = false;
            } else {
                notifBadge.hidden = true;
                livechatBadge.hidden = true;
            }

            // Render list
            if (data.notifications.length === 0) {
                notifList.innerHTML = '<p class="notif-empty">Không có thông báo</p>';
                return;
            }

            notifList.innerHTML = data.notifications.map(n => `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-conv="${n.conversation_id || ''}">
                    <div>
                        <div class="notif-item-title">${n.title || n.type}</div>
                        <div class="notif-item-body">${n.body || ''}</div>
                        <div class="notif-item-time">${new Date(n.created_at + 'Z').toLocaleString('vi-VN')}</div>
                    </div>
                </div>
            `).join('');

            // Click notification → mark read + go to livechat
            notifList.querySelectorAll('.notif-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const id = item.dataset.id;
                    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
                    loadNotifications();

                    // Navigate to Live Chat if has conversation
                    if (item.dataset.conv) {
                        document.querySelector('[data-page="livechat"]').click();
                        setTimeout(() => selectConversation(item.dataset.conv), 300);
                    }
                });
            });
        } catch (e) {
            console.error('Notifications error:', e);
        }
    }

    // Poll notifications every 10s
    setInterval(loadNotifications, 10000);

    // ═══════════════════════════════════════════════════
    // F01: LIVE CHAT
    // ═══════════════════════════════════════════════════
    let selectedConvId = null;
    let lcRefreshTimer = null;

    async function loadConversations() {
        try {
            const res = await fetch('/api/conversations');
            const convs = await res.json();
            const list = document.getElementById('convList');

            if (convs.length === 0) {
                list.innerHTML = '<p class="conv-empty">Chưa có cuộc hội thoại nào</p>';
                return;
            }

            list.innerHTML = convs.map(c => `
                <div class="conv-item ${c.id === selectedConvId ? 'active' : ''}" data-id="${c.id}">
                    <div class="conv-avatar">💬</div>
                    <div class="conv-info">
                        <div class="conv-name">
                            <span>${c.sender_name || c.sender_id}</span>
                            <span class="conv-mode ${c.mode}">${c.mode}</span>
                        </div>
                        <div class="conv-preview">${c.last_message?.content?.substring(0, 50) || 'Chưa có tin nhắn'}</div>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.conv-item').forEach(item => {
                item.addEventListener('click', () => selectConversation(item.dataset.id));
            });
        } catch (e) {
            console.error('Load conversations error:', e);
        }
    }

    async function selectConversation(convId) {
        selectedConvId = convId;
        loadConversations(); // refresh active state

        try {
            const [convRes, msgRes] = await Promise.all([
                fetch(`/api/conversations`),
                fetch(`/api/conversations/${convId}/messages`)
            ]);
            const convs = await convRes.json();
            const msgs = await msgRes.json();
            const conv = convs.find(c => c.id === convId);

            if (!conv) return;

            // Update header
            document.getElementById('lcGuestName').textContent = conv.sender_name || conv.sender_id;
            const badge = document.getElementById('lcModeBadge');
            badge.textContent = conv.mode;
            badge.className = 'livechat-mode-badge';
            badge.style.background = conv.mode === 'human' ? 'rgba(248,81,73,0.15)' : 'rgba(63,185,80,0.15)';
            badge.style.color = conv.mode === 'human' ? 'var(--color-danger)' : 'var(--color-success)';

            // Show actions
            const actions = document.getElementById('lcActions');
            actions.hidden = false;
            const toggleBtn = document.getElementById('lcToggleMode');
            toggleBtn.textContent = conv.mode === 'human' ? '🔄 Chuyển về AI' : '👤 Tiếp quản';
            toggleBtn.onclick = () => toggleConvMode(convId, conv.mode === 'human' ? 'ai' : 'human');

            // Show reply form
            document.getElementById('lcReplyForm').hidden = false;

            // Render messages
            const msgContainer = document.getElementById('lcMessages');
            if (msgs.length === 0) {
                msgContainer.innerHTML = '<div class="livechat-placeholder">Chưa có tin nhắn</div>';
            } else {
                msgContainer.innerHTML = msgs.map(m => {
                    const label = m.sender_type === 'guest' ? 'Khách' : m.sender_type === 'ai' ? 'AI' : 'Nhân viên';
                    return `<div class="lc-msg ${m.sender_type}"><div class="lc-msg-label">${label}</div>${m.content}</div>`;
                }).join('');
                msgContainer.scrollTop = msgContainer.scrollHeight;
            }

            // Auto-refresh messages every 5s
            clearInterval(lcRefreshTimer);
            lcRefreshTimer = setInterval(() => {
                if (selectedConvId === convId) selectConversation(convId);
            }, 5000);
        } catch (e) {
            console.error('Select conversation error:', e);
        }
    }

    async function toggleConvMode(convId, newMode) {
        try {
            await fetch(`/api/conversations/${convId}/mode`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: newMode }),
            });
            selectConversation(convId);
            loadConversations();
        } catch (e) {
            alert('Lỗi khi chuyển mode');
        }
    }

    // Reply form
    document.getElementById('lcReplyForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('lcReplyInput');
        const msg = input.value.trim();
        if (!msg || !selectedConvId) return;

        input.value = '';
        try {
            await fetch(`/api/conversations/${selectedConvId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg }),
            });
            selectConversation(selectedConvId);
        } catch (e) {
            alert('Lỗi khi gửi tin nhắn');
        }
    });

    // Search conversations
    document.getElementById('convSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.conv-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(q) ? '' : 'none';
        });
    });

    // ═══════════════════════════════════════════════════
    // F02: UPGRADE / PAYMENT
    // ═══════════════════════════════════════════════════
    let currentOrderId = null;
    let paymentPollTimer = null;
    let countdownTimer = null;

    async function loadPlans() {
        try {
            const res = await fetch('/api/plans');
            const plans = await res.json();
            const grid = document.getElementById('plansGrid');

            grid.innerHTML = plans.map(plan => {
                const isCurrent = currentTenant?.plan === plan.id;
                const isRecommended = plan.id === 'basic';
                const canUpgrade = !isCurrent && plan.price > 0;

                return `
                    <div class="plan-card ${isCurrent ? 'current' : ''} ${isRecommended ? 'recommended' : ''}">
                        <div class="plan-name">${plan.name}</div>
                        <div class="plan-price">${plan.price === 0 ? 'Miễn phí' : plan.price.toLocaleString('vi-VN') + '₫'}</div>
                        <div class="plan-price-period">${plan.price > 0 ? '/tháng' : ''}</div>
                        <ul class="plan-features">
                            <li><strong>${plan.token_limit.toLocaleString()}</strong> tokens</li>
                            ${plan.features && plan.features.length > 0
                        ? plan.features.map(f => `<li>${f}</li>`).join('')
                        : `<li>Hạn mức: ${plan.doc_limit === -1 ? 'Không giới hạn' : plan.doc_limit} tài liệu</li>`
                    }
                        </ul>
                        ${isCurrent
                        ? '<button class="plan-btn current-plan">Gói hiện tại</button>'
                        : canUpgrade
                            ? `<button class="plan-btn upgrade" onclick="createOrder('${plan.id}')">Nâng cấp →</button>`
                            : '<button class="plan-btn current-plan">—</button>'
                    }
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Load plans error:', e);
        }
    }

    window.createOrder = async function (plan) {
        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan }),
            });
            const order = await res.json();

            if (!res.ok) {
                alert('❌ ' + order.error);
                return;
            }

            currentOrderId = order.id;

            // Show payment modal
            document.getElementById('paymentQR').src = order.qr_url;
            document.getElementById('payBankName').textContent = order.bank_name;
            document.getElementById('payBankAccount').textContent = order.bank_account;
            document.getElementById('payAccountName').textContent = order.account_name;
            document.getElementById('payAmount').textContent = order.amount.toLocaleString('vi-VN') + '₫';
            document.getElementById('payContent').textContent = order.transfer_content;
            document.getElementById('payStatus').innerHTML = '<div class="payment-polling">⏳ Đang chờ thanh toán...</div>';
            document.getElementById('paymentModal').hidden = false;

            // Start countdown
            startCountdown(order.expires_at);

            // Start polling for payment
            startPaymentPolling(order.id);
        } catch (e) {
            alert('❌ Lỗi tạo đơn hàng');
        }
    };

    function startCountdown(expiresAt) {
        clearInterval(countdownTimer);
        const expiry = new Date(expiresAt).getTime();

        countdownTimer = setInterval(() => {
            const now = Date.now();
            const diff = Math.max(0, expiry - now);
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            document.getElementById('payCountdown').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (diff <= 0) {
                clearInterval(countdownTimer);
                document.getElementById('payStatus').innerHTML = '<div class="payment-polling" style="color:var(--color-danger)">⏰ Đơn hàng đã hết hạn</div>';
                clearInterval(paymentPollTimer);
            }
        }, 1000);
    }

    function startPaymentPolling(orderId) {
        clearInterval(paymentPollTimer);
        paymentPollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/api/orders/${orderId}`);
                const order = await res.json();

                if (order.status === 'paid') {
                    clearInterval(paymentPollTimer);
                    clearInterval(countdownTimer);
                    document.getElementById('payStatus').innerHTML = '<div class="payment-success">🎉 Thanh toán thành công! Plan đã được nâng cấp.</div>';

                    // Refresh data
                    setTimeout(() => {
                        document.getElementById('paymentModal').hidden = true;
                        checkAuth();
                        loadPlans();
                        loadOrders();
                    }, 2000);
                }
            } catch (e) {
                // ignore polling errors
            }
        }, 5000);
    }

    // Close modal
    document.getElementById('closePaymentModal').addEventListener('click', () => {
        document.getElementById('paymentModal').hidden = true;
        clearInterval(paymentPollTimer);
        clearInterval(countdownTimer);
    });

    // Copy transfer content
    document.getElementById('copyContent').addEventListener('click', () => {
        const content = document.getElementById('payContent').textContent;
        navigator.clipboard.writeText(content).then(() => {
            document.getElementById('copyContent').textContent = '✅';
            setTimeout(() => { document.getElementById('copyContent').textContent = '📋'; }, 1500);
        });
    });

    async function loadOrders() {
        try {
            const res = await fetch('/api/orders');
            const orders = await res.json();
            const container = document.getElementById('orderHistory');

            if (orders.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);padding:16px">Chưa có đơn hàng nào</p>';
                return;
            }

            container.innerHTML = orders.map(o => `
                <div class="order-item">
                    <div>
                        <strong>${o.id}</strong> — ${o.plan.toUpperCase()}
                        <span style="color:var(--text-muted);margin-left:8px">${o.amount.toLocaleString('vi-VN')}₫</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <span style="color:var(--text-muted)">${new Date(o.created_at + 'Z').toLocaleDateString('vi-VN')}</span>
                        <span class="order-status ${o.status}">${o.status}</span>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            console.error('Load orders error:', e);
        }
    }

    // ─── Load on page switch ───
    const origNavClick = document.querySelectorAll('.nav-item');
    origNavClick.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page === 'livechat') loadConversations();
            if (page === 'upgrade') { loadPlans(); loadOrders(); }
        });
    });

    // Init
    checkAuth();
    setTimeout(loadNotifications, 2000);
})();
