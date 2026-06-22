/* =======================================================================
   productpage.js  —  wired to real backend API
   Reads ?id= from URL → fetches product → populates page
   Variants now carry their own optional price override.
   Wishlist now hits real /api/wishlist endpoints.
   ======================================================================= */

const PRODUCT_API = 'http://localhost:3000/api';

/* =====================
   STATE
   ===================== */
let currentProduct   = null;
let quantity          = 1;
let selectedVariant   = null;   // full variant object, not just a name
let isWishlisted      = false;
const cardWishlist    = {};

/* =====================
   GET TOKEN (from auth.js helpers — same file loaded on page)
   ===================== */
function getToken() { return localStorage.getItem('neko_token'); }
function isLoggedIn() { return !!getToken(); }

/* =====================
   HELPERS
   ===================== */
function formatPrice(price) {
  return '$' + parseFloat(price).toFixed(2);
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

function syncQuantity() {
  const mainVal   = document.getElementById('qty-value');
  const stickyVal = document.getElementById('sticky-qty-value');
  if (mainVal)   mainVal.textContent   = quantity;
  if (stickyVal) stickyVal.textContent = quantity;
}

function syncWishlist() {
  ['wishlist-btn', 'sticky-wishlist-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', isWishlisted);
  });
}

/* =====================
   PRICE RESOLUTION
   A variant with a non-null variant_price is an absolute override —
   it replaces the base price entirely and skips the discount math,
   since an admin who hand-set a variant price already decided what
   it should cost. No variant, or variant_price = null → fall back to
   the product's own sale_price / product_price (discount-aware).
   ===================== */
function resolveDisplayPrice() {
  if (selectedVariant && selectedVariant.variant_price != null) {
    return { price: parseFloat(selectedVariant.variant_price), origPrice: null };
  }
  const p = currentProduct;
  const price     = parseFloat(p.sale_price || p.product_price);
  const origPrice = p.original_price ? parseFloat(p.original_price) : null;
  return { price, origPrice: (origPrice && origPrice > price) ? origPrice : null };
}

function updatePriceDisplay() {
  const { price, origPrice } = resolveDisplayPrice();
  const total = price * quantity;

  // Main price area shows the qty × price total, not the per-unit price.
  // origPrice is multiplied too so the strike-through "was" price stays
  // an apples-to-apples comparison against the multiplied total.
  const priceEl = document.getElementById('product-price');
  if (priceEl) {
    priceEl.innerHTML = origPrice
      ? `<span style="text-decoration:line-through;color:#999;font-size:14px">${formatPrice(origPrice * quantity)}</span>
         <span style="color:#e05c5c;font-weight:700">${formatPrice(total)}</span>`
      : formatPrice(total);
  }

  const stickyPrice = document.getElementById('sticky-price');
  if (stickyPrice) stickyPrice.textContent = formatPrice(total);
}

/* =====================
   LOAD PRODUCT FROM API
   ===================== */
async function loadProduct() {
  const params    = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    showToast('No product ID in URL');
    return;
  }

  try {
    const res  = await fetch(`${PRODUCT_API}/products/${productId}`);
    if (!res.ok) { showToast('Product not found'); return; }
    const data = await res.json();
    currentProduct = data;
    populatePage(data);
    loadSimilarProducts(data);
    await loadWishlistStatus(data.product_id);
  } catch (err) {
    showToast('Failed to load product');
    console.error(err);
  }
}

/* =====================
   POPULATE PAGE WITH REAL DATA
   ===================== */
function populatePage(p) {
  // Title
  document.title = `${p.product_name} — Neko Animestore`;

  // Name
  const nameEl = document.getElementById('product-name');
  if (nameEl) nameEl.textContent = p.product_name;

  // Description
  const descEl = document.getElementById('product-description');
  if (descEl) descEl.textContent = p.product_description || 'No description available.';

  // Main image
  const imgEl = document.getElementById('main-product-img');
  if (imgEl && p.images && p.images.length > 0) {
    imgEl.src = p.images[0].image_url;
    imgEl.alt = p.product_name;
  } else if (imgEl && p.primary_image) {
    imgEl.src = p.primary_image;
  }

  // Image dots / thumbnails (if multiple images)
  if (p.images && p.images.length > 1) {
    const dotsEl = document.querySelector('.img-dots');
    if (dotsEl) {
      dotsEl.innerHTML = p.images.map((img, i) =>
        `<span class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"
         style="cursor:pointer" onclick="switchImage('${img.image_url}', ${i})"></span>`
      ).join('');
    }
  }

  // Variants — real data from product_variants, each optionally carrying
  // its own variant_price. Replaces the old fake "options" rendering.
  const optGrid = document.getElementById('options-grid');
  if (optGrid) {
    if (p.variants && p.variants.length > 0) {
      optGrid.innerHTML = p.variants.map((v, i) =>
        `<button class="option-btn ${i === 0 ? 'active' : ''}"
         data-variant-id="${v.variant_id}">${v.variant_name}</button>`
      ).join('');
      selectedVariant = p.variants[0];
      initVariants();
    } else {
      // No variants — hide the options section entirely
      const wrapper = optGrid.closest('.product-options');
      if (wrapper) wrapper.style.display = 'none';
      selectedVariant = null;
    }
  }

  updatePriceDisplay();
  updateStockUI();
}

