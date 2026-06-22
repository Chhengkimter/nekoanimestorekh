/**
 * userpage.js — Neko Animestore User Account Page
 * API base: /api
 * Endpoints used:
 *   GET    /api/users/me               — profile
 *   GET    /api/orders/history         — order list
 *   PATCH  /api/orders/:id/address     — update address/phone on unshipped order
 *   PUT    /api/users/me               — update profile fields (email, phone)
 *   POST   /api/auth/change-password   — change password with old password
 *   POST   /api/auth/logout            — sign out
 */

function getToken() { return localStorage.getItem('neko_token'); }

/* ── STATE ───────────────────────────────────────────────── */
let profile      = null;
let orders       = [];
let orderTab     = 'all';
let addrEditId   = null;   // order id currently being edited in addr modal
let editMode     = null;   // 'email' | 'phone' | 'telegram' | 'password-current' | 'password-telegram'

/* ── FETCH HELPER ────────────────────────────────────────── */
// ✅ Fix — sends JWT token from localStorage
async function apiFetch(path, opts = {}) {
    const token = getToken();
    const res = await fetch(API + path, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(opts.headers || {})
        }
    });
    if (res.status === 401) {
        localStorage.removeItem('neko_token');
        localStorage.removeItem('neko_user');
        localStorage.removeItem('neko_role');
        window.location.href = 'login.html';
        throw new Error('Unauthenticated');
    }
    return res;
}

/* ── INIT ────────────────────────────────────────────────── */
async function init() {
    await Promise.all([loadProfile(), loadOrders()]);
}

/* ── PROFILE ─────────────────────────────────────────────── */
async function loadProfile() {
    try {
        const res = await apiFetch('/users/me');
        if (!res.ok) throw new Error();
        profile = await res.json();
        renderProfile();
    } catch {
        showToast('Could not load profile', true);
    }
}

function renderProfile() {
    if (!profile) return;

    const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'User';
    const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

    document.getElementById('sidebar-initials').textContent = initials;
    document.getElementById('sidebar-name').textContent     = name;
    document.getElementById('sidebar-id').textContent       = `#NEKO-${String(profile.user_id).padStart(6, '0')}`;

    document.getElementById('s-user-id').textContent  = `#NEKO-${String(profile.user_id).padStart(6, '0')}`;
    document.getElementById('s-username').textContent = name;
    document.getElementById('s-email').textContent    = profile.email || '—';
    document.getElementById('s-phone').textContent    = profile.phone_number || 'Not set';

    // Hide Telegram row until you add telegram_id column to users table
    const tgRow = document.getElementById('s-telegram')?.closest('.setting-row');
    if (tgRow) tgRow.style.display = 'none';
}

/* ── ORDERS ──────────────────────────────────────────────── */
async function loadOrders() {
    try {
        const res = await apiFetch('/orders/history');
        if (!res.ok) throw new Error();
        orders = await res.json();
        renderOrders();
    } catch {
        document.getElementById('orders-list').innerHTML =
            `<div class="up-empty"><i class="fas fa-exclamation-circle"></i><p>Could not load orders. Please refresh.</p></div>`;
    }
}

function setOrderTab(btn) {
    document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    orderTab = btn.dataset.status;
    renderOrders();
}

function renderOrders() {
    const list = document.getElementById('orders-list');

    const filtered = orderTab === 'all'
        ? orders
        : orders.filter(o => o.order_status === orderTab);

    if (!filtered.length) {
        list.innerHTML = `<div class="up-empty">
            <i class="fas fa-box-open"></i>
            <p>${orderTab === 'all' ? "You haven't placed any orders yet." : 'No orders in this category.'}</p>
        </div>`;
        return;
    }

    list.innerHTML = filtered.map(o => renderOrderCard(o)).join('');
}

