/**
 * address.js — Neko Animestore Address / Checkout Page
 * Flow: Reads cart from API → Collects form data → POST /api/orders → redirect
 */

const SHIPPING_PRICES = {
  express:      3.00,
  standard:     2.00,
  economy:      1.00,
  pickup:       0.00,
  undetermined: null
};

let cartItems = [];
let cartSubtotal = 0;

/* =====================
   INIT — LOAD CART FROM API
   ===================== */
async function initCart() {
  try {
    const res = await fetch('/api/cart', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!res.ok) throw new Error('Failed to load cart');

    const data = await res.json();

    // data = { items, subtotal, itemCount }
    cartItems    = data.items;
    cartSubtotal = data.subtotal;

    if (cartItems.length === 0) {
      window.location.href = 'cart.html'; // nothing to checkout
      return;
    }

    renderMiniSummary();

  } catch (err) {
    console.error('initCart error:', err.message);
    showToast('Failed to load your cart. Please try again.');
  }
}

function getToken() {
  return localStorage.getItem('neko_token') || '';
}

/* =====================
   RENDER MINI SUMMARY
   ===================== */
function getShippingValue() {
  const v = document.querySelector('input[name="shipping"]:checked');
  if (!v) return SHIPPING_PRICES.express;
  return SHIPPING_PRICES[v.value];
}

function renderMiniSummary() {
  const container = document.getElementById('order-mini-summary');
  container.innerHTML = '';

  cartItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'order-mini-item';

    const name = item.product_name || item.name || '';
    const shortName = name.length > 26 ? name.slice(0, 26) + '…' : name;
    const lineTotal = (parseFloat(item.price_snapshot) * item.quantity).toFixed(2);

    div.innerHTML = `
      <span class="mini-name">
        ${shortName}
        <small>${item.selected_option ? item.selected_option + ' × ' : ''}${item.quantity}</small>
      </span>
      <span class="mini-price">$${lineTotal}</span>
    `;
    container.appendChild(div);
  });

  updateTotals();
}

function updateTotals() {
  const sub  = cartSubtotal;
  const ship = getShippingValue();

  document.getElementById('mini-subtotal').textContent = `$${sub.toFixed(2)}`;

  const shipEl = document.getElementById('mini-shipping');
  if (ship === null) {
    shipEl.textContent   = 'TBD';
    shipEl.style.color   = '#B99CC8';
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
    document.getElementById('tab-maps').classList.toggle('hidden',  tab !== 'maps');
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
    showToast("That doesn't look like a Google Maps link. Please check and try again.");
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
const noteTA    = document.getElementById('order-note');
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
  let ok  = true;
  const tab = getActiveTab();

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
   BUILD ORDER PAYLOAD & SUBMIT
   ===================== */
document.getElementById('submit-order-btn').addEventListener('click', async () => {
  if (!validate()) return;

  const btn = document.getElementById('submit-order-btn');
  btn.disabled   = true;
  btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

  try {
    const tab            = getActiveTab();
    const shippingRadio  = document.querySelector('input[name="shipping"]:checked');
    const shippingMethod = shippingRadio ? shippingRadio.value : 'express';
    const shippingCost   = SHIPPING_PRICES[shippingMethod];

    const address = tab === 'manual'
      ? {
          type:     'manual',
          line1:    document.getElementById('addr-line1').value.trim(),
          district: document.getElementById('addr-district').value.trim(),
          city:     document.getElementById('addr-city').value.trim(),
          landmark: document.getElementById('addr-landmark').value.trim()
        }
      : {
          type:    'maps',
          link:    document.getElementById('addr-maps-link').value.trim(),
          details: document.getElementById('addr-maps-detail').value.trim()
        };

    const payload = {
        // address fields — flat, matching OrderController destructuring
        addrType:     tab,
        addrLine1:    tab === 'manual' ? document.getElementById('addr-line1').value.trim()     : '',
        addrDistrict: tab === 'manual' ? document.getElementById('addr-district').value.trim()  : '',
        addrCity:     tab === 'manual' ? document.getElementById('addr-city').value.trim()      : '',
        addrLandmark: tab === 'manual' ? document.getElementById('addr-landmark').value.trim()  : '',
        mapsLink:     tab === 'maps'   ? document.getElementById('addr-maps-link').value.trim() : '',
        mapsDetail:   tab === 'maps'   ? document.getElementById('addr-maps-detail').value.trim(): '',

        // shipping
        shippingMethod: shippingMethod,
        shippingCost:   shippingCost,

        // contact
        phone1: '+855 ' + document.getElementById('phone1').value.trim(),
        phone2: document.getElementById('phone2').value.trim()
                    ? '+855 ' + document.getElementById('phone2').value.trim()
                    : '',

        // note
        orderNote: document.getElementById('order-note').value.trim()
    };

    const res = await fetch('/api/orders', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Order submission failed');
    }

    const order = await res.json();

    sessionStorage.setItem('neko_order_code',  order.orderCode);
    sessionStorage.setItem('neko_order_total', order.order?.total ?? '');

    window.location.href = 'confirmation.html';

  } catch (err) {
    console.error('submitOrder error:', err.message);
    showToast(err.message || 'Something went wrong. Please try again.');
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Order';
  }
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
   BOOT
   ===================== */
initCart();