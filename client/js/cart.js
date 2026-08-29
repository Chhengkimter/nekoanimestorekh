const BASE_URL = 'http://localhost:3000/api/cart';

let cartItems = [];
let appliedCoupon = null;
let wishlistIds = [];

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

        let reducedItems = [];
        const updatePromises = [];

        cartItems = (data.items || []).map(item => {
            let parsedStock = parseInt(item.product_stock, 10);
            let qty = item.quantity;
            let stockStatus = item.stock_status;

            if (stockStatus === 'instock' && !isNaN(parsedStock) && parsedStock > 0 && qty > parsedStock) {
                qty = parsedStock;
                reducedItems.push(item.product_name);
                updatePromises.push(apiUpdateQty(item.cart_item_id, qty));
            }

            return {
                cartId:       item.cart_item_id,
                productId:    item.product_id,
                name:         item.product_name,
                option:       item.selected_option || '—',
                price:        parseFloat(item.price_snapshot),
                qty:          qty,
                img:          item.image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
                note:         item.note || '',
                currentPrice: parseFloat(item.current_price),
                stockStatus:  stockStatus,
                stockAmount:  parsedStock
            };
        });

        if (updatePromises.length > 0) {
            await Promise.allSettled(updatePromises);
            setTimeout(() => {
                showToast(`Reduced quantity for ${reducedItems.length} item(s) due to stock limits.`);
            }, 300);
        }

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
        const outOfStock = item.stockStatus === 'instock' && item.stockAmount <= 0;
        const isWishlisted = wishlistIds.includes(item.productId);

        const driftBadge = priceDrift
            ? `<span class="price-drift-badge" title="Price changed since you added this item">
                   Current price: $${item.currentPrice.toFixed(2)}
               </span>`
            : '';

        div.innerHTML = `
            <div class="item-top" style="${outOfStock ? 'opacity:0.5;' : ''}">
                <a href="productpage.html?id=${item.productId}" class="item-img-link">
                    <img src="${item.img}" alt="${item.name}" class="item-img">
                </a>
                <div class="item-details">
                    <a href="productpage.html?id=${item.productId}" class="item-name-link" title="${item.name}">${item.name}</a>
                    ${item.option && item.option !== '—' ? `<span class="item-option">${item.option}</span>` : ''}
                    <div class="item-price-unit">$${item.price.toFixed(2)} each ${driftBadge}</div>
                    ${outOfStock ? `<div style="color:#e53e3e; font-weight:bold; font-size:12px; margin-top:4px;">Out of Stock</div>` : ''}
                </div>
            </div>

            <div class="item-controls">
                <div class="qty-control" style="${outOfStock ? 'pointer-events:none; opacity:0.5;' : ''}">
                    <button class="qty-btn minus-btn" aria-label="Decrease">−</button>
                    <span class="qty-value">${item.qty}</span>
                    <button class="qty-btn plus-btn" aria-label="Increase">+</button>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                    <span class="item-subtotal">$${subtotal}</span>
                    <div style="display:flex; gap:8px;">
                        <button class="wishlist-btn" title="Add to Wishlist" style="width:32px; height:32px; border-radius:50%; border:1px solid; ${isWishlisted ? 'color:#e05c7a; border-color:#e05c7a; background:#fff0f3;' : 'color:#ccc; border-color:#e0e0e0; background:white;'} display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.color='#e05c7a'; this.style.borderColor='#e05c7a'" onmouseout="${isWishlisted ? `this.style.color='#e05c7a'; this.style.borderColor='#e05c7a'` : `this.style.color='#ccc'; this.style.borderColor='#e0e0e0'`}">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="remove-btn" title="Remove item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
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
        div.querySelector('.wishlist-btn').addEventListener('click', (e) => toggleWishlist(item.productId, e.currentTarget));

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

    // Sync the header badge whenever the cart re-renders
    const totalQty = cartItems.reduce((s, i) => s + i.qty, 0);
    if (typeof updateCartBadgeUI === 'function') {
    updateCartBadgeUI(totalQty);
    }
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
        const outOfStock = item.stockStatus === 'instock' && item.stockAmount <= 0;
        if (outOfStock) return; // Exclude out of stock items from summary
        
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

    if (appliedCoupon) {
        const row = document.createElement('div');
        row.className = 'summary-row';
        row.style.color = '#38a169';
        row.innerHTML = `
            <span class="item-label" style="font-weight:600;">Coupon (${appliedCoupon.code})
                <button onclick="removeCoupon()" style="background:none; border:none; color:#e53e3e; margin-left:8px; cursor:pointer; font-size:11px;">[Remove]</button>
            </span>
            <span class="item-val">-$${appliedCoupon.discount.toFixed(2)}</span>
        `;
        summaryItems.appendChild(row);
        total = Math.max(0, total - appliedCoupon.discount);
    }

    totalEl.textContent = `$${total.toFixed(2)}`;
}

function removeCoupon() {
    appliedCoupon = null;
    document.getElementById('cart-coupon-input').value = '';
    renderSummary();
    showToast('Coupon removed');
}

async function applyCoupon() {
    const code = document.getElementById('cart-coupon-input').value.trim();
    if (!code) return;
    
    const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    const categoryIds = cartItems.map(i => i.categoryId || i.category_id).filter(Boolean);
    
    try {
        const res = await fetch('/api/coupons/validate', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ code, cartTotal, categoryIds })
        });
        const data = await res.json();
        
        if (!res.ok || !data.valid) {
            showToast(data.error || 'Invalid coupon');
            appliedCoupon = null;
            renderSummary();
            return;
        }
        
        appliedCoupon = { code, discount: data.discount, info: data.coupon };
        showToast('Coupon applied!');
        renderSummary();
    } catch (err) {
        showToast('Error applying coupon');
    }
}

function updateAddressBtn() {
    const btn = document.getElementById('setup-address-btn');
    if (!btn) return;
    const hasOutOfStock = cartItems.some(i => i.stockStatus === 'instock' && i.stockAmount <= 0);
    // Don't disable the button if there are out-of-stock items, so they can click it to remove them
    btn.disabled = cartItems.length === 0;
    if (hasOutOfStock) {
        btn.innerHTML = `<i class="fas fa-exclamation-circle"></i> Remove out of stock items`;
        btn.style.background = '#e53e3e';
    } else {
        btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Set Up Address`;
        btn.style.background = '';
    }
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

    if (delta > 0 && cartItems[idx].stockStatus === 'instock' && newQty > parseInt(cartItems[idx].stockAmount, 10)) {
        showToast('Not enough stock available', true);
        return;
    }

    cartItems[idx].qty = newQty;
    
    // Re-validate coupon if one is applied
    if (appliedCoupon) applyCoupon();
    else render();

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
    
    // Re-validate coupon if one is applied
    if (appliedCoupon) applyCoupon();
    else render();
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

