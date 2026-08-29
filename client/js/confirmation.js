let order = null;
try {
    const raw = sessionStorage.getItem('neko_pending_order');
    if (raw) order = JSON.parse(raw);
} catch(e) {}

const SHIP_LABELS = {
    express:      'Express ($3.00)',
    standard:     'Standard ($2.00)',
    economy:      'Economy ($1.00)',
    pickup:       'Store Pickup (FREE)',
    undetermined: 'To Be Determined'
};

if (order) {
    // Meta
    const totalNum = (order.total !== null && order.total !== undefined && order.total !== '') ? parseFloat(order.total) : NaN;
    const subtotalNum = (order.subtotal !== null && order.subtotal !== undefined) ? parseFloat(order.subtotal) : 0;

    document.getElementById('meta-order-id').textContent = order.orderId || '—';
    document.getElementById('meta-date').textContent = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
    document.getElementById('meta-shipping').textContent = (order.shipping && SHIP_LABELS[order.shipping.method]) || order.shipping?.method || '—';
    document.getElementById('meta-total').textContent = !isNaN(totalNum)
        ? `$${totalNum.toFixed(2)}`
        : `$${subtotalNum.toFixed(2)} + shipping TBD`;

    // Items
    const list = document.getElementById('items-list');
    if (list) {
        (order.items || []).forEach(item => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            const shortName = item.name.length > 32 ? item.name.slice(0,32)+'…' : item.name;
            div.innerHTML = `
                <img src="${item.image || item.img}" alt="" class="prev-img">
                <div class="prev-info">
                    <div class="prev-name">${shortName}</div>
                    <div class="prev-opt">${item.option} × ${item.qty}</div>
                    ${item.note ? `<div class="prev-note">📝 ${item.note.slice(0,50)}${item.note.length>50?'…':''}</div>` : ''}
                </div>
                <span class="prev-price">$${(item.price*item.qty).toFixed(2)}</span>
            `;
            list.appendChild(div);
        });
    }
} else {
    // No order in session — could be direct navigation
    document.getElementById('meta-order-id').textContent = '—';
    document.getElementById('meta-date').textContent = new Date().toLocaleDateString();
    document.getElementById('meta-shipping').textContent = '—';
    document.getElementById('meta-total').textContent = '—';
    const prev = document.getElementById('items-preview');
    if (prev) prev.style.display = 'none';
}