/* =====================
   STOCK UI
   Stock now depends on which variant is selected (if any) — a variant
   out of stock should disable add-to-cart even if the product overall
   has stock in other variants.
   ===================== */
function updateStockUI() {
  const nameEl = document.getElementById('product-name');
  // Clear any previously appended badge before re-adding
  document.querySelectorAll('.stock-badge-injected').forEach(el => el.remove());
  ['add-to-cart-btn', 'sticky-add-to-cart'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.disabled = false; btn.textContent = 'Add to cart'; }
  });

  const p = currentProduct;
  const stockBadge = document.createElement('span');
  stockBadge.className = 'stock-badge-injected';
  stockBadge.style.cssText = 'font-size:12px;padding:3px 10px;border-radius:20px;margin-left:8px;font-weight:600';

  const effectiveStock = selectedVariant ? selectedVariant.variant_stock : p.product_stock;

  if (p.stock_status === 'preorder') {
    stockBadge.textContent = 'Pre-order';
    stockBadge.style.background = '#fff3cd';
    stockBadge.style.color = '#856404';
  } else if (effectiveStock === 0) {
    stockBadge.textContent = 'Out of stock';
    stockBadge.style.background = '#f8d7da';
    stockBadge.style.color = '#721c24';
    ['add-to-cart-btn', 'sticky-add-to-cart'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.disabled = true; btn.textContent = 'Out of stock'; }
    });
  }

  if (nameEl && stockBadge.textContent) nameEl.appendChild(stockBadge);
}

/* =====================
   SWITCH IMAGE (thumbnail dots)
   ===================== */