function renderOrderCard(o) {
    const statusMap = {
        pending:   { label: 'Awaiting confirmation', cls: 'badge-purple' },
        confirmed: { label: 'Confirmed',             cls: 'badge-blue'   },
        shipped:   { label: 'Shipped',               cls: 'badge-blue'   },
        delivered: { label: 'Delivered',             cls: 'badge-green'  },
        cancelled: { label: 'Cancelled',             cls: 'badge-red'    },
    };
    const s = statusMap[o.order_status] || { label: o.order_status, cls: 'badge-amber' };

    const date = o.order_date ? new Date(o.order_date).toLocaleDateString() : '';
    const total = o.total != null ? `$${Number(o.total).toFixed(2)}` : '—';
    const units = o.total_units || o.total_lines || '';
    const itemsLine = units ? `${units} item${units !== 1 ? 's' : ''}` : '';

    // Whether the customer can still edit address/phone (not yet shipped)
    const canEdit = ['pending', 'confirmed'].includes(o.order_status);

    const awaitingBanner = o.order_status === 'pending' ? `
        <div class="awaiting-pay-banner">
            <i class="fas fa-clock"></i>
            Waiting for our team to confirm your order.
        </div>` : '';

    // Per-order ship notification for confirmed orders
    const shipNotifRow = o.order_status === 'confirmed' ? `
        <div class="order-ship-notif">
            <span><i class="fas fa-bell" style="margin-right:5px"></i> Notify me when shipped</span>
            <label class="up-toggle" title="Shipping notification for this order">
                <input type="checkbox" checked onchange="saveOrderNotif(${o.order_id}, this.checked)">
                <span class="up-toggle-track"></span>
            </label>
        </div>` : '';

    const actionsHtml = canEdit ? `
        <div class="order-actions">
            <button class="order-act-btn" onclick="openAddrModal(${o.order_id}, '${o.order_code}')">
                <i class="fas fa-map-marker-alt"></i> Update address / phone
            </button>
        </div>` : (o.order_status === 'shipped' || o.order_status === 'delivered') ? `
        <div class="order-locked-note">
            <i class="fas fa-lock"></i> Order ${o.order_status} — contact us to make changes
        </div>` : '';

    return `<div class="order-card">
        ${awaitingBanner}
        <div class="order-top">
            <span class="order-code">${o.order_code}</span>
            <span class="badge ${s.cls}">${s.label}</span>
        </div>
        <div class="order-items-preview">${itemsLine}</div>
        <div class="order-footer">
            <span class="order-total">${total}</span>
            <span class="order-date">${date}</span>
        </div>
        ${shipNotifRow}
        ${actionsHtml}
    </div>`;
}

/* ── GLOBAL SHIP NOTIFICATION ────────────────────────────── */
async function saveNotifPref(enabled) {
    try {
        await apiFetch('/users/me/notifications', {
            method: 'PATCH',
            body: JSON.stringify({ shipNotifications: enabled })
        });
        showToast(enabled ? 'Shipping notifications on' : 'Shipping notifications off');
    } catch {
        showToast('Could not save notification preference', true);
    }
}

/* NOTE: saveOrderNotif() is a stub — implement when you add
   per-order notification preferences to the backend */
function saveOrderNotif(orderId, enabled) {
    showToast(enabled ? 'You\'ll be notified when this order ships' : 'Notification off for this order');
}

/* ── ADDRESS / PHONE EDIT MODAL ──────────────────────────── */
function openAddrModal(orderId, orderCode) {
    addrEditId = orderId;
    document.getElementById('addr-modal-ordcode').textContent = orderCode;

    // Pre-fill from order data if available
    const o = orders.find(x => x.order_id === orderId);
    document.getElementById('addr-phone1').value    = o?.phone1 || '';
    document.getElementById('addr-line1').value     = o?.addr_line1 || '';
    document.getElementById('addr-district').value  = o?.addr_district || '';
    document.getElementById('addr-city').value      = o?.addr_city || '';
    document.getElementById('addr-landmark').value  = o?.addr_landmark || '';

    document.getElementById('addr-modal').classList.add('open');
}

