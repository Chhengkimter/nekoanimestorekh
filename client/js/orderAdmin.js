
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
    
    const statusMap = {
      pending: 'badge-yellow', confirmed: 'badge-green', shipped: 'badge-blue',
      delivered: 'badge-grey', cancelled: 'badge-red', refunded: 'badge-red'
    };
    const sCls = statusMap[o.order_status] || 'badge-amber';

    return `<div class="ord-row" onclick="viewOrderDetail(${o.order_id})">
      <div class="ord-code">${o.order_code}</div>
      <div class="ord-customer">
        <div class="ord-customer-name">${customerName}</div>
        <div class="ord-customer-phone">${phone}</div>
      </div>
      <div class="ord-date">${date}</div>
      <div class="ord-total">${total}</div>
      <div class="ord-status-col" onclick="event.stopPropagation()">
        <select class="ord-status-select-inline ${sCls}" onchange="handleInlineStatusChange(${o.order_id}, this.value, '${o.order_status}', this)">
          ${['pending','confirmed','shipped','delivered','cancelled','refunded'].map(s => 
            `<option value="${s}" ${o.order_status === s ? 'selected' : ''} style="background:#fff;color:#333">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>
    </div>`;
  }).join('');
}

function statusBadge(status) {
  const map = {
    pending:   { cls: 'badge-yellow', label: 'Pending' },
    confirmed: { cls: 'badge-green', label: 'Confirmed' },
    shipped:   { cls: 'badge-blue', label: 'Shipped' },
    delivered: { cls: 'badge-grey', label: 'Delivered' },
    cancelled: { cls: 'badge-red', label: 'Cancelled' },
    refunded:  { cls: 'badge-red', label: 'Refunded' }
  };
  const s = map[status] || { cls: 'badge-yellow', label: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown' };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}
// ── ORDER DETAIL — read-only by default, edit mode via Modify button ──

let orderViewMode    = 'view'; // 'view' | 'edit'
let orderEditItems    = [];
let orderEditPayments = [];
let orderEditDirty    = false;
let addProductCatFilter = 'All';

async function viewOrderDetail(orderId) {
  const res = await apiFetch(`/admin/orders/${orderId}`);
  if (!res.ok) { toast('Failed to load order', true); return; }
  viewingOrder = await res.json();
  orderViewMode = 'view';
  orderEditDirty = false;

  const payRes = await apiFetch(`/admin/orders/${orderId}/payments`);
  orderEditPayments = payRes.ok ? await payRes.json() : [];

  renderOrderDetail();
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-order-detail').classList.add('active');
}

function closeOrderDetail() {
  viewingOrder = null;
  orderEditItems = [];
  orderEditPayments = [];
  orderEditDirty = false;
  orderViewMode = 'view';
  switchSection('orders');
  loadOrders().then(renderOrders);
}

function enterEditMode() {
  orderViewMode = 'edit';
  orderEditItems = (viewingOrder.items || []).map(it => ({
    productId:       it.product_id,
    productName:     it.product_name,
    image:           it.image,
    selectedOption:  it.selected_option,
    quantity:        it.product_quantity,
    priceAtPurchase: parseFloat(it.price_at_purchase),
    itemNote:        it.item_note || ''
  }));
  orderEditDirty = false;
  renderOrderDetail();
}

function cancelEditMode() {
  orderViewMode = 'view';
  orderEditItems = [];
  orderEditDirty = false;
  renderOrderDetail();
}

function markDirty() {
  orderEditDirty = true;
  renderOrderDetail();
}

function calcEditSubtotal() {
  return orderEditItems.reduce((sum, it) => sum + it.priceAtPurchase * it.quantity, 0);
}

function calcTotalPaid() {
  return orderEditPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

function renderOrderDetail() {
  if (orderViewMode === 'edit') renderOrderDetailEdit();
  else renderOrderDetailView();
}

async function confirmIncomingOrder(orderId) {
  if (!confirm('Confirm this order?')) return;
  const res = await apiFetch(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'confirmed' })
  });
  if (!res.ok) {
    toast('Failed to confirm order', true);
    return;
  }
  toast('Order confirmed ✓');
  await viewOrderDetail(orderId);
  loadOrders().then(renderOrders);
}

async function handleStatusChange(orderId, newStatus) {
  if (newStatus === 'shipped') {
    document.getElementById('ord-status-select').value = viewingOrder.order_status;
    openShipModal(orderId);
    return;
  }
  
  if (newStatus === 'refunded') {
    document.getElementById('ord-status-select').value = viewingOrder.order_status;
    openRefundModal(orderId);
    return;
  }

  if (!confirm(`Change order status to ${newStatus}?`)) {
    // Revert select visually
    document.getElementById('ord-status-select').value = viewingOrder.order_status;
    return;
  }
  const res = await apiFetch(`/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus })
  });
  if (!res.ok) {
    toast('Failed to change status', true);
    document.getElementById('ord-status-select').value = viewingOrder.order_status;
    return;
  }
  toast('Status updated ✓');
  await viewOrderDetail(orderId);
  loadOrders().then(renderOrders);
}