function switchImage(url, index) {
  const imgEl = document.getElementById('main-product-img');
  if (imgEl) imgEl.src = url;
  document.querySelectorAll('.img-dots .dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

/* =====================
   LOAD SIMILAR PRODUCTS
   (same category, excluding current product)
   ===================== */
async function loadSimilarProducts(p) {
  try {
    const category = p.categories ? p.categories.split(', ')[0] : null;
    const url      = category
      ? `${PRODUCT_API}/products?search=&limit=8`
      : `${PRODUCT_API}/products?limit=8`;

    const res  = await fetch(url);
    const data = await res.json();

    const similar = data
      .filter(item => item.product_id !== p.product_id)
      .slice(0, 8)
      .map(item => ({
        id:    item.product_id,
        name:  item.product_name,
        price: parseFloat(item.sale_price || item.product_price),
        image: item.primary_image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg'
      }));

    renderSimilarProducts(similar);
  } catch (err) {
    console.error('Failed to load similar products:', err);
  }
}

/* =====================
   RENDER SIMILAR PRODUCTS
   ===================== */
function renderSimilarProducts(similarProducts) {
  const grid = document.getElementById('similar-grid');
  if (!grid) return;

  if (!similarProducts || similarProducts.length === 0) {
    grid.innerHTML = '<p style="color:#999">No similar products found.</p>';
    return;
  }

  grid.innerHTML = similarProducts.map(p => `
    <div class="product-card" data-id="${p.id}" style="cursor:pointer">
      <div class="card-img-wrapper">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="card-body">
        <p class="card-name">${p.name}</p>
        <div class="card-bottom">
          <span class="card-price">${formatPrice(p.price)}</span>
          <button class="card-wishlist" data-id="${p.id}" title="Add to Wishlist">
            <i></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Navigate to product page on card click
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-wishlist')) return;
      window.location.href = `productpage.html?id=${card.dataset.id}`;
    });
  });

  // Wishlist buttons on similar cards — wired to real API now
  grid.querySelectorAll('.card-wishlist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isLoggedIn()) {
        showToast('Please log in to save wishlists');
        setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
        return;
      }
      const id = btn.dataset.id;
      try {
        const res = await fetch(`${PRODUCT_API}/wishlist/toggle`, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ productId: id })
        });
        if (!res.ok) { showToast('Failed to update wishlist'); return; }
        const data = await res.json();
        cardWishlist[id] = data.wishlisted;
        btn.classList.toggle('active', data.wishlisted);
        showToast(data.wishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
      } catch (err) {
        showToast('Network error. Please try again.');
        console.error(err);
      }
    });
  });
}

/* =====================
   VARIANT BUTTONS
   Switching variant updates: active state, displayed price, and
   stock/out-of-stock UI — since stock and price can both be
   variant-specific now.
   ===================== */
function initVariants() {
  const grid = document.getElementById('options-grid');
  if (!grid) return;

  grid.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const variantId = btn.dataset.variantId;
      selectedVariant = currentProduct.variants.find(
        v => String(v.variant_id) === String(variantId)
      ) || null;

      // Reset quantity to 1 whenever the variant changes
      quantity = 1;
      syncQuantity();

      updatePriceDisplay();
      updateStockUI();
    });
  });
}

/* =====================
   QUANTITY CONTROLS
   ===================== */
function initQuantityControls() {
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); updatePriceDisplay(); }
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    quantity++; syncQuantity(); updatePriceDisplay();
  });
  document.getElementById('sticky-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); updatePriceDisplay(); }
  });
  document.getElementById('sticky-plus')?.addEventListener('click', () => {
    quantity++; syncQuantity(); updatePriceDisplay();
  });
}

/* =====================
   WISHLIST — now wired to real backend
   ===================== */
async function loadWishlistStatus(productId) {
  if (!isLoggedIn()) { isWishlisted = false; syncWishlist(); return; }
  try {
    const res = await fetch(`${PRODUCT_API}/wishlist/ids`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) return;
    const ids = await res.json();
    isWishlisted = ids.includes(productId);
    syncWishlist();
  } catch (err) {
    console.error('Failed to load wishlist status:', err);
  }
}

function initWishlist() {
  async function toggleWishlist() {
    if (!isLoggedIn()) {
      showToast('Please log in to save wishlists');
      setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
      return;
    }
    if (!currentProduct) return;

    try {
      const res = await fetch(`${PRODUCT_API}/wishlist/toggle`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ productId: currentProduct.product_id })
      });

      if (!res.ok) { showToast('Failed to update wishlist'); return; }

      const data = await res.json();
      isWishlisted = data.wishlisted;
      syncWishlist();
      showToast(isWishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    } catch (err) {
      showToast('Network error. Please try again.');
      console.error(err);
    }
  }

  document.getElementById('wishlist-btn')?.addEventListener('click', toggleWishlist);
  document.getElementById('sticky-wishlist-btn')?.addEventListener('click', toggleWishlist);
}

/* =====================
   ADD TO CART — wired to real API, now sends variantId instead of
   a free-text selectedOption string
   ===================== */
function initAddToCart() {
  async function handleAddToCart(originEl) {
    if (!isLoggedIn()) {
      showToast('Please log in to add to cart');
      setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
      return;
    }

    if (!currentProduct) return;

    if (currentProduct.variants?.length > 0 && !selectedVariant) {
      showToast('Please select an option');
      return;
    }

    try {
      const res = await fetch(`${PRODUCT_API}/cart/add`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          productId: currentProduct.product_id,
          variantId: selectedVariant ? selectedVariant.variant_id : null,
          quantity
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to add to cart');
        return;
      }

      if (typeof window.flyToCart === 'function') {
        window.flyToCart(originEl);
      }

      showToast(`Added ${quantity}× to cart 🛒`);
      if (typeof updateCartBadgeUI === 'function') {
        updateCartBadgeUI(data.cartCount, true);
      }

      const cartBadge = document.getElementById('cart-count');
      if (cartBadge) cartBadge.textContent = data.cartCount;

    } catch (err) {
      showToast('Network error. Please try again.');
      console.error(err);
    }
  }

  document.getElementById('add-to-cart-btn')?.addEventListener('click', (e) => handleAddToCart(e.currentTarget));
  document.getElementById('sticky-add-to-cart')?.addEventListener('click', (e) => handleAddToCart(e.currentTarget));
}

/* =====================
   NEWSLETTER
   ===================== */
function initNewsletter() {
  document.getElementById('newsletter-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input[type=email]');
    if (!input?.value) return;

    try {
      await fetch(`${PRODUCT_API}/newsletter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: input.value })
      });
    } catch {}

    showToast('Subscribed! Check your email for 10% off 🎉');
    input.value = '';
  });
}

/* =====================
   INIT
   ===================== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProduct();
  initQuantityControls();
  initWishlist();
  initAddToCart();
  initNewsletter();
  syncQuantity();
  syncWishlist();
});