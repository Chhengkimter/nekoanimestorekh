/**
 * cart.js — Neko Animestore Cart Page
 * Connected to backend: GET/PATCH/DELETE /api/cart, DELETE /api/cart/clear
 */

/* =====================
   CONFIG
   Change BASE_URL to match your backend host in production.
   ===================== */
const BASE_URL = '/api/cart';   // e.g. 'https://api.nekoanimestore.com/api/cart'

/* =====================
   STATE
   ===================== */
let cartItems = [];   // filled by fetchCart()

/* =====================
   API HELPERS
   ===================== */

/**
 * Fetch the full cart from the backend.
 * Maps backend field names → the shape the renderer expects.
 */
async function fetchCart() {
    try {
        const res = await fetch(BASE_URL, {
            method: 'GET',
            credentials: 'include',   // send session cookie / JWT cookie
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.status === 401) {
            // Not logged in → redirect to login page
            window.location.href = 'login.html';
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        // Map backend rows → frontend shape
        // Backend columns: cart_item_id, product_id, product_name, selected_option,
        //                  price_snapshot, quantity, note, image, current_price, stock_status
        cartItems = (data.items || []).map(item => ({
            cartId:   item.cart_item_id,          // unique row id used for PATCH/DELETE
            productId: item.product_id,
            name:     item.product_name,
            option:   item.selected_option || '—',
            price:    parseFloat(item.price_snapshot),
            qty:      item.quantity,
            img:      item.image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
            note:     item.note || '',
            currentPrice: parseFloat(item.current_price),
            stockStatus:  item.stock_status
        }));

    } catch (err) {
        console.error('fetchCart error:', err);
        showToast('Could not load cart. Please refresh.');
    }
}

/**
 * PATCH /api/cart/:cartItemId  — update quantity
 */
async function apiUpdateQty(cartItemId, newQty) {
    const res = await fetch(`${BASE_URL}/${cartItemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * DELETE /api/cart/:cartItemId  — remove one item
 */
async function apiRemoveItem(cartItemId) {
    const res = await fetch(`${BASE_URL}/${cartItemId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/* =====================
   RENDER
   ===================== */
function render() {
    const list       = document.getElementById('cart-items-list');
    const empty      = document.getElementById('empty-cart');
    const summaryCol = document.getElementById('summary-col');
    const countEl   = document.getElementById('cart-count');

    list.innerHTML = '';

    if (cartItems.length === 0) {
        empty.style.display    = 'block';
        summaryCol.style.display = 'none';
        countEl.textContent    = '0';
        return;
    }

    empty.style.display      = 'none';
    summaryCol.style.display = 'block';
    countEl.textContent      = cartItems.reduce((s, i) => s + i.qty, 0);

    cartItems.forEach(item => {
        const div = document.createElement('div');
        div.className       = 'cart-item';
        div.dataset.cartId  = item.cartId;

        const subtotal = (item.price * item.qty).toFixed(2);
        const hasNote  = item.note && item.note.trim().length > 0;

        // Show a warning badge if the item's current price differs from the locked price
        const priceDrift = item.currentPrice !== item.price;
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

        // ── Quantity − ──────────────────────────────────────────
        div.querySelector('.minus-btn').addEventListener('click', () => {
            changeQty(item.cartId, -1);
        });

        // ── Quantity + ──────────────────────────────────────────
        div.querySelector('.plus-btn').addEventListener('click', () => {
            changeQty(item.cartId, +1);
        });

        // ── Remove ──────────────────────────────────────────────
        div.querySelector('.remove-btn').addEventListener('click', () => {
            removeItem(item.cartId);
        });

        // ── Note toggle ─────────────────────────────────────────
        const noteToggle = div.querySelector('.note-toggle');
        const noteArea   = div.querySelector('.note-area');
        const chevron    = div.querySelector('.toggle-chevron');
        noteToggle.addEventListener('click', () => {
            const open = noteArea.classList.toggle('open');
            chevron.className = `fas fa-chevron-${open ? 'up' : 'down'} toggle-chevron`;
        });

        // ── Note: debounced save on input ───────────────────────
        let noteTimer = null;
        div.querySelector('.note-textarea').addEventListener('input', (e) => {
            const idx = cartItems.findIndex(ci => ci.cartId === item.cartId);
            if (idx !== -1) cartItems[idx].note = e.target.value;
            updateToggleLabel(noteToggle, e.target.value, noteArea);

            // Debounce: save note 800 ms after the user stops typing
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
   MUTATIONS  (optimistic UI + API call)
   ===================== */

/**
 * Change qty locally then sync to backend.
 * On API failure, rollback and show toast.
 */
async function changeQty(cartId, delta) {
    const idx = cartItems.findIndex(ci => ci.cartId === cartId);
    if (idx === -1) return;

    const prevQty = cartItems[idx].qty;
    const newQty  = Math.max(1, prevQty + delta);
    if (newQty === prevQty) return;   // already at minimum

    // Optimistic update
    cartItems[idx].qty = newQty;
    render();

    try {
        await apiUpdateQty(cartId, newQty);
    } catch (err) {
        console.error('changeQty error:', err);
        // Rollback
        cartItems[idx].qty = prevQty;
        render();
        showToast('Could not update quantity. Please try again.');
    }
}

/**
 * Remove item locally then sync to backend.
 * On failure, re-fetch from server to restore accurate state.
 */
async function removeItem(cartId) {
    const snapshot = [...cartItems];

    // Optimistic remove
    cartItems = cartItems.filter(ci => ci.cartId !== cartId);
    render();
    showToast('Item removed from cart');

    try {
        await apiRemoveItem(cartId);
    } catch (err) {
        console.error('removeItem error:', err);
        cartItems = snapshot;   // rollback
        render();
        showToast('Could not remove item. Please try again.');
    }
}

/**
 * Save note for a cart item via PATCH (reuses the quantity endpoint —
 * backend PATCH /api/cart/:id updates whichever fields are sent).
 * If your backend requires a separate note endpoint, adjust the URL here.
 */
async function saveNote(cartId, note) {
    try {
        const res = await fetch(`${BASE_URL}/${cartId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        console.error('saveNote error:', err);
        // Silent fail: note is kept in local state; user can retry by typing again
    }
}

/* =====================
   TOAST
   ===================== */
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

/* =====================
   ADDRESS BUTTON
   Pass the current cart snapshot to address.html via sessionStorage
   so the address page knows what's being ordered.
   ===================== */
document.getElementById('setup-address-btn').addEventListener('click', () => {
    if (cartItems.length === 0) return;
    // Store a lightweight snapshot (cartId + qty + note) for the address page
    sessionStorage.setItem('neko_cart_snapshot', JSON.stringify(cartItems));
    window.location.href = 'address.html';
});

/* =====================
   INIT — load from backend then render
   ===================== */
async function init() {
    // Show a subtle loading state while fetching
    const list = document.getElementById('cart-items-list');
    list.innerHTML = '<p style="color:#B99CC8;padding:1rem;">Loading cart…</p>';

    await fetchCart();
    render();
}

init();