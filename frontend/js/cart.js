/**
 * cart.js — Neko Animestore Cart Page
 * Each cart entry has a unique cartId (uuid-like) so the same product can appear
 * multiple times with different notes.
 */

/* =====================
   DEMO DATA
   In production this would come from localStorage / your backend.
   Each entry has a unique `cartId` so the same product with two different
   notes becomes two separate rows.
   ===================== */
const DEMO_CART = [
    {
        cartId: 'ci_001',
        productId: 'p1',
        name: 'Demon Slayer Tanjiro Figure – Limited Edition',
        option: 'Standard',
        price: 24.99,
        qty: 1,
        img: 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
        note: ''
    },
    {
        cartId: 'ci_002',
        productId: 'p1',
        name: 'Demon Slayer Tanjiro Figure – Limited Edition',
        option: 'Box Set',
        price: 39.99,
        qty: 2,
        img: 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
        note: 'Please gift-wrap this one — it\'s a birthday present 🎁'
    },
    {
        cartId: 'ci_003',
        productId: 'p2',
        name: 'Naruto Uzumaki Hokage Figure',
        option: 'Deluxe Edition',
        price: 34.50,
        qty: 1,
        img: 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
        note: ''
    }
];

/* =====================
   STATE
   ===================== */
let cartItems = loadCart();

function loadCart() {
    try {
        const saved = sessionStorage.getItem('neko_cart');
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    // Seed demo data on first load
    sessionStorage.setItem('neko_cart', JSON.stringify(DEMO_CART));
    return JSON.parse(JSON.stringify(DEMO_CART));
}

function saveCart() {
    sessionStorage.setItem('neko_cart', JSON.stringify(cartItems));
}

/* =====================
   RENDER
   ===================== */
function render() {
    const list     = document.getElementById('cart-items-list');
    const empty    = document.getElementById('empty-cart');
    const summaryCol = document.getElementById('summary-col');
    const countEl  = document.getElementById('cart-count');

    list.innerHTML = '';

    if (cartItems.length === 0) {
        empty.style.display = 'block';
        summaryCol.style.display = 'none';
        countEl.textContent = '0';
        return;
    }

    empty.style.display = 'none';
    summaryCol.style.display = 'block';
    countEl.textContent = cartItems.reduce((s, i) => s + i.qty, 0);

    cartItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.dataset.cartId = item.cartId;

        const subtotal = (item.price * item.qty).toFixed(2);
        const hasNote  = item.note && item.note.trim().length > 0;

        div.innerHTML = `
            <div class="item-top">
                <img src="${item.img}" alt="${item.name}" class="item-img">
                <div class="item-details">
                    <div class="item-name" title="${item.name}">${item.name}</div>
                    <span class="item-option">${item.option}</span>
                    <div class="item-price-unit">$${item.price.toFixed(2)} each</div>
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

        // Qty -
        div.querySelector('.minus-btn').addEventListener('click', () => {
            changeQty(item.cartId, -1);
        });

        // Qty +
        div.querySelector('.plus-btn').addEventListener('click', () => {
            changeQty(item.cartId, +1);
        });

        // Remove
        div.querySelector('.remove-btn').addEventListener('click', () => {
            removeItem(item.cartId);
        });

        // Note toggle
        const noteToggle = div.querySelector('.note-toggle');
        const noteArea   = div.querySelector('.note-area');
        const chevron    = div.querySelector('.toggle-chevron');
        noteToggle.addEventListener('click', () => {
            const open = noteArea.classList.toggle('open');
            chevron.className = `fas fa-chevron-${open ? 'up' : 'down'} toggle-chevron`;
        });

        // Note save on input
        div.querySelector('.note-textarea').addEventListener('input', (e) => {
            const idx = cartItems.findIndex(ci => ci.cartId === item.cartId);
            if (idx !== -1) {
                cartItems[idx].note = e.target.value;
                saveCart();
                updateToggleLabel(noteToggle, e.target.value);
            }
        });

        list.appendChild(div);
    });

    renderSummary();
    updateAddressBtn();
}

function updateToggleLabel(btn, noteText) {
    const hasNote = noteText && noteText.trim().length > 0;
    btn.innerHTML = `
        <i class="fas fa-sticky-note"></i>
        ${hasNote ? 'Edit note' : 'Add a note'}
        <i class="fas fa-chevron-${btn.nextElementSibling.classList.contains('open') ? 'up' : 'down'} toggle-chevron"></i>
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
            <span class="item-label">${shortName}<br><small style="color:#B99CC8">${item.option} × ${item.qty}</small></span>
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
function changeQty(cartId, delta) {
    const idx = cartItems.findIndex(ci => ci.cartId === cartId);
    if (idx === -1) return;
    cartItems[idx].qty = Math.max(1, cartItems[idx].qty + delta);
    saveCart();
    render();
}

function removeItem(cartId) {
    cartItems = cartItems.filter(ci => ci.cartId !== cartId);
    saveCart();
    render();
    showToast('Item removed from cart');
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
   PASS CART TO ADDRESS PAGE
   Save to sessionStorage so address.html can read it
   ===================== */
document.getElementById('setup-address-btn').addEventListener('click', () => {
    if (cartItems.length === 0) return;
    saveCart(); // already saved but make sure notes are flushed
    window.location.href = 'address.html';
});

/* =====================
   INIT
   ===================== */
render();