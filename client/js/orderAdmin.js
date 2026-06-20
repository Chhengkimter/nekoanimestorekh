
// ── ORDERS ──────────────────────────────────────────────────────
let orders        = [];
let orderTab      = 'all';
let viewingOrder  = null;     // full order detail currently shown
let pendingStatusChange = null; // { orderId, newStatus } awaiting confirm

async function loadOrders() {
  const res = await apiFetch('/admin/orders');
  if (!res.ok) { toast('Failed to load orders', true); return; }
  orders = await res.json();
}

function setOrderTab(btn) {
  document.querySelectorAll('.ord-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  orderTab = btn.dataset.status;
  renderOrders();
}

function renderOrders() {
  const q = (document.getElementById('ord-search')?.value || '').toLowerCase();

  const filtered = orders.filter(o => {
    const matchStatus = orderTab === 'all' || o.order_status === orderTab;
    const matchQ = !q
      || (o.order_code || '').toLowerCase().includes(q)
      || (o.customer_name || '').toLowerCase().includes(q)
      || (`${o.first_name || ''} ${o.last_name || ''}`).toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  if (!filtered.length) {
    document.getElementById('ord-table-body').innerHTML =
      `<div class="empty-state"><div class="es-icon">🧾</div><p>No orders found</p></div>`;
    return;
  }

  document.getElementById('ord-table-body').innerHTML = filtered.map(o => {
    const customerName = o.customer_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || 'Unknown';
    const phone = o.phone1 || o.phone_number || '';
    const date  = o.order_date ? new Date(o.order_date).toLocaleDateString() : '';
    const total = o.total != null ? `$${Number(o.total).toFixed(2)}` : '—';

    return `<div class="ord-row" onclick="viewOrderDetail(${o.order_id})">
      <div class="ord-code">${o.order_code}</div>
      <div class="ord-customer">
        <div class="ord-customer-name">${customerName}</div>
        <div class="ord-customer-phone">${phone}</div>
      </div>
      <div class="ord-date">${date}</div>
      <div class="ord-total">${total}</div>
      <div class="ord-status-col">${statusBadge(o.order_status)}</div>
    </div>`;
  }).join('');
}

function statusBadge(status) {
  const map = {
    pending:   'badge-amber',
    confirmed: 'badge-purple',
    shipped:   'badge-purple',
    delivered: 'badge-green',
    cancelled: 'badge-red',
    refunded:  'badge-red'
  };
  const cls = map[status] || 'badge-amber';
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return `<span class="badge ${cls}">${label}</span>`;
}

// ── ORDER DETAIL ──
async function viewOrderDetail(orderId) {
  const res = await apiFetch(`/admin/orders/${orderId}`);
  if (!res.ok) { toast('Failed to load order', true); return; }
  viewingOrder = await res.json();
  renderOrderDetail();

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-order-detail').classList.add('active');
}

function closeOrderDetail() {
  viewingOrder = null;
  pendingStatusChange = null;
  switchSection('orders');
  loadOrders().then(renderOrders); // refresh list in case status changed
}

function renderOrderDetail() {
  const o = viewingOrder;
  if (!o) return;

  const customerName = o.customer_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || 'Unknown';
  const date = o.order_date ? new Date(o.order_date).toLocaleString() : '';

  const addressHtml = o.addr_type === 'maps'
    ? `<div class="ord-detail-row"><span>Maps link</span><span><a href="${o.maps_link}" target="_blank" rel="noopener">Open in Maps</a></span></div>
       ${o.maps_detail ? `<div class="ord-detail-row"><span>Driver notes</span><span>${o.maps_detail}</span></div>` : ''}`
    : `<div class="ord-detail-row"><span>Address</span><span>${o.addr_line1 || '—'}</span></div>
       <div class="ord-detail-row"><span>District</span><span>${o.addr_district || '—'}</span></div>
       <div class="ord-detail-row"><span>City</span><span>${o.addr_city || '—'}</span></div>
       ${o.addr_landmark ? `<div class="ord-detail-row"><span>Landmark</span><span>${o.addr_landmark}</span></div>` : ''}`;

  // ── RECEIPT ITEM ROWS — name, variant, qty, per-item note, line total ──
  const itemsHtml = (o.items || []).map(it => {
    const thumb = it.image
      ? `<img class="ord-item-thumb" src="${it.image}" onerror="this.style.opacity=.3">`
      : `<div class="ord-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
    const lineTotal = (Number(it.price_at_purchase) * it.product_quantity).toFixed(2);
    const variant = it.selected_option
      ? `<span class="ord-item-variant">${it.selected_option}</span>` : '';
    const note = it.item_note
      ? `<div class="ord-item-note">📝 ${it.item_note}</div>` : '';

    return `<div class="ord-item-row">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div class="ord-item-name">${it.product_name} ${variant}</div>
        <div class="ord-item-meta">Qty ${it.product_quantity} × $${Number(it.price_at_purchase).toFixed(2)}</div>
        ${note}
      </div>
      <div class="ord-item-price">$${lineTotal}</div>
    </div>`;
  }).join('');

  const confirmBanner = o.order_status === 'pending' ? `
    <div class="ord-confirm-banner">
      <p>⚠ This order is awaiting confirmation.</p>
      <button class="ord-confirm-btn" onclick="confirmIncomingOrder(${o.order_id})">Confirm order</button>
    </div>` : '';

  // implement transaction id later — once payment integration is wired,
  // pull o.transaction_id (or similar field) from vw_order_summary
  const transactionIdHtml = `
    <div class="ord-detail-row">
      <span>Transaction ID</span>
      <span style="color:var(--muted);font-style:italic">Not available yet</span>
    </div>`;

  document.getElementById('ord-detail-content').innerHTML = `
    ${confirmBanner}

    <div class="receipt-wrap">

      <!-- RECEIPT HEADER -->
      <div class="receipt-card">
        <div class="receipt-header">
          <div>
            <div class="receipt-store">Neko_Animestore</div>
            <div class="receipt-store-sub">Order receipt</div>
          </div>
          <div class="receipt-status">${statusBadge(o.order_status)}</div>
        </div>

        <div class="receipt-divider"></div>

        <div class="ord-detail-row"><span>Order code</span><span style="font-family:var(--mono);font-weight:700">${o.order_code}</span></div>
        <div class="ord-detail-row"><span>Date placed</span><span>${date}</span></div>
        ${transactionIdHtml}
      </div>

      <!-- CUSTOMER -->
      <div class="receipt-card">
        <h3>Customer</h3>
        <div class="ord-detail-row"><span>Name</span><span>${customerName}</span></div>
        <div class="ord-detail-row"><span>Email</span><span>${o.email || '—'}</span></div>
        <div class="ord-detail-row"><span>Phone</span><span>${o.phone1 || '—'}</span></div>
        ${o.phone2 ? `<div class="ord-detail-row"><span>Phone 2</span><span>${o.phone2}</span></div>` : ''}
      </div>

      <!-- DELIVERY -->
      <div class="receipt-card">
        <h3>Delivery</h3>
        ${addressHtml}
        <div class="ord-detail-row"><span>Shipping method</span><span>${o.shipping_method || '—'}</span></div>
        ${o.order_note ? `<div class="ord-detail-row"><span>Order note</span><span>${o.order_note}</span></div>` : ''}
      </div>

      <!-- ITEMS -->
      <div class="receipt-card">
        <h3>Items</h3>
        ${itemsHtml || '<p style="font-size:12px;color:var(--muted)">No items found</p>'}
      </div>

      <!-- TOTALS -->
      <div class="receipt-card">
        <div class="ord-detail-row"><span>Subtotal</span><span>$${Number(o.subtotal || 0).toFixed(2)}</span></div>
        <div class="ord-detail-row"><span>Shipping</span><span>$${Number(o.shipping_cost || 0).toFixed(2)}</span></div>
        <div class="receipt-divider"></div>
        <div class="ord-detail-row receipt-total"><span>Total</span><span>$${Number(o.total || 0).toFixed(2)}</span></div>
      </div>

      <!-- STATUS CONTROL -->
      <div class="receipt-card">
        <h3>Update status</h3>
        <select class="ord-status-select" id="ord-status-select" onchange="handleStatusChange(${o.order_id}, this.value)">
          ${['pending','confirmed','shipped','delivered','cancelled','refunded'].map(s =>
            `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>

    </div>
  `;
}// ── STATUS CHANGE ──
async function handleStatusChange(orderId, newStatus) {
  const wasPending = viewingOrder?.order_status === 'pending';

  const res = await apiFetch(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status: newStatus })
  });
  if (!res.ok) {
    toast('Failed to update status', true);
    renderOrderDetail(); // revert dropdown to old value
    return;
  }

  viewingOrder.order_status = newStatus;
  toast(`Order marked as ${newStatus} ✓`);

  // If this status change is the first confirmation, fire the notification
  if (wasPending && newStatus !== 'pending') {
    notifyCustomerOrderConfirmed(orderId);
  }

  renderOrderDetail();
}

// "Confirm order" button in the banner — sets status to confirmed directly
async function confirmIncomingOrder(orderId) {
  const res = await apiFetch(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body:   JSON.stringify({ status: 'confirmed' })
  });
  if (!res.ok) { toast('Failed to confirm order', true); return; }

  viewingOrder.order_status = 'confirmed';
  toast('Order confirmed ✓');
  notifyCustomerOrderConfirmed(orderId);
  renderOrderDetail();
}

function notifyCustomerOrderConfirmed(orderId) {
  // implement it later — send Telegram/email notification to the customer
  // that their order has been confirmed
}