async function toggleWishlist(productId, btn) {
    try {
        const res = await fetch('http://localhost:3000/api/wishlist/toggle', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ productId })
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        
        if (data.wishlisted) {
            if (!wishlistIds.includes(productId)) wishlistIds.push(productId);
            showToast('Added to wishlist!');
            btn.style.color = '#e05c7a';
            btn.style.borderColor = '#e05c7a';
            btn.style.background = '#fff0f3';
            btn.onmouseout = function() { this.style.color='#e05c7a'; this.style.borderColor='#e05c7a'; };
        } else {
            wishlistIds = wishlistIds.filter(id => id !== productId);
            showToast('Removed from wishlist');
            btn.style.color = '#ccc';
            btn.style.borderColor = '#e0e0e0';
            btn.style.background = 'white';
            btn.onmouseout = function() { this.style.color='#ccc'; this.style.borderColor='#e0e0e0'; };
        }
    } catch (err) {
        showToast('Error updating wishlist', true);
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
document.getElementById('setup-address-btn')?.addEventListener('click', async () => {
    if (cartItems.length === 0) return;
    
    // If there are out of stock items, clicking this button should remove them
    const outOfStockItems = cartItems.filter(i => i.stockStatus === 'instock' && i.stockAmount <= 0);
    if (outOfStockItems.length > 0) {
        const btn = document.getElementById('setup-address-btn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
        
        for (const item of outOfStockItems) {
            await removeItem(item.cartId);
        }
        return; // Stop here, don't checkout yet
    }

    sessionStorage.setItem('neko_cart_snapshot', JSON.stringify(cartItems));
    
    // Recalculate total for safe measure
    const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
    
    // Calculate final total including coupon
    const finalTotal = appliedCoupon ? Math.max(0, total - appliedCoupon.discount) : total;
    sessionStorage.setItem('neko_cart_total', finalTotal.toFixed(2));
    
    if (appliedCoupon) {
        sessionStorage.setItem('neko_cart_coupon', JSON.stringify({
            code: appliedCoupon.code,
            discount: appliedCoupon.discount,
            couponId: appliedCoupon.info?.coupon_id || null
        }));
    } else {
        sessionStorage.removeItem('neko_cart_coupon');
    }
    
    window.location.href = 'address.html';
});

/* =====================
   INIT
   ===================== */
async function init() {
    if (!document.getElementById('cart-items-list')) return; // not the cart page, stop here
    if (!getToken()) { handleUnauth(); return; }

    const list = document.getElementById('cart-items-list');
    list.innerHTML = '<p style="color:#B99CC8;padding:1rem;">Loading cart…</p>';

    // Load wishlist IDs to properly color the hearts
    try {
        const res = await fetch('http://localhost:3000/api/wishlist/ids', { headers: authHeaders() });
        if (res.ok) wishlistIds = await res.json();
    } catch(e) {}

    await fetchCart();
    render();
}

init();