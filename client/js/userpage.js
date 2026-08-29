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
    await Promise.all([loadProfile(), loadOrders(), loadWishlist()]);
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
        confirmed: { label: 'Confirmed',             cls: 'badge-green'  },
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
        <div class="order-ship-notif" onclick="event.stopPropagation()">
            <span><i class="fas fa-bell" style="margin-right:5px"></i> Notify me when shipped</span>
            <label class="up-toggle" title="Shipping notification for this order">
                <input type="checkbox" checked onchange="saveOrderNotif(${o.order_id}, this.checked)">
                <span class="up-toggle-track"></span>
            </label>
        </div>` : '';

    let actionsHtml = '';
    if (canEdit) {
        actionsHtml = `
        <div class="order-actions">
            <button class="order-act-btn" onclick="event.stopPropagation(); openAddrModal(${o.order_id}, '${o.order_code}')">
                <i class="fas fa-map-marker-alt"></i> Update address / phone
            </button>
        </div>`;
    } else if (o.order_status === 'shipped' || o.order_status === 'delivered') {
        let shipmentTrackingHtml = '';
        if (o.tracking_number || o.shipping_company) {
            const shipDate = o.shipping_date ? new Date(o.shipping_date).toLocaleString() : 'N/A';
            shipmentTrackingHtml = `
            <div class="od-tracking-card" style="margin-top:12px;" onclick="event.stopPropagation()">
                <div class="od-section-title"><i class="fas fa-truck"></i> Shipment Tracking</div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Company</span>
                    <span class="od-tracking-value">${o.shipping_company || 'Unknown'}</span>
                </div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Tracking No</span>
                    <span class="od-tracking-value">
                        ${o.tracking_number || 'N/A'}
                        ${o.tracking_number ? `<button class="od-copy-btn" onclick="event.stopPropagation(); navigator.clipboard.writeText('${o.tracking_number}').then(()=>showToast('Tracking number copied ✓'))"><i class="fas fa-copy"></i> Copy</button>` : ''}
                    </span>
                </div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Shipped On</span>
                    <span class="od-tracking-value">${shipDate}</span>
                </div>
                ${o.shipping_image ? `<a href="${o.shipping_image}" target="_blank" onclick="event.stopPropagation();" class="od-proof-link"><i class="fas fa-image"></i> View Shipping Proof</a>` : ''}
            </div>`;
        }

        let actionButtonsHtml = '';
        if (o.order_status === 'shipped') {
            actionButtonsHtml = `
            <div class="od-actions" onclick="event.stopPropagation()">
                <button class="od-btn od-btn-success" onclick="event.stopPropagation(); markOrderReceived(${o.order_id})">
                    <i class="fas fa-box-open"></i> Package Received
                </button>
                <a href="https://t.me/NekoAnimeBot" target="_blank" onclick="event.stopPropagation();" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        }

        actionsHtml = `
        <div class="order-locked-note">
            <i class="fas fa-lock"></i> Order ${o.order_status} — contact us to make changes
        </div>
        ${shipmentTrackingHtml}
        ${actionButtonsHtml}`;
    } else if (o.order_status === 'refunded') {
        let refundTrackingHtml = '';
        if (o.refund_date || o.refund_image) {
            const rDate = o.refund_date ? new Date(o.refund_date).toLocaleString() : 'N/A';
            refundTrackingHtml = `
            <div class="od-tracking-card" style="margin-top:12px;" onclick="event.stopPropagation()">
                <div class="od-section-title"><i class="fas fa-undo-alt"></i> Refund Details</div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Refunded On</span>
                    <span class="od-tracking-value">${rDate}</span>
                </div>
                ${o.refund_image ? `<a href="${o.refund_image}" target="_blank" onclick="event.stopPropagation();" class="od-proof-link"><i class="fas fa-image"></i> View Refund Proof</a>` : ''}
            </div>`;
        }

        actionsHtml = `
        <div class="order-locked-note">
            <i class="fas fa-lock"></i> Order refunded
        </div>
        ${refundTrackingHtml}`;
    }

    return `<div class="order-card" onclick="openOrderDetailModal(${o.order_id})" style="cursor:pointer; position:relative;">
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

/* ── ORDER ACTIONS (MODIFIED / PAY) ──────────────────────── */
async function confirmOrderMod(orderId) {
    if (!confirm('Are you sure you want to confirm these changes?')) return;
    try {
        const res = await apiFetch(`/orders/${orderId}/confirm`, { method: 'POST' });
        if (!res.ok) throw new Error();
        showToast('Order confirmed ✓');
        loadOrders();
        closeOrderDetailModal();
    } catch {
        showToast('Failed to confirm order', true);
    }
}

async function cancelOrderMod(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
        const res = await apiFetch(`/orders/${orderId}/cancel`, { method: 'POST' });
        if (!res.ok) throw new Error();
        showToast('Order cancelled ✓');
        loadOrders();
        closeOrderDetailModal();
    } catch {
        showToast('Failed to cancel order', true);
    }
}

async function payOrderBalance(orderId) {
    if (!confirm('Proceed to pay the remaining balance?')) return;
    try {
        const res = await apiFetch(`/orders/${orderId}/pay-balance`, { method: 'POST' });
        if (!res.ok) throw new Error();
        showToast('Balance paid successfully ✓');
        loadOrders();
        closeOrderDetailModal();
    } catch {
        showToast('Failed to pay balance', true);
    }
}

async function markOrderReceived(orderId) {
    if (!confirm('Confirm you have received the package?')) return;
    try {
        const res = await apiFetch(`/orders/${orderId}/received`, { method: 'POST' });
        if (!res.ok) throw new Error();
        showToast('Order marked as delivered ✓');
        loadOrders();
        closeOrderDetailModal();
    } catch {
        showToast('Failed to mark received', true);
    }
}

// ── ORDER DETAIL MODAL ────────────────────────────────────
function closeOrderDetailModal() {
    const m = document.getElementById('order-detail-modal');
    if (m) {
        m.classList.remove('open');
        m.setAttribute('aria-hidden', 'true');
    }
}

async function openOrderDetailModal(orderId) {
    try {
        const res = await apiFetch(`/orders/${orderId}`);
        if (!res.ok) throw new Error('Failed to fetch order');
        const o = await res.json();
        
        const body = document.getElementById('order-detail-modal-body');
        
        // ── Status config ──
        const statusConfig = {
            pending:   { icon: 'fas fa-clock',        label: 'Awaiting confirmation',   cls: 'status-pending',   msg: 'Waiting for our team to confirm your order.' },
            confirmed: { icon: 'fas fa-check-circle', label: 'Order Confirmed',          cls: 'status-confirmed', msg: 'Your order has been confirmed and is being prepared.' },
            shipped:   { icon: 'fas fa-shipping-fast', label: 'Shipped',                 cls: 'status-shipped',   msg: 'Your package is on its way!' },
            delivered: { icon: 'fas fa-box-open',     label: 'Delivered',                cls: 'status-delivered', msg: 'Your order has been delivered. Thank you for shopping with us!' },
            cancelled: { icon: 'fas fa-times-circle', label: 'Cancelled',                cls: 'status-cancelled', msg: 'This order has been cancelled.' },
            refunded:  { icon: 'fas fa-undo',         label: 'Refunded',                 cls: 'status-cancelled', msg: 'This order has been refunded.' },
        };
        const sc = statusConfig[o.order_status] || { icon: 'fas fa-info-circle', label: o.order_status, cls: 'status-pending', msg: '' };

        // ── Admin note ──
        let adminNoteHtml = '';
        if (o.customer_note) {
            adminNoteHtml = `
            <div class="od-admin-note">
                <i class="fas fa-exclamation-triangle"></i>
                <div>
                    <div class="od-admin-note-title">Modified by Admin</div>
                    <div>${o.customer_note}</div>
                </div>
            </div>`;
        }

        // ── Items ──
        let itemsHtml = (o.items || []).map(it => {
            let reviewBtn = '';
            if (o.order_status === 'shipped' || o.order_status === 'delivered') {
                reviewBtn = `<button class="od-btn od-btn-outline" style="padding: 4px 10px; font-size: 12px; margin-top: 5px;" onclick="openReviewModal(${it.product_id})"><i class="fas fa-pen"></i> Write a review</button>`;
            }
            return `
            <div class="od-item-row" style="align-items: center;">
                <a href="productpage.html?id=${it.product_id}" style="display:block; flex-shrink:0;">
                    <img class="od-item-img" src="${it.image || 'https://via.placeholder.com/44'}" onerror="this.style.opacity=.3">
                </a>
                <div class="od-item-info" style="flex:1;">
                    <a href="productpage.html?id=${it.product_id}" class="od-item-name" style="text-decoration:none; color:var(--text); cursor:pointer; display:block;" onmouseover="this.style.color='#82659D'" onmouseout="this.style.color='var(--text)'">
                        ${it.product_name}
                    </a>
                    <div class="od-item-meta">Qty: ${it.product_quantity} &times; $${Number(it.price_at_purchase).toFixed(2)} ${it.selected_option ? `| ${it.selected_option}` : ''}</div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div class="od-item-price">$${(it.product_quantity * it.price_at_purchase).toFixed(2)}</div>
                    ${reviewBtn}
                </div>
            </div>`;
        }).join('');

        // ── Tracking card (shipped & delivered) ──
        let trackingHtml = '';
        if ((o.order_status === 'shipped' || o.order_status === 'delivered') && (o.tracking_number || o.shipping_company)) {
            const shipDate = o.shipping_date ? new Date(o.shipping_date).toLocaleString() : 'N/A';
            trackingHtml = `
            <div class="od-tracking-card">
                <div class="od-section-title"><i class="fas fa-truck"></i> Shipment Tracking</div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Delivery Company</span>
                    <span class="od-tracking-value">${o.shipping_company || 'Unknown'}</span>
                </div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Tracking No</span>
                    <span class="od-tracking-value">
                        ${o.tracking_number || 'N/A'}
                        ${o.tracking_number ? `<button class="od-copy-btn" onclick="navigator.clipboard.writeText('${o.tracking_number}').then(()=>showToast('Tracking number copied ✓'))"><i class="fas fa-copy"></i> Copy</button>` : ''}
                    </span>
                </div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Shipped On</span>
                    <span class="od-tracking-value">${shipDate}</span>
                </div>
                ${o.shipping_image ? `<a href="${o.shipping_image}" target="_blank" class="od-proof-link"><i class="fas fa-image"></i> View Shipping Proof</a>` : ''}
            </div>`;
        }
        
        let refundTrackingHtml = '';
        if (o.order_status === 'refunded' && (o.refund_date || o.refund_image)) {
            const rDate = o.refund_date ? new Date(o.refund_date).toLocaleString() : 'N/A';
            refundTrackingHtml = `
            <div class="od-tracking-card">
                <div class="od-section-title"><i class="fas fa-undo-alt"></i> Refund Details</div>
                <div class="od-tracking-row">
                    <span class="od-tracking-label">Refunded On</span>
                    <span class="od-tracking-value">${rDate}</span>
                </div>
                ${o.refund_image ? `<a href="${o.refund_image}" target="_blank" class="od-proof-link"><i class="fas fa-image"></i> View Refund Proof</a>` : ''}
            </div>`;
        }

        // ── Actions (consistent across statuses) ──
        let actionsHtml = '';
        if (o.order_status === 'pending') {
            actionsHtml = `
            <div class="od-actions">
                <button class="od-btn od-btn-outline" onclick="openAddrModal(${o.order_id}, '${o.order_code}'); closeOrderDetailModal();">
                    <i class="fas fa-map-marker-alt"></i> Update Address
                </button>
                <a href="https://t.me/NekoAnimeBot" target="_blank" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        } else if (o.order_status === 'confirmed') {
            actionsHtml = `
            <div class="od-actions">
                <button class="od-btn od-btn-outline" onclick="openAddrModal(${o.order_id}, '${o.order_code}'); closeOrderDetailModal();">
                    <i class="fas fa-map-marker-alt"></i> Update Address
                </button>
                <a href="https://t.me/NekoAnimeBot" target="_blank" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        } else if (o.order_status === 'shipped') {
            actionsHtml = `
            <div class="od-actions">
                <button class="od-btn od-btn-success" onclick="markOrderReceived(${o.order_id})">
                    <i class="fas fa-box-open"></i> Package Received
                </button>
                <a href="https://t.me/NekoAnimeBot" target="_blank" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        } else if (o.order_status === 'delivered') {
            actionsHtml = `
            <div class="od-actions">
                <a href="https://t.me/NekoAnimeBot" target="_blank" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        } else if (o.order_status === 'refunded') {
            actionsHtml = `
            <div class="od-actions">
                <a href="https://t.me/NekoAnimeBot" target="_blank" class="od-btn od-btn-telegram">
                    <i class="fab fa-telegram-plane"></i> Contact Store
                </a>
            </div>`;
        }

        body.innerHTML = `
            ${adminNoteHtml}

            <div class="od-header">
                <span class="od-code">${o.order_code}</span>
                <span class="od-date">${new Date(o.order_date).toLocaleDateString()}</span>
            </div>

            <div class="od-status-banner ${sc.cls}">
                <i class="${sc.icon}"></i>
                <span>${sc.msg}</span>
            </div>

            <div class="od-section">
                <div class="od-section-title"><i class="fas fa-shopping-bag"></i> Items</div>
                ${itemsHtml || '<p style="font-size:13px; color:#aaa;">No items found.</p>'}
                <div class="od-total-row" style="font-weight: normal; font-size: 14px; margin-top: 8px;">
                    <span>Subtotal</span>
                    <span>$${Number(o.subtotal || o.total || 0).toFixed(2)}</span>
                </div>
                ${Number(o.discount_amount) > 0 ? `
                <div class="od-total-row" style="font-weight: normal; font-size: 14px; color: #38a169;">
                    <span>Coupon ${o.coupon_code ? `(${o.coupon_code})` : ''}</span>
                    <span>-$${Number(o.discount_amount).toFixed(2)}</span>
                </div>` : ''}
                <div class="od-total-row">
                    <span>Total</span>
                    <span class="od-total-amount">$${Number(o.total || 0).toFixed(2)}</span>
                </div>
            </div>

            <div class="od-section">
                <div class="od-section-title"><i class="fas fa-map-marker-alt"></i> Delivery Address</div>
                <div class="od-detail-row"><strong>Address</strong> <span>${o.addr_line1 || '—'}${o.addr_district ? ', ' + o.addr_district : ''}${o.addr_city ? ', ' + o.addr_city : ''}</span></div>
                ${o.addr_landmark ? `<div class="od-detail-row"><strong>Landmark</strong> <span>${o.addr_landmark}</span></div>` : ''}
                <div class="od-detail-row"><strong>Phone</strong> <span>${o.phone1 || '—'}${o.phone2 ? ' / ' + o.phone2 : ''}</span></div>
            </div>

            ${trackingHtml}
            ${refundTrackingHtml}

            ${actionsHtml}
        `;

        const m = document.getElementById('order-detail-modal');
        m.classList.add('open');
        m.removeAttribute('aria-hidden');
    } catch (e) {
        showToast('Failed to load order details', true);
    }
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

/* ── WISHLIST ─────────────────────────────────────────────── */
let wishlistItems = [];

async function loadWishlist() {
    try {
        const res = await apiFetch('/wishlist');
        if (!res.ok) throw new Error();
        wishlistItems = await res.json();
        renderWishlist();
    } catch {
        const list = document.getElementById('wishlist-list');
        if (list) list.innerHTML =
            `<div class="up-empty"><i class="fas fa-exclamation-circle"></i><p>Could not load wishlist. Please refresh.</p></div>`;
    }
}

function renderWishlist() {
    const list = document.getElementById('wishlist-list');
    if (!list) return;

    if (!wishlistItems.length) {
        list.innerHTML = `<div class="up-empty">
            <i class="fas fa-heart"></i>
            <p>Your wishlist is empty.</p>
            <a href="index.html" style="color:#82659D;text-decoration:underline;font-size:14px;margin-top:8px;display:inline-block">Browse products</a>
        </div>`;
        return;
    }

    list.innerHTML = wishlistItems.map(item => {
        const price = parseFloat(item.product_price || 0);
        const originalPrice = item.original_price ? parseFloat(item.original_price) : null;
        const img = item.primary_image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg';
        
        const discountBadge = originalPrice && originalPrice > price
            ? `<span class="card-badge sale">SALE</span>` : '';

        const stockBadge = item.stock_status === 'preorder'
            ? '<span class="card-badge preorder">Pre-order</span>'
            : (item.stock_status === 'instock'
                ? '<span class="card-badge instock">In stock</span>'
                : (item.product_stock === 0
                    ? '<span class="card-badge sale">Out of stock</span>'
                    : ''));

        let pricesHtml = '';
        if (originalPrice && originalPrice > price) {
            pricesHtml = `<span class="card-price sale">$${price.toFixed(2)}</span>
                          <span class="card-price-original">$${originalPrice.toFixed(2)}</span>`;
        } else {
            pricesHtml = `<span class="card-price">$${price.toFixed(2)}</span>`;
        }

        return `<div class="product-card" data-id="${item.product_id}" onclick="window.location.href='productpage.html?id=${item.product_id}'" style="cursor:pointer;">
            <div class="card-img-wrapper">
                <div class="card-badges">
                    ${discountBadge}
                    ${stockBadge}
                </div>
                <img src="${img}" alt="${item.product_name}" loading="lazy">
            </div>
            <div class="card-body">
                <p class="card-name" title="${item.product_name}">${item.product_name}</p>
                <div class="card-bottom">
                    <div class="card-prices">
                        ${pricesHtml}
                    </div>
                    <button class="card-wishlist active" onclick="event.stopPropagation(); removeWishlistItem(${item.product_id})" title="Remove from wishlist" aria-label="wishlist">
                        <i></i>
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function removeWishlistItem(productId) {
    try {
        const res = await apiFetch(`/wishlist/${productId}`, { method: 'DELETE' });
        if (!res.ok) { showToast('Could not remove item', true); return; }
        wishlistItems = wishlistItems.filter(i => i.product_id !== productId);
        renderWishlist();
        showToast('Removed from wishlist');
    } catch {
        showToast('Could not remove item', true);
    }
}

/* ── PANEL SWITCHER ──────────────────────────────────────── */
function switchPanel(panel, btn) {
    document.querySelectorAll('.up-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.up-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('panel-' + panel).classList.add('active');
    btn.classList.add('active');

    // Refresh wishlist when switching to that tab
    if (panel === 'wishlist') loadWishlist();
    if (panel === 'rewards') loadRewards();
    if (panel === 'reviews') loadMyReviews();
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

/* ── REWARDS & QUESTS ────────────────────────────────────── */
async function loadRewards() {
    try {
        const [questsRes, couponsRes] = await Promise.all([
            apiFetch('/quests/mine'),
            apiFetch('/coupons/mine')
        ]);
        
        if (questsRes.ok) {
            const quests = await questsRes.json();
            renderQuests(quests);
        }
        if (couponsRes.ok) {
            const coupons = await couponsRes.json();
            renderCoupons(coupons);
        }
    } catch {
        showToast('Could not load rewards', true);
    }
}

function renderQuests(quests) {
    const list = document.getElementById('quests-list');
    if (!quests.length) {
        list.innerHTML = `<div class="up-empty"><p>No active quests at the moment.</p></div>`;
        return;
    }

    list.innerHTML = quests.map(q => {
        const pct = Math.min(100, (q.current_value / q.target_value) * 100);
        const rewardText = q.reward_coupon_code ? `Reward: ${q.reward_discount_type === 'percent' ? q.reward_discount_value + '%' : '$' + q.reward_discount_value} off` : 'Reward: Surprise';
        
        let actionBtn = '';
        if (q.reward_claimed) {
            actionBtn = `<button class="reward-btn" disabled>Claimed ✓</button>`;
        } else if (q.completed) {
            actionBtn = `<button class="reward-btn" onclick="claimQuestReward(${q.quest_id})">Claim Reward</button>`;
        } else {
            actionBtn = `<button class="reward-btn" disabled>${q.current_value} / ${q.target_value}</button>`;
        }

        return `<div class="quest-card">
            <div class="reward-info">
                <div class="reward-title">${q.quest_name}</div>
                <div class="reward-desc">${q.description || ''} &bull; ${rewardText}</div>
                <div class="quest-progress-bar">
                    <div class="quest-progress-fill" style="width: ${pct}%"></div>
                </div>
                <div class="quest-progress-text">${q.current_value} / ${q.target_value} completed</div>
            </div>
            <div class="reward-action">
                ${actionBtn}
            </div>
        </div>`;
    }).join('');
}

async function claimQuestReward(questId) {
    try {
        const res = await apiFetch(`/quests/${questId}/claim`, { method: 'POST' });
        if (!res.ok) throw new Error();
        showToast('Reward claimed! Check your coupons.');
        loadRewards();
    } catch {
        showToast('Could not claim reward', true);
    }
}

function renderCoupons(coupons) {
    const list = document.getElementById('coupons-list');
    if (!coupons.length) {
        list.innerHTML = `<div class="up-empty"><p>You don't have any coupons.</p></div>`;
        return;
    }

    list.innerHTML = coupons.map(c => {
        const isUsed = c.used_at !== null;
        const discountStr = c.discount_type === 'percent' ? `${c.discount_value}% OFF` : `$${c.discount_value} OFF`;
        
        let statusHtml = '';
        if (isUsed) {
            statusHtml = `<div style="font-size:12px;color:var(--muted);margin-top:6px">Used on ${new Date(c.used_at).toLocaleDateString()}</div>`;
        } else {
            statusHtml = `<div style="display:flex; align-items:center; gap:8px;">
                            <div class="coupon-code-box" style="margin:0;">${c.coupon_code}</div>
                            <button class="od-btn od-btn-outline" style="padding:6px 10px; font-size:12px; border-radius:6px;" onclick="navigator.clipboard.writeText('${c.coupon_code}').then(()=>showToast('Coupon copied!'))"><i class="fas fa-copy"></i> Copy</button>
                          </div>`;
        }

        return `<div class="coupon-card" style="${isUsed ? 'opacity:0.6' : ''}">
            <div class="reward-info">
                <div class="reward-title">${discountStr}</div>
                <div class="reward-desc">${c.description || ''} <br> Min spend: $${c.min_spent} &bull; Valid on: ${c.applicable_categories}</div>
            </div>
            <div class="reward-action">
                ${statusHtml}
            </div>
        </div>`;
    }).join('');
}

/* ── REVIEWS ─────────────────────────────────────────────── */
async function loadMyReviews() {
    try {
        const res = await apiFetch('/reviews/my');
        if (!res.ok) throw new Error();
        const reviews = await res.json();
        renderMyReviews(reviews);
    } catch {
        const list = document.getElementById('reviews-list');
        if (list) list.innerHTML =
            `<div class="up-empty"><i class="fas fa-exclamation-circle"></i><p>Could not load reviews. Please refresh.</p></div>`;
    }
}

function renderMyReviews(reviews) {
    const list = document.getElementById('reviews-list');
    if (!list) return;

    if (!reviews || !reviews.length) {
        list.innerHTML = `<div class="up-empty">
            <i class="fas fa-star"></i>
            <p>You haven't reviewed any products yet.</p>
        </div>`;
        return;
    }

    list.innerHTML = reviews.map(r => {
        const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
        const date = new Date(r.created_at).toLocaleDateString();
        const productImg = r.primary_image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg';
        
        let statusBadge = '';
        let editBtn = '';
        if (r.status === 'pending') {
            statusBadge = '<span class="badge badge-amber">Pending</span>';
            editBtn = `<button class="od-btn od-btn-outline" style="padding: 4px 10px; font-size: 12px; margin-left: 10px;" onclick="openEditReviewModal(${r.review_id}, ${r.product_id}, ${r.rating}, '${(r.review_text || '').replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i> Edit</button>`;
        }
        else if (r.status === 'approved') statusBadge = '<span class="badge badge-green">Approved</span>';
        else if (r.status === 'rejected') statusBadge = '<span class="badge badge-red">Rejected</span>';

        return `
        <div class="review-card" style="display:flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e0e0e0;">
            <img src="${productImg}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0;" alt="${r.product_name}">
            <div style="flex: 1;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <a href="productpage.html?id=${r.product_id}" style="font-weight: bold; color: #333; text-decoration: none;">${r.product_name}</a>
                    <span style="font-size:12px; color:#999;">${date}</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span style="color:#ffd700; letter-spacing: 2px;">${stars}</span>
                    <span style="margin-left: 8px;">${statusBadge}</span>
                    ${editBtn}
                </div>
                <p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 0;">${r.review_text || ''}</p>
                ${r.image_url ? `<div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">${r.image_url.split(',').map(url => `<img src="${url}" style="max-width:150px; border-radius:8px; border:1px solid #eee; cursor:pointer;" onclick="window.open(this.src,'_blank')">`).join('')}</div>` : ''}
                ${r.admin_note ? `<div style="margin-top:10px; padding:10px; background:#f8f9fa; border-left:3px solid #82659D; font-size:13px; color:#444;"><strong>Store Reply:</strong> ${r.admin_note}</div>` : ''}
            </div>
        </div>`;
    }).join('');
}

/* ── REVIEW MODAL ────────────────────────────────────────── */
let currentReviewRating = 0;

function openReviewModal(productId) {
    document.querySelector('#review-modal .up-modal-title').textContent = 'Write a Review';
    document.getElementById('review-submit-btn').textContent = 'Submit Review';
    document.getElementById('review-product-id').value = productId;
    document.getElementById('edit-review-id').value = '';
    setRating(0);
    document.getElementById('review-text').value = '';
    document.getElementById('review-image').value = '';
    
    document.getElementById('review-modal').classList.add('open');
}

function openEditReviewModal(reviewId, productId, rating, text) {
    document.querySelector('#review-modal .up-modal-title').textContent = 'Edit Review (Pending)';
    document.getElementById('review-submit-btn').textContent = 'Update Review';
    document.getElementById('review-product-id').value = productId;
    document.getElementById('edit-review-id').value = reviewId;
    setRating(rating);
    document.getElementById('review-text').value = text;
    document.getElementById('review-image').value = '';
    
    document.getElementById('review-modal').classList.add('open');
}

function closeReviewModal() {
    document.getElementById('review-modal').classList.remove('open');
}

function setRating(val) {
    currentReviewRating = val;
    document.getElementById('review-rating').value = val;
    document.querySelectorAll('#review-stars span').forEach(s => {
        const sVal = parseInt(s.dataset.val);
        s.textContent = sVal <= val ? '★' : '☆';
    });
}

// Setup star hover effects
document.addEventListener('DOMContentLoaded', () => {
    const stars = document.querySelectorAll('#review-stars span');
    stars.forEach(s => {
        s.addEventListener('mouseover', function() {
            const val = parseInt(this.dataset.val);
            stars.forEach(st => {
                const stVal = parseInt(st.dataset.val);
                st.textContent = stVal <= val ? '★' : '☆';
            });
        });
        s.addEventListener('mouseout', function() {
            setRating(currentReviewRating);
        });
        s.addEventListener('click', function() {
            setRating(parseInt(this.dataset.val));
        });
    });
});

async function submitReview() {
    const productId = document.getElementById('review-product-id').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const text = document.getElementById('review-text').value.trim();
    const fileInput = document.getElementById('review-image');

    const editId = document.getElementById('edit-review-id').value;

    if (rating === 0) {
        showToast('Please select a rating', true);
        return;
    }

    if (fileInput.files.length > 5) {
        showToast('You can only upload up to 5 images.', true);
        return;
    }

    const btn = document.getElementById('review-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const formData = new FormData();
    if (!editId) {
        formData.append('productId', productId);
    }
    formData.append('rating', rating);
    formData.append('reviewText', text);
    
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append('reviewImage', fileInput.files[i]);
    }

    try {
        const url = editId ? `/api/reviews/${editId}` : `/api/reviews`;
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit review');

        showToast(editId ? 'Review updated successfully!' : 'Review submitted successfully!');
        closeReviewModal();
        if (orderTab === 'reviews') {
            loadMyReviews();
        }
    } catch (err) {
        showToast(err.message, true);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Review';
    }
}

/* ── BOOT ────────────────────────────────────────────────── */
init();