function closeAddrModal() {
    document.getElementById('addr-modal').classList.remove('open');
    addrEditId = null;
}

async function saveAddrEdits() {
    if (!addrEditId) return;

    const payload = {
        phone1:       document.getElementById('addr-phone1').value.trim()    || undefined,
        addrLine1:    document.getElementById('addr-line1').value.trim()     || undefined,
        addrDistrict: document.getElementById('addr-district').value.trim()  || undefined,
        addrCity:     document.getElementById('addr-city').value.trim()      || undefined,
        addrLandmark: document.getElementById('addr-landmark').value.trim()  || undefined,
    };

    const saveBtn = document.querySelector('#addr-modal .up-btn-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
        const res = await apiFetch(`/orders/${addrEditId}/address`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(err.error || 'Could not save changes', true);
            return;
        }

        showToast('Delivery info updated ✓');
        closeAddrModal();
        await loadOrders();

    } catch {
        showToast('Could not save changes', true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
    }
}

/* ── PROFILE EDIT MODAL ──────────────────────────────────── */
function openEditModal(mode) {
    editMode = mode;
    const body   = document.getElementById('edit-modal-body');
    const footer = document.getElementById('edit-modal-footer');
    const title  = document.getElementById('edit-modal-title');
    const saveBtn = document.getElementById('edit-modal-save-btn');

    saveBtn.onclick = () => submitEditModal();

    switch (mode) {

        case 'email':
            title.textContent = 'Update email';
            body.innerHTML = `
                <div class="form-group">
                    <label>New email address</label>
                    <input type="email" id="edit-email" value="${profile?.email || ''}" placeholder="you@example.com">
                </div>
                <div class="form-group">
                    <label>Current password <span class="form-optional">(to confirm)</span></label>
                    <input type="password" id="edit-email-pwd" placeholder="••••••••">
                </div>`;
            break;

        case 'phone':
            title.textContent = 'Update phone number';
            body.innerHTML = `
                <div class="form-group">
                    <label>New phone number</label>
                    <input type="text" id="edit-phone" value="${profile?.phone_number || ''}" placeholder="+855 xx xxx xxx">
                </div>`;
            break;

        case 'telegram':
            title.textContent = profile?.telegram_id ? 'Telegram connected' : 'Connect Telegram';
            body.innerHTML = profile?.telegram_id ? `
                <p style="font-size:13px;color:#555;margin-bottom:14px">
                    Your Telegram account <strong>@${profile.telegram_username || 'unknown'}</strong> is connected.
                    Disconnecting will remove the ability to reset your password via Telegram.
                </p>
                <p style="font-size:12px;color:#aaa">To reconnect later, message @NekoAnimeBot on Telegram.</p>
            ` : `
                <p style="font-size:13px;color:#555;margin-bottom:14px">
                    To link your Telegram account, message <strong>@NekoAnimeBot</strong> on Telegram and send the command:
                </p>
                <div style="background:#f0e8fa;border-radius:8px;padding:10px 14px;font-family:monospace;font-size:13px;color:#82659D;margin-bottom:14px">
                    /connect ${profile?.user_id || 'your-user-id'}
                </div>
                <p style="font-size:12px;color:#aaa">Once linked, you can use Telegram to reset your password.</p>
            `;
            footer.innerHTML = profile?.telegram_id
                ? `<button class="up-btn-cancel" onclick="closeEditModal()">Close</button>
                   <button class="up-btn-save" style="background:#e05c7a" onclick="disconnectTelegram()">Disconnect</button>`
                : `<button class="up-btn-cancel" onclick="closeEditModal()">Close</button>`;
            document.getElementById('edit-modal').classList.add('open');
            return;

        case 'password-current':
            title.textContent = 'Change password';
            body.innerHTML = `
                <div class="form-group">
                    <label>Current password</label>
                    <input type="password" id="pwd-old" placeholder="••••••••">
                </div>
                <div class="form-group">
                    <label>New password</label>
                    <input type="password" id="pwd-new" placeholder="At least 8 characters">
                </div>
                <div class="form-group">
                    <label>Confirm new password</label>
                    <input type="password" id="pwd-confirm" placeholder="••••••••">
                </div>`;
            break;

        case 'password-telegram':
            title.textContent = 'Reset via Telegram';
            if (!profile?.telegram_id) {
                body.innerHTML = `
                    <p style="font-size:13px;color:#e05c7a">
                        <i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>
                        You haven't connected a Telegram account yet. Connect Telegram first.
                    </p>`;
                footer.innerHTML = `<button class="up-btn-cancel" onclick="closeEditModal()">Close</button>
                    <button class="up-btn-save" onclick="closeEditModal();openEditModal('telegram')">Connect Telegram</button>`;
                document.getElementById('edit-modal').classList.add('open');
                return;
            }
            body.innerHTML = `
                <p style="font-size:13px;color:#555;margin-bottom:14px">
                    We'll send a reset code to your linked Telegram account <strong>@${profile.telegram_username || ''}</strong>.
                </p>
                <div class="form-group" id="tg-code-group" style="display:none">
                    <label>Enter the code from Telegram</label>
                    <input type="text" id="tg-reset-code" placeholder="6-digit code" maxlength="6">
                </div>
                <div class="form-group" id="tg-newpwd-group" style="display:none">
                    <label>New password</label>
                    <input type="password" id="tg-new-pwd" placeholder="At least 8 characters">
                </div>
                <div class="form-group" id="tg-confirmpwd-group" style="display:none">
                    <label>Confirm new password</label>
                    <input type="password" id="tg-confirm-pwd" placeholder="••••••••">
                </div>`;
            footer.innerHTML = `
                <button class="up-btn-cancel" onclick="closeEditModal()">Cancel</button>
                <button class="up-btn-save" id="tg-send-btn" onclick="sendTelegramResetCode()">Send code</button>`;
            document.getElementById('edit-modal').classList.add('open');
            return;

        default:
            return;
    }

    // Restore default footer in case it was changed by a previous modal
    footer.innerHTML = `
        <button class="up-btn-cancel" onclick="closeEditModal()">Cancel</button>
        <button class="up-btn-save" id="edit-modal-save-btn" onclick="submitEditModal()">Save</button>`;

    document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('open');
    editMode = null;
}

async function submitEditModal() {
    const saveBtn = document.getElementById('edit-modal-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

    try {
        switch (editMode) {

            case 'email': {
                const email = document.getElementById('edit-email').value.trim();
                const pwd   = document.getElementById('edit-email-pwd').value;
                if (!email) { showToast('Enter an email address', true); return; }
                if (!pwd)   { showToast('Enter your current password to confirm', true); return; }
                const res = await apiFetch('/users/me', {
                    method: 'PUT',
                    body: JSON.stringify({ email, currentPassword: pwd })
                });
                if (!res.ok) { const e = await res.json(); showToast(e.error || 'Update failed', true); return; }
                profile.email = email;
                renderProfile();
                showToast('Email updated ✓');
                closeEditModal();
                break;
            }

            case 'phone': {
                const phone = document.getElementById('edit-phone').value.trim();
                if (!phone) { showToast('Enter a phone number', true); return; }
                const res = await apiFetch('/users/me', {
                    method: 'PUT',
                    body: JSON.stringify({ phoneNumber: phone })
                });
                if (!res.ok) { const e = await res.json(); showToast(e.error || 'Update failed', true); return; }
                profile.phone_number = phone;
                renderProfile();
                showToast('Phone number updated ✓');
                closeEditModal();
                break;
            }

            case 'password-current': {
                const oldPwd  = document.getElementById('pwd-old').value;
                const newPwd  = document.getElementById('pwd-new').value;
                const confirm = document.getElementById('pwd-confirm').value;
                if (!oldPwd)             { showToast('Enter your current password', true); return; }
                if (newPwd.length < 8)   { showToast('New password must be at least 8 characters', true); return; }
                if (newPwd !== confirm)  { showToast('Passwords do not match', true); return; }
                const res = await apiFetch('/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd })
                });
                if (!res.ok) { const e = await res.json(); showToast(e.error || 'Could not change password', true); return; }
                showToast('Password changed ✓');
                closeEditModal();
                break;
            }

            default:
                closeEditModal();
        }
    } catch {
        showToast('Something went wrong. Please try again.', true);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
    }
}

/* ── TELEGRAM RESET PASSWORD FLOW ────────────────────────── */
let tgResetStep = 'send'; // 'send' | 'verify'

async function sendTelegramResetCode() {
    const btn = document.getElementById('tg-send-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
        const res = await apiFetch('/auth/password-reset/telegram', { method: 'POST' });
        if (!res.ok) { const e = await res.json(); showToast(e.error || 'Could not send code', true); return; }

        // Show code + new password fields
        document.getElementById('tg-code-group').style.display    = 'block';
        document.getElementById('tg-newpwd-group').style.display  = 'block';
        document.getElementById('tg-confirmpwd-group').style.display = 'block';

        btn.textContent = 'Confirm reset';
        btn.onclick = confirmTelegramReset;
        showToast('Code sent to your Telegram ✓');
    } catch {
        showToast('Could not send code. Try again.', true);
    } finally {
        btn.disabled = false;
    }
}

async function confirmTelegramReset() {
    const code    = document.getElementById('tg-reset-code').value.trim();
    const newPwd  = document.getElementById('tg-new-pwd').value;
    const confirm = document.getElementById('tg-confirm-pwd').value;

    if (!code)             { showToast('Enter the code from Telegram', true); return; }
    if (newPwd.length < 8) { showToast('Password must be at least 8 characters', true); return; }
    if (newPwd !== confirm) { showToast('Passwords do not match', true); return; }

    const btn = document.getElementById('tg-send-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';

    try {
        const res = await apiFetch('/auth/password-reset/telegram/confirm', {
            method: 'POST',
            body: JSON.stringify({ code, newPassword: newPwd })
        });
        if (!res.ok) { const e = await res.json(); showToast(e.error || 'Invalid or expired code', true); return; }
        showToast('Password reset successfully ✓');
        closeEditModal();
    } catch {
        showToast('Something went wrong. Please try again.', true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm reset';
    }
}

async function disconnectTelegram() {
    try {
        const res = await apiFetch('/users/me/telegram', { method: 'DELETE' });
        if (!res.ok) { showToast('Could not disconnect Telegram', true); return; }
        profile.telegram_id = null;
        profile.telegram_username = null;
        renderProfile();
        showToast('Telegram disconnected');
        closeEditModal();
    } catch {
        showToast('Could not disconnect Telegram', true);
    }
}

/* ── PANEL SWITCHER ──────────────────────────────────────── */
function switchPanel(panel, btn) {
    document.querySelectorAll('.up-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.up-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + panel).classList.add('active');
    btn.classList.add('active');
}

/* ── LOGOUT ──────────────────────────────────────────────── */
function logout() {
    localStorage.removeItem('neko_token');
    localStorage.removeItem('neko_user');
    localStorage.removeItem('neko_role');
    window.location.href = 'login.html';
}

/* ── TOAST ───────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, err = false) {
    const el = document.getElementById('up-toast');
    el.textContent = msg;
    el.className = 'up-toast show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── CLOSE MODALS ON BACKDROP CLICK ─────────────────────── */
document.getElementById('addr-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddrModal();
});
document.getElementById('edit-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeEditModal();
});

/* ── BOOT ────────────────────────────────────────────────── */
init();