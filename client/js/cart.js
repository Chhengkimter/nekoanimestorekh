const BASE_URL = 'http://localhost:3000/api/cart';

let cartItems = [];

/* =====================
   AUTH HELPER
   ===================== */
function getToken() { return localStorage.getItem('neko_token'); }

function authHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

function handleUnauth() {
    localStorage.removeItem('neko_token');
    localStorage.removeItem('neko_user');
    localStorage.removeItem('neko_role');
    window.location.href = 'login.html';
}

/* =====================
   API CALLS
   ===================== */
async function fetchCart() {
    try {
        const res = await fetch(BASE_URL, {
            method: 'GET',
            headers: authHeaders()
        });

        if (res.status === 401) { handleUnauth(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        cartItems = (data.items || []).map(item => ({
            cartId:       item.cart_item_id,
            productId:    item.product_id,
            name:         item.product_name,
            option:       item.selected_option || '—',
            price:        parseFloat(item.price_snapshot),
            qty:          item.quantity,
            img:          item.image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
            note:         item.note || '',
            currentPrice: parseFloat(item.current_price),
            stockStatus:  item.stock_status
        }));

    } catch (err) {
        console.error('fetchCart error:', err);
        showToast('Could not load cart. Please refresh.');
    }
}

async function apiUpdateQty(cartItemId, newQty) {
    const res = await fetch(`${BASE_URL}/${cartItemId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ quantity: newQty })
    });
    if (res.status === 401) { handleUnauth(); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function apiRemoveItem(cartItemId) {
    const res = await fetch(`${BASE_URL}/${cartItemId}`, {
        method: 'DELETE',
        headers: authHeaders()
    });
    if (res.status === 401) { handleUnauth(); return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function saveNote(cartId, note) {
    try {
        const res = await fetch(`${BASE_URL}/${cartId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ note })
        });
        if (res.status === 401) { handleUnauth(); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        console.error('saveNote error:', err);
    }
}

/* =====================
   RENDER
   ===================== */
function render() {
    const list       = document.getElementById('cart-items-list');
    const empty      = document.getElementById('empty-cart');
    const summaryCol = document.getElementById('summary-col');
    const countEl    = document.getElementById('cart-count');

    list.innerHTML = '';

    if (cartItems.length === 0) {
        empty.style.display      = 'block';
        summaryCol.style.display = 'none';
        countEl.textContent      = '0';
        document.querySelector('.cart-layout')?.classList.add('is-empty');
        return;
    }

    document.querySelector('.cart-layout')?.classList.remove('is-empty');
    empty.style.display      = 'none';
    summaryCol.style.display = 'block';
    countEl.textContent      = cartItems.reduce((s, i) => s + i.qty, 0);

    cartItems.forEach(item => {
        const div = document.createElement('div');
        div.className      = 'cart-item';
        div.dataset.cartId = item.cartId;

        const subtotal   = (item.price * item.qty).toFixed(2);
        const hasNote    = item.note && item.note.trim().length > 0;
        const priceDrift = item.currentPrice && item.currentPrice !== item.price;
        const driftBadge = priceDrift
            ? `<span class="price-drift-badge" title="Price changed since you added this item">
                   Current price: $${item.currentPrice.toFixed(2)}
               </span>`
            : '';

        div.innerHTML = `
            <div class="item-top">
                <img src="${item.img}" alt="${item.name}" class="item-img">
                <div class="item-details">
                    <div class="item-name" title="${item.name}">${item.name}</div>
                    <span class="item-option">${item.option}</span>
                    <div class="item-price-unit">$${item.price.toFixed(2)} each ${driftBadge}</div>
                </div>
            </div>

            <div class="item-controls">
                <div class="qty-control">
                    <button class="qty-btn minus-btn" aria-label="Decrease">−</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn plus-btn" aria-label="Increase">+</button>
                </div>
                <span class="item-subtotal">$${subtotal}</span>
                <button class="remove-btn" title="Remove item">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>

            <div class="item-note-row">
                <button class="note-toggle">
                    <i class="fas fa-sticky-note"></i>
                    ${hasNote ? 'Edit note' : 'Add a note'}
                    <i class="fas fa-chevron-${hasNote ? 'up' : 'down'} toggle-chevron"></i>
                </button>
                <div class="note-area ${hasNote ? 'open' : ''}">
                    <textarea
                        class="note-textarea"
                        placeholder="e.g. gift wrap, specific colour preference, message…"
                        maxlength="300"
                    >${item.note || ''}</textarea>
                </div>
            </div>
        `;

        div.querySelector('.minus-btn').addEventListener('click', () => changeQty(item.cartId, -1));
        div.querySelector('.plus-btn').addEventListener('click',  () => changeQty(item.cartId, +1));
        div.querySelector('.remove-btn').addEventListener('click', () => removeItem(item.cartId));

        const noteToggle = div.querySelector('.note-toggle');
        const noteArea   = div.querySelector('.note-area');
        const chevron    = div.querySelector('.toggle-chevron');

        noteToggle.addEventListener('click', () => {
            const open = noteArea.classList.toggle('open');
            chevron.className = `fas fa-chevron-${open ? 'up' : 'down'} toggle-chevron`;
        });

        let noteTimer = null;
        div.querySelector('.note-textarea').addEventListener('input', (e) => {
            const idx = cartItems.findIndex(ci => ci.cartId === item.cartId);
            if (idx !== -1) cartItems[idx].note = e.target.value;
            updateToggleLabel(noteToggle, e.target.value, noteArea);
            clearTimeout(noteTimer);
            noteTimer = setTimeout(() => saveNote(item.cartId, e.target.value), 800);
        });

        list.appendChild(div);
    });

    renderSummary();
    updateAddressBtn();
}

