/**
 * address.js — Neko Animestore Address / Checkout Page
 */

/* =====================
   LOAD CART FROM SESSION
   ===================== */
const SHIPPING_PRICES = {
    express:      3.00,
    standard:     2.00,
    economy:      1.00,
    pickup:       0.00,
    undetermined: null   // TBD
};

let cartItems = [];

try {
    const saved = sessionStorage.getItem('neko_cart');
    if (saved) cartItems = JSON.parse(saved);
} catch(e) {}

/* =====================
   RENDER MINI SUMMARY
   ===================== */
function getSubtotal() {
    return cartItems.reduce((s, i) => s + i.price * i.qty, 0);
}

function getShippingValue() {
    const v = document.querySelector('input[name="shipping"]:checked');
    if (!v) return 3.00;
    return SHIPPING_PRICES[v.value];
}

function renderMiniSummary() {
    const container = document.getElementById('order-mini-summary');
    container.innerHTML = '';

    cartItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'order-mini-item';
        const shortName = item.name.length > 26 ? item.name.slice(0, 26) + '…' : item.name;
        div.innerHTML = `
            <span class="mini-name">
                ${shortName}
                <small>${item.option} × ${item.qty}</small>
            </span>
            <span class="mini-price">$${(item.price * item.qty).toFixed(2)}</span>
        `;
        container.appendChild(div);
    });

    updateTotals();
}

function updateTotals() {
    const sub = getSubtotal();
    const ship = getShippingValue();

    document.getElementById('mini-subtotal').textContent = `$${sub.toFixed(2)}`;

    const shipEl = document.getElementById('mini-shipping');
    if (ship === null) {
        shipEl.textContent = 'TBD';
        shipEl.style.color = '#B99CC8';
        document.getElementById('mini-total').textContent = `$${sub.toFixed(2)} + ship`;
    } else {
        shipEl.textContent = ship === 0 ? 'FREE' : `$${ship.toFixed(2)}`;
        shipEl.style.color = ship === 0 ? '#4caf7d' : '#333';
        document.getElementById('mini-total').textContent = `$${(sub + ship).toFixed(2)}`;
    }
}

/* =====================
   LOCATION TABS
   ===================== */
document.querySelectorAll('.loc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.loc-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-manual').classList.toggle('hidden', tab !== 'manual');
        document.getElementById('tab-maps').classList.toggle('hidden', tab !== 'maps');
    });
});

/* =====================
   VERIFY MAPS LINK
   ===================== */
document.getElementById('verify-maps-btn').addEventListener('click', () => {
    const link = document.getElementById('addr-maps-link').value.trim();
    if (!link) {
        showToast('Please paste a Google Maps link first.');
        return;
    }
    if (link.includes('maps.google') || link.includes('goo.gl/maps') || link.includes('maps.app.goo.gl')) {
        window.open(link, '_blank', 'noopener');
    } else {
        showToast('That doesn\'t look like a Google Maps link. Please check and try again.');
    }
});

/* =====================
   SHIPPING — update totals on change
   ===================== */
document.querySelectorAll('input[name="shipping"]').forEach(radio => {
    radio.addEventListener('change', updateTotals);
});

/* =====================
   ORDER NOTE CHARACTER COUNT
   ===================== */
const noteTA = document.getElementById('order-note');
const charCount = document.getElementById('note-char');
noteTA.addEventListener('input', () => {
    charCount.textContent = `${noteTA.value.length} / 500`;
});

/* =====================
   VALIDATION
   ===================== */
function getActiveTab() {
    return document.querySelector('.loc-tab.active')?.dataset.tab || 'manual';
}

function validate() {
    let ok = true;
    const tab = getActiveTab();

    // Clear previous errors
    document.querySelectorAll('.field-input.error').forEach(el => el.classList.remove('error'));

    if (tab === 'manual') {
        const line1 = document.getElementById('addr-line1');
        if (!line1.value.trim()) {
            line1.classList.add('error');
            showToast('Please enter your delivery address.');
            ok = false;
        }
    } else {
        const mapLink = document.getElementById('addr-maps-link');
        if (!mapLink.value.trim()) {
            mapLink.classList.add('error');
            showToast('Please paste your Google Maps link.');
            ok = false;
        }
    }

    if (ok) {
        const p1 = document.getElementById('phone1');
        if (!p1.value.trim()) {
            p1.classList.add('error');
            showToast('Please enter at least one phone number.');
            ok = false;
        }
    }

    return ok;
}

/* =====================
   BUILD ORDER OBJECT & SUBMIT
   ===================== */
document.getElementById('submit-order-btn').addEventListener('click', () => {
    if (!validate()) return;

    const tab = getActiveTab();
    const shippingRadio = document.querySelector('input[name="shipping"]:checked');
    const shippingMethod = shippingRadio ? shippingRadio.value : 'express';
    const shippingCost   = SHIPPING_PRICES[shippingMethod];

    const address = tab === 'manual' ? {
        type: 'manual',
        line1:    document.getElementById('addr-line1').value.trim(),
        district: document.getElementById('addr-district').value.trim(),
        city:     document.getElementById('addr-city').value.trim(),
        landmark: document.getElementById('addr-landmark').value.trim()
    } : {
        type:    'maps',
        link:    document.getElementById('addr-maps-link').value.trim(),
        details: document.getElementById('addr-maps-detail').value.trim()
    };

    const order = {
        orderId:   'NK-' + Date.now().toString(36).toUpperCase(),
        createdAt: new Date().toISOString(),
        items:     cartItems,
        address,
        shipping: {
            method: shippingMethod,
            cost:   shippingCost
        },
        phones: {
            phone1: '+855 ' + document.getElementById('phone1').value.trim(),
            phone2: document.getElementById('phone2').value.trim()
                        ? '+855 ' + document.getElementById('phone2').value.trim()
                        : ''
        },
        note: document.getElementById('order-note').value.trim(),
        subtotal: getSubtotal(),
        total: shippingCost !== null ? getSubtotal() + shippingCost : null,
        status: 'pending'
    };

    // Save order for confirmation page
    sessionStorage.setItem('neko_pending_order', JSON.stringify(order));
    // Clear cart
    sessionStorage.removeItem('neko_cart');

    window.location.href = 'confirmation.html';
});

/* =====================
   TOAST
   ===================== */
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

/* =====================
   INIT
   ===================== */
renderMiniSummary();