function handleInlineStatusChange(orderId, newStatus, oldStatus, selectElement) {
  if (newStatus === 'shipped') {
    selectElement.value = oldStatus; 
    openShipModal(orderId);
  } else if (newStatus === 'refunded') {
    selectElement.value = oldStatus;
    openRefundModal(orderId);
  } else {
    // Other statuses use the standard confirm
    if (!confirm(`Change order status to ${newStatus}?`)) {
      selectElement.value = oldStatus;
      return;
    }
    // We can just call handleStatusChange, but we don't have viewingOrder set correctly here
    // Let's do a direct fetch for inline
    apiFetch(`/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    }).then(res => {
      if (!res.ok) {
        toast('Failed to change status', true);
        selectElement.value = oldStatus;
        return;
      }
      toast('Status updated ✓');
      loadOrders().then(renderOrders);
    });
  }
}

// ── REFUND MODAL LOGIC ──
function openRefundModal(orderId) {
  if (!document.getElementById('refund-modal-overlay')) {
    const modalHtml = `
      <div class="modal-overlay" id="refund-modal-overlay">
        <div class="modal" style="max-width: 400px; padding: 20px;">
          <div class="modal-header">
            <span class="modal-title" style="font-size:18px; font-weight:700;">Refund Order</span>
            <button class="modal-close" onclick="closeRefundModal()">✕</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
            <input type="hidden" id="refund-order-id">
            
            <div class="form-group">
              <label>Refund Date</label>
              <input type="datetime-local" id="refund-date">
            </div>

            <div class="form-group">
              <label>Refund Proof Picture (Optional)</label>
              <input type="file" id="refund-image" accept="image/*">
            </div>

            <button class="btn-save" style="margin-top:10px; width:100%;" onclick="submitRefundModal()" id="refund-submit-btn">Submit & Mark as Refunded</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  
  document.getElementById('refund-order-id').value = orderId;
  
  // Set date to now (local time)
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('refund-date').value = now.toISOString().slice(0,16);
  
  document.getElementById('refund-modal-overlay').classList.add('open');
}

function closeRefundModal() {
  const modal = document.getElementById('refund-modal-overlay');
  if (modal) modal.classList.remove('open');
}

async function submitRefundModal() {
  const orderId = document.getElementById('refund-order-id').value;
  const refundDate = document.getElementById('refund-date').value;
  const refundImage = document.getElementById('refund-image').files[0];

  const btn = document.getElementById('refund-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const formData = new FormData();
  if (refundDate) formData.append('refundDate', new Date(refundDate).toISOString());
  if (refundImage) formData.append('refundImage', refundImage);

  try {
    const res = await fetch(`${API}/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData
    });

    if (!res.ok) throw new Error('Failed to refund order');

    toast('Order marked as refunded ✓');
    closeRefundModal();
    loadOrders().then(renderOrders);
  } catch (e) {
    toast('Failed to refund order', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit & Mark as Refunded';
  }
}

// ── SHIP MODAL LOGIC ──
function openShipModal(orderId) {
  if (!document.getElementById('ship-modal-overlay')) {
    const modalHtml = `
      <div class="modal-overlay" id="ship-modal-overlay">
        <div class="modal" style="max-width: 400px; padding: 20px;">
          <div class="modal-header">
            <span class="modal-title" style="font-size:18px; font-weight:700;">Ship Order</span>
            <button class="modal-close" onclick="closeShipModal()">✕</button>
          </div>
          <div class="modal-body" style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
            <input type="hidden" id="ship-order-id">
            
            <div class="form-group">
              <label>Delivery Company</label>
              <div style="display:flex; gap:10px; margin-top:5px;">
                <label><input type="radio" name="ship-company" value="J&T express" checked> J&T Express</label>
                <label><input type="radio" name="ship-company" value="VET express"> VET Express</label>
                <label><input type="radio" name="ship-company" value="Jalat express"> Jalat Express</label>
              </div>
            </div>

            <div class="form-group">
              <label>Tracking Number <span class="optional" style="font-size:11px;color:var(--muted);font-weight:normal;">(Optional)</span></label>
              <div style="display:flex; gap:5px;">
                <input type="text" id="ship-tracking" style="flex:1;">
                <button type="button" class="btn-save" style="padding:0 10px;" onclick="pasteTracking()">Paste</button>
              </div>
            </div>

            <div class="form-group">
              <label>Shipping Date</label>
              <input type="datetime-local" id="ship-date">
            </div>

            <div class="form-group">
              <label>Shipping Picture (Optional)</label>
              <input type="file" id="ship-image" accept="image/*">
            </div>

            <button class="btn-save" style="margin-top:10px; width:100%;" onclick="submitShipModal()" id="ship-submit-btn">Submit & Mark as Shipped</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  
  document.getElementById('ship-order-id').value = orderId;
  document.getElementById('ship-tracking').value = '';
  
  // Set date to now (local time)
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('ship-date').value = now.toISOString().slice(0, 16);
  
  document.getElementById('ship-image').value = '';
  document.getElementById('ship-modal-overlay').classList.add('open');
}

function closeShipModal() {
  const modal = document.getElementById('ship-modal-overlay');
  if (modal) modal.classList.remove('open');
}

async function pasteTracking() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('ship-tracking').value = text;
  } catch (err) {
    toast('Failed to read clipboard', true);
  }
}

async function submitShipModal() {
  const orderId = document.getElementById('ship-order-id').value;
  const company = document.querySelector('input[name="ship-company"]:checked').value;
  const tracking = document.getElementById('ship-tracking').value.trim();
  const date = document.getElementById('ship-date').value;
  const fileInput = document.getElementById('ship-image');

  const btn = document.getElementById('ship-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const formData = new FormData();
  formData.append('shippingCompany', company);
  formData.append('trackingNumber', tracking);
  formData.append('shippingDate', date);
  if (fileInput.files[0]) {
    formData.append('shippingImage', fileInput.files[0]);
  }

  try {
    const res = await fetch(`${API}/admin/orders/${orderId}/ship`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: formData
    });

    if (!res.ok) {
      toast('Failed to ship order', true);
    } else {
      toast('Order marked as shipped ✓');
      closeShipModal();
      
      // If we are currently viewing this order in the modal, refresh it
      if (viewingOrder && viewingOrder.order_id == orderId) {
        await viewOrderDetail(orderId);
      }
      loadOrders().then(renderOrders);
    }
  } catch (err) {
    toast('Network error', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit & Mark as Shipped';
  }
}

// ── READ-ONLY RECEIPT VIEW ──
function renderOrderDetailView() {
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

  const itemsHtml = (o.items || []).map(it => {
    const thumb = it.image
      ? `<img class="ord-item-thumb" src="${it.image}" onerror="this.style.opacity=.3">`
      : `<div class="ord-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
    const lineTotal = (Number(it.price_at_purchase) * it.product_quantity).toFixed(2);
    const variant = it.selected_option ? `<span class="ord-item-variant">${it.selected_option}</span>` : '';
    const note = it.item_note ? `<div class="ord-item-note">📝 ${it.item_note}</div>` : '';
    return `<div class="ord-item-row">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div class="ord-item-name"><a href="../pages/productpage.html?id=${it.product_id}" target="_blank" style="color:var(--accent);text-decoration:none;">${it.product_name}</a> <span style="font-size:11px;color:var(--muted);font-family:var(--mono);">#${it.product_id}</span> ${variant}</div>
        <div class="ord-item-meta">Qty ${it.product_quantity} × $${Number(it.price_at_purchase).toFixed(2)}</div>
        ${note}
      </div>
      <div class="ord-item-price">$${lineTotal}</div>
    </div>`;
  }).join('');

  const totalPaid = calcTotalPaid();
  const balance = parseFloat(o.total || 0) - totalPaid;

  const confirmBanner = o.order_status === 'pending' ? `
    <div class="ord-confirm-banner">
      <p>⚠ This order is awaiting confirmation.</p>
      <button class="ord-confirm-btn" onclick="confirmIncomingOrder(${o.order_id})">Confirm order</button>
    </div>` : '';

  document.getElementById('ord-detail-content').innerHTML = `
    ${confirmBanner}
    <div class="receipt-wrap">

      <div class="receipt-card">
        <div class="receipt-header">
          <div>
            <div class="receipt-store">Neko_Animestore</div>
            <div class="receipt-store-sub">Order receipt</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${statusBadge(o.order_status)}
            ${['pending', 'confirmed'].includes(o.order_status) ? `<button class="btn-save" style="padding:7px 14px;font-size:12px" onclick="enterEditMode()">Modify</button>` : ''}
          </div>
        </div>
        <div class="receipt-divider"></div>
        <div class="ord-detail-row"><span>Order code</span><span style="font-family:var(--mono);font-weight:700">${o.order_code}</span></div>
        <div class="ord-detail-row"><span>Date placed</span><span>${date}</span></div>
        <div class="ord-detail-row">
          <span>Transaction ID</span>
          <span style="color:var(--muted);font-style:italic">Not available yet</span>
        </div>
      </div>

      <div class="receipt-card">
        <h3>Customer</h3>
        <div class="ord-detail-row"><span>Name</span><span>${customerName}</span></div>
        <div class="ord-detail-row"><span>Email</span><span>${o.email || '—'}</span></div>
        <div class="ord-detail-row"><span>Phone</span><span>${o.phone1 || '—'}</span></div>
        ${o.phone2 ? `<div class="ord-detail-row"><span>Phone 2</span><span>${o.phone2}</span></div>` : ''}
      </div>

      <div class="receipt-card">
        <h3>Delivery</h3>
        ${addressHtml}
        <div class="ord-detail-row"><span>Shipping method</span><span>${o.shipping_method || '—'}</span></div>
        ${o.order_note ? `<div class="ord-detail-row"><span>Order note</span><span>${o.order_note}</span></div>` : ''}
      </div>

      <div class="receipt-card receipt-full-width">
        <h3>Items</h3>
        ${itemsHtml || '<p style="font-size:12px;color:var(--muted)">No items found</p>'}
      </div>

      <div class="receipt-card">
        <div class="ord-detail-row"><span>Subtotal</span><span>$${Number(o.subtotal || 0).toFixed(2)}</span></div>
        <div class="ord-detail-row"><span>Shipping</span><span>$${Number(o.shipping_cost || 0).toFixed(2)}</span></div>
        <div class="receipt-divider"></div>
        <div class="ord-detail-row receipt-total"><span>Total</span><span>$${Number(o.total || 0).toFixed(2)}</span></div>
      </div>

      <div class="receipt-card receipt-full-width">
        <h3>Payments</h3>
        <div class="ord-detail-row"><span>Total paid</span><span style="font-weight:700">$${totalPaid.toFixed(2)}</span></div>
        <div class="ord-detail-row"><span>Balance</span><span style="font-weight:700;color:${balance > 0 ? 'var(--red)' : 'var(--green)'}">$${balance.toFixed(2)}</span></div>
      </div>

      ${o.customer_note ? `
      <div class="receipt-card receipt-full-width">
        <h3>Note to customer <span style="font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0">(customer will see this)</span></h3>
        <p style="font-size:13px">${o.customer_note}</p>
      </div>` : ''}

      ${o.admin_note ? `
      <div class="receipt-card receipt-full-width">
        <h3>Admin note <span style="font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0">(internal only)</span></h3>
        <p style="font-size:13px">${o.admin_note}</p>
      </div>` : ''}

      <div class="receipt-card receipt-full-width">
        <h3>Status</h3>
        <select class="ord-status-select" id="ord-status-select" onchange="handleStatusChange(${o.order_id}, this.value)">
          ${['pending','confirmed','shipped','delivered','cancelled','refunded'].map(s =>
            `<option value="${s}" ${o.order_status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
          ).join('')}
        </select>
      </div>

    </div>
  `;
}

// ── EDITABLE VIEW ──
function renderOrderDetailEdit() {
  const o = viewingOrder;
  if (!o) return;

  const customerName = o.customer_name || `${o.first_name || ''} ${o.last_name || ''}`.trim() || 'Unknown';
  const date = o.order_date ? new Date(o.order_date).toLocaleString() : '';
  const subtotal = calcEditSubtotal();
  const shippingCost = parseFloat(document.getElementById('edit-shipping-cost')?.value) || parseFloat(o.shipping_cost) || 0;
  const total = subtotal + shippingCost;
  const totalPaid = calcTotalPaid();
  const balance = total - totalPaid;

  const itemsHtml = orderEditItems.map((it, i) => {
    const thumb = it.image
      ? `<img class="ord-item-thumb" src="${it.image}" onerror="this.style.opacity=.3">`
      : `<div class="ord-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`;
    const lineTotal = (it.priceAtPurchase * it.quantity).toFixed(2);

    return `<div class="ord-edit-item-row">
      ${thumb}
      <div style="flex:1;min-width:0">
        <div class="ord-item-name"><a href="../pages/productpage.html?id=${it.productId}" target="_blank" style="color:var(--accent);text-decoration:none;">${it.productName}</a> <span style="font-size:11px;color:var(--muted);font-family:var(--mono);">#${it.productId}</span> ${it.selectedOption ? `<span class="ord-item-variant">${it.selectedOption}</span>` : ''}</div>
        <input type="text" class="ord-item-note-input" value="${it.itemNote || ''}"
               onchange="updateItemNote(${i}, this.value)">
      </div>
      <div class="ord-item-qty-col">
        <button class="inv-adj-btn" onclick="adjustItemQty(${i}, -1)">−</button>
        <input class="inv-qty-input" type="number" min="1" value="${it.quantity}"
               onchange="setItemQty(${i}, this.value)" style="width:48px">
        <button class="inv-adj-btn" onclick="adjustItemQty(${i}, 1)">+</button>
      </div>
      <div class="ord-item-price">$${lineTotal}</div>
      <button class="action-btn del" onclick="removeOrderItem(${i})">Remove</button>
    </div>`;
  }).join('');

  const paymentsHtml = orderEditPayments.map(p => `
    <div class="ord-payment-row">
      <div>
        <div style="font-weight:700;font-family:var(--mono)">$${parseFloat(p.amount).toFixed(2)}</div>
        <div style="font-size:11px;color:var(--muted)">${new Date(p.paid_at).toLocaleString()}${p.note ? ' · ' + p.note : ''}</div>
      </div>
      <button class="action-btn del" style="font-size:10px" onclick="deletePayment(${p.payment_id}, ${o.order_id})">Remove</button>
    </div>`).join('') || `<p style="font-size:12px;color:var(--muted)">No payments recorded yet</p>`;

  document.getElementById('ord-detail-content').innerHTML = `
    <div class="receipt-wrap">

      <div class="receipt-card">
        <div class="receipt-header">
          <div>
            <div class="receipt-store">Neko_Animestore</div>
            <div class="receipt-store-sub">Editing order</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${statusBadge(o.order_status)}
            <button class="btn-cancel" style="padding:7px 14px;font-size:12px" onclick="cancelEditMode()">Cancel</button>
          </div>
        </div>
        <div class="receipt-divider"></div>
        <div class="ord-detail-row"><span>Order code</span><span style="font-family:var(--mono);font-weight:700">${o.order_code}</span></div>
        <div class="ord-detail-row"><span>Date placed</span><span>${date}</span></div>
      </div>

      <div class="receipt-card">
        <h3>Customer</h3>
        <div class="ord-detail-row"><span>Name</span><span>${customerName}</span></div>
        <div class="ord-detail-row"><span>Email</span><span>${o.email || '—'}</span></div>
        <div class="form-group" style="margin-top:10px">
          <label>Phone 1</label>
          <input type="text" id="edit-phone1" value="${o.phone1 || ''}" onchange="markDirty()">
        </div>
        <div class="form-group" style="margin-top:10px">
          <label>Phone 2</label>
          <input type="text" id="edit-phone2" value="${o.phone2 || ''}" onchange="markDirty()">
        </div>
      </div>

      <div class="receipt-card">
        <h3>Delivery</h3>
        <div class="form-group">
          <label>Address line 1</label>
          <input type="text" id="edit-addr-line1" value="${o.addr_line1 || ''}" onchange="markDirty()">
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="form-group">
            <label>District</label>
            <input type="text" id="edit-addr-district" value="${o.addr_district || ''}" onchange="markDirty()">
          </div>
          <div class="form-group">
            <label>City</label>
            <input type="text" id="edit-addr-city" value="${o.addr_city || ''}" onchange="markDirty()">
          </div>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label>Landmark</label>
          <input type="text" id="edit-addr-landmark" value="${o.addr_landmark || ''}" onchange="markDirty()">
        </div>
        <div class="form-group" style="margin-top:10px">
          <label>Shipping method</label>
          <select id="edit-shipping-method" onchange="markDirty()">
            ${['express','standard','economy','pickup','undetermined'].map(m =>
              `<option value="${m}" ${o.shipping_method === m ? 'selected' : ''}>${m.charAt(0).toUpperCase()+m.slice(1)}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-top:10px">
          <label>Shipping cost ($)</label>
          <input type="number" id="edit-shipping-cost" min="0" step="0.01" value="${o.shipping_cost ?? ''}" onchange="markDirty()">
        </div>
        <div class="form-group" style="margin-top:10px">
          <label>Customer order note</label>
          <textarea id="edit-order-note" rows="2" onchange="markDirty()">${o.order_note || ''}</textarea>
        </div>
      </div>

      <div class="receipt-card receipt-full-width">
        <h3>Items</h3>
        ${itemsHtml || '<p style="font-size:12px;color:var(--muted)">No items</p>'}
        <div class="ord-add-item-row">
          <button class="add-btn" style="width:100%;justify-content:center;padding:10px;font-size:12px" onclick="openAddProductModal()">
            <i class="fas fa-plus"></i> Add a product
          </button>
        </div>
      </div>

      <div class="receipt-card">
        <div class="ord-detail-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        <div class="ord-detail-row"><span>Shipping</span><span>$${shippingCost.toFixed(2)}</span></div>
        <div class="receipt-divider"></div>
        <div class="ord-detail-row receipt-total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      </div>

      <div class="receipt-card receipt-full-width">
        <h3>Payments</h3>
        ${paymentsHtml}
        <div class="ord-detail-row" style="margin-top:10px"><span>Total paid</span><span style="font-weight:700">$${totalPaid.toFixed(2)}</span></div>
        <div class="ord-detail-row"><span>Balance</span><span style="font-weight:700;color:${balance > 0 ? 'var(--red)' : 'var(--green)'}">$${balance.toFixed(2)}</span></div>
        <div class="ord-add-payment-row">
          <input type="number" id="ord-payment-amount" min="0" step="0.01" style="width:90px">
          <input type="text" id="ord-payment-note" style="flex:1">
          <button class="add-btn" style="padding:8px 14px;font-size:12px" onclick="addPayment(${o.order_id})">Record</button>
        </div>
      </div>

      <div class="receipt-card receipt-full-width">
        <h3>Note to customer <span style="font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0">(customer will see this)</span></h3>
        <textarea id="edit-customer-note" rows="3" onchange="viewingOrder.customer_note = this.value; markDirty()" ${orderViewMode === 'view' ? 'readonly style="background:transparent;border:none;resize:none;"' : ''}>${o.customer_note || ''}</textarea>
        
        <h3 style="margin-top:15px">Internal admin note <span style="font-size:10px;color:var(--muted);text-transform:none;letter-spacing:0">(not visible to customer)</span></h3>
        <textarea id="edit-admin-note" rows="3" onchange="viewingOrder.admin_note = this.value; markDirty()" ${orderViewMode === 'view' ? 'readonly style="background:transparent;border:none;resize:none;"' : ''}>${o.admin_note || ''}</textarea>
      </div>

      ${orderEditDirty ? `
        <div class="ord-save-bar">
          <span>You have unsaved changes</span>
          <button class="btn-save" onclick="saveOrderEdits(${o.order_id})">Save changes</button>
        </div>` : ''}

    </div>
  `;
}

// ── ITEM EDITING ──
function adjustItemQty(i, delta) {
  orderEditItems[i].quantity = Math.max(1, orderEditItems[i].quantity + delta);
  markDirty();
}

function setItemQty(i, val) {
  const n = parseInt(val);
  orderEditItems[i].quantity = isNaN(n) || n < 1 ? 1 : n;
  markDirty();
}

function updateItemNote(i, val) {
  orderEditItems[i].itemNote = val;
  markDirty();
}

function removeOrderItem(i) {
  orderEditItems.splice(i, 1);
  markDirty();
}

// ── ADD PRODUCT MODAL ──
function openAddProductModal() {
  window._addProductTarget = 'orderEdit';
  addProductCatFilter = 'All';
  document.getElementById('add-prod-search').value = '';

  const catSelect = document.getElementById('add-prod-cat-filter');
  catSelect.innerHTML = `<option value="All">All categories</option>` +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  renderAddProductListGeneric();
  document.getElementById('add-product-overlay').classList.add('open');
}

function closeAddProductModal() {
  document.getElementById('add-product-overlay').classList.remove('open');
}



function addOrderItemFromModal(productId) {
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const existing = orderEditItems.find(it => it.productId === p.dbId && !it.selectedOption);
  if (existing) {
    existing.quantity += 1;
    toast(`Increased "${p.name}" quantity`);
  } else {
    orderEditItems.push({
      productId:       p.dbId,
      productName:     p.name,
      image:           p.images?.[0] || null,
      selectedOption:  null,
      quantity:        1,
      priceAtPurchase: parseFloat(calcSale(p.price, p.discount, p.discountFlat)),
      itemNote:        ''
    });
    toast(`"${p.name}" added`);
  }
  markDirty();
  closeAddProductModal();
}

// ── PAYMENTS ──
async function addPayment(orderId) {
  const amount = parseFloat(document.getElementById('ord-payment-amount').value);
  const note   = document.getElementById('ord-payment-note').value.trim();
  if (!amount || amount <= 0) { toast('Enter a valid amount', true); return; }

  const res = await apiFetch(`/admin/orders/${orderId}/payments`, {
    method: 'POST',
    body:   JSON.stringify({ amount, note })
  });
  if (!res.ok) { toast('Failed to record payment', true); return; }

  const data = await res.json();
  orderEditPayments.unshift(data.payment);
  toast('Payment recorded ✓');
  renderOrderDetail();
}

async function deletePayment(paymentId, orderId) {
  const res = await apiFetch(`/admin/orders/${orderId}/payments/${paymentId}`, { method: 'DELETE' });
  if (!res.ok) { toast('Failed to remove payment', true); return; }
  orderEditPayments = orderEditPayments.filter(p => p.payment_id !== paymentId);
  toast('Payment removed');
  renderOrderDetail();
}

// ── SAVE ALL EDITS ──
async function saveOrderEdits(orderId) {
  const fieldsPayload = {
    phone1:         document.getElementById('edit-phone1').value.trim(),
    phone2:         document.getElementById('edit-phone2').value.trim(),
    addrLine1:      document.getElementById('edit-addr-line1').value.trim(),
    addrDistrict:   document.getElementById('edit-addr-district').value.trim(),
    addrCity:       document.getElementById('edit-addr-city').value.trim(),
    addrLandmark:   document.getElementById('edit-addr-landmark').value.trim(),
    shippingMethod: document.getElementById('edit-shipping-method').value,
    shippingCost:   parseFloat(document.getElementById('edit-shipping-cost').value) || 0,
    orderNote:      document.getElementById('edit-order-note').value.trim(),
    customerNote:   document.getElementById('edit-customer-note').value.trim(),
    adminNote:      document.getElementById('edit-admin-note').value.trim(),
    addrType:       viewingOrder.addr_type ?? null,
    mapsLink:       viewingOrder.maps_link ?? null,
    mapsDetail:     viewingOrder.maps_detail ?? null
  };

  const fieldsRes = await apiFetch(`/admin/orders/${orderId}/edit`, {
    method: 'PATCH',
    body:   JSON.stringify(fieldsPayload)
  });
  if (!fieldsRes.ok) {
    const errData = await fieldsRes.json().catch(()=>({}));
    toast(errData.error || 'Failed to save order details', true);
    return;
  }

  const itemsPayload = {
    items: orderEditItems.map(it => ({
      productId:       it.productId,
      selectedOption:  it.selectedOption,
      quantity:        it.quantity,
      priceAtPurchase: it.priceAtPurchase,
      itemNote:        it.itemNote
    }))
  };

  const itemsRes = await apiFetch(`/admin/orders/${orderId}/items`, {
    method: 'PUT',
    body:   JSON.stringify(itemsPayload)
  });
  if (!itemsRes.ok) {
    const errData = await itemsRes.json().catch(()=>({}));
    toast(errData.error || 'Failed to save items', true);
    return;
  }

  toast('Order updated ✓');
  orderEditDirty = false;
  orderViewMode = 'view';
  await viewOrderDetail(orderId);
}

async function requestFinalPayment(orderId) {
  if (!confirm('Request final payment from customer?')) return;
  const res = await apiFetch(`/admin/orders/${orderId}/request-payment`, { method: 'POST' });
  if (!res.ok) { toast('Failed to request payment', true); return; }
  toast('Final payment requested');
  await viewOrderDetail(orderId);
}