function updateToggleLabel(btn, noteText, noteArea) {
    const hasNote = noteText && noteText.trim().length > 0;
    const isOpen  = noteArea.classList.contains('open');
    btn.innerHTML = `
        <i class="fas fa-sticky-note"></i>
        ${hasNote ? 'Edit note' : 'Add a note'}
        <i class="fas fa-chevron-${isOpen ? 'up' : 'down'} toggle-chevron"></i>
    `;
}

function renderSummary() {
    const summaryItems = document.getElementById('summary-items');
    const totalEl      = document.getElementById('summary-total');
    summaryItems.innerHTML = '';
    let total = 0;

    cartItems.forEach(item => {
        const sub = item.price * item.qty;
        total += sub;
        const row = document.createElement('div');
        row.className = 'summary-row';
        const shortName = item.name.length > 28 ? item.name.slice(0, 28) + '…' : item.name;
        row.innerHTML = `
            <span class="item-label">${shortName}<br>
              <small style="color:#B99CC8">${item.option} × ${item.qty}</small>
            </span>
            <span class="item-val">$${sub.toFixed(2)}</span>
        `;
        summaryItems.appendChild(row);
    });

    totalEl.textContent = `$${total.toFixed(2)}`;
}

function updateAddressBtn() {
    const btn = document.getElementById('setup-address-btn');
    if (!btn) return;
    btn.disabled = cartItems.length === 0;
}

/* =====================
   MUTATIONS
   ===================== */
async function changeQty(cartId, delta) {
    const idx = cartItems.findIndex(ci => ci.cartId === cartId);
    if (idx === -1) return;

    const prevQty = cartItems[idx].qty;
    const newQty  = Math.max(1, prevQty + delta);
    if (newQty === prevQty) return;

    cartItems[idx].qty = newQty;
    render();

    try {
        await apiUpdateQty(cartId, newQty);
    } catch (err) {
        console.error('changeQty error:', err);
        cartItems[idx].qty = prevQty;
        render();
        showToast('Could not update quantity. Please try again.');
    }
}

async function removeItem(cartId) {
    const snapshot = [...cartItems];
    cartItems = cartItems.filter(ci => ci.cartId !== cartId);
    render();
    showToast('Item removed from cart');

    try {
        await apiRemoveItem(cartId);
    } catch (err) {
        console.error('removeItem error:', err);
        cartItems = snapshot;
        render();
        showToast('Could not remove item. Please try again.');
    }
}

/* =====================
   TOAST
   ===================== */
function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

/* =====================
   ADDRESS BUTTON
   ===================== */
document.getElementById('setup-address-btn')?.addEventListener('click', () => {
    if (cartItems.length === 0) return;
    sessionStorage.setItem('neko_cart_snapshot', JSON.stringify(cartItems));
    const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    sessionStorage.setItem('neko_cart_total', total.toFixed(2));
    window.location.href = 'address.html';
});

/* =====================
   INIT
   ===================== */
async function init() {
    if (!getToken()) { handleUnauth(); return; }

    const list = document.getElementById('cart-items-list');
    if (list) list.innerHTML = '<p style="color:#B99CC8;padding:1rem;">Loading cart…</p>';

    await fetchCart();
    render();
}

init();