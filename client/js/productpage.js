/* =======================================================================
   productpage.js  —  wired to real backend API
   Reads ?id= from URL → fetches product → populates page
   ======================================================================= */

const API = 'http://localhost:3000/api';

/* =====================
   STATE
   ===================== */
let currentProduct  = null;
let quantity        = 1;
let selectedOption  = null;
let isWishlisted    = false;
const cardWishlist  = {};

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
   LOAD PRODUCT FROM API
   ===================== */
async function loadProduct() {
  // Get ?id= from URL
  const params    = new URLSearchParams(window.location.search);
  const productId = params.get('id');

  if (!productId) {
    showToast('No product ID in URL');
    return;
  }

  try {
    const res  = await fetch(`${API}/products/${productId}`);
    if (!res.ok) { showToast('Product not found'); return; }
    const data = await res.json();
    currentProduct = data;
    populatePage(data);
    loadSimilarProducts(data);
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

  // Price (show sale price if discounted)
  const price     = parseFloat(p.sale_price || p.product_price);
  const origPrice = p.original_price ? parseFloat(p.original_price) : null;

  const priceEl = document.getElementById('product-price');
  if (priceEl) {
    if (origPrice && origPrice > price) {
      priceEl.innerHTML = `
        <span style="text-decoration:line-through;color:#999;font-size:14px">${formatPrice(origPrice)}</span>
        <span style="color:#e05c5c;font-weight:700">${formatPrice(price)}</span>`;
    } else {
      priceEl.textContent = formatPrice(price);
    }
  }

  // Sticky price
  const stickyPrice = document.getElementById('sticky-price');
  if (stickyPrice) stickyPrice.textContent = formatPrice(price);

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

  // Options
  const optGrid = document.getElementById('options-grid');
  if (optGrid) {
    if (p.options && p.options.length > 0) {
      optGrid.innerHTML = p.options.map((opt, i) =>
        `<button class="option-btn ${i === 0 ? 'active' : ''}" 
         data-option="${opt.option_name}">${opt.option_name}</button>`
      ).join('');
      selectedOption = p.options[0].option_name;
      initOptions();
    } else {
      // No options — hide the options section
      optGrid.closest('.product-options')?.style && (optGrid.closest('.product-options').style.display = 'none');
      selectedOption = null;
    }
  }

  // Stock status badge
  const stockBadge = document.createElement('span');
  stockBadge.style.cssText = 'font-size:12px;padding:3px 10px;border-radius:20px;margin-left:8px;font-weight:600';
  if (p.stock_status === 'preorder') {
    stockBadge.textContent = 'Pre-order';
    stockBadge.style.background = '#fff3cd';
    stockBadge.style.color = '#856404';
  } else if (p.product_stock === 0) {
    stockBadge.textContent = 'Out of stock';
    stockBadge.style.background = '#f8d7da';
    stockBadge.style.color = '#721c24';
    // Disable add to cart
    ['add-to-cart-btn','sticky-add-to-cart'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) { btn.disabled = true; btn.textContent = 'Out of stock'; }
    });
  }
  const nameEl2 = document.getElementById('product-name');
  if (nameEl2 && stockBadge.textContent) nameEl2.appendChild(stockBadge);
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
      ? `${API}/products?search=&limit=8`
      : `${API}/products?limit=8`;

    const res  = await fetch(url);
    const data = await res.json();

    // Exclude current product
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

  // Wishlist buttons on similar cards
  grid.querySelectorAll('.card-wishlist').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      cardWishlist[id] = !cardWishlist[id];
      btn.classList.toggle('active', cardWishlist[id]);
      showToast(cardWishlist[id] ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    });
  });
}

/* =====================
   OPTION BUTTONS
   ===================== */
function initOptions() {
  const grid = document.getElementById('options-grid');
  if (!grid) return;

  grid.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedOption = btn.dataset.option;
    });
  });
}

/* =====================
   QUANTITY CONTROLS
   ===================== */
function initQuantityControls() {
  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); }
  });
  document.getElementById('qty-plus')?.addEventListener('click', () => {
    quantity++; syncQuantity();
  });
  document.getElementById('sticky-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); }
  });
  document.getElementById('sticky-plus')?.addEventListener('click', () => {
    quantity++; syncQuantity();
  });
}

/* =====================
   WISHLIST
   ===================== */
function initWishlist() {
  async function toggleWishlist() {
    if (!isLoggedIn()) {
      showToast('Please log in to save wishlists');
      setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
      return;
    }
    isWishlisted = !isWishlisted;
    syncWishlist();
    showToast(isWishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
    // TODO: wire to /api/wishlist when endpoint is built
  }

  document.getElementById('wishlist-btn')?.addEventListener('click', toggleWishlist);
  document.getElementById('sticky-wishlist-btn')?.addEventListener('click', toggleWishlist);
}

/* =====================
   ADD TO CART — wired to real API
   ===================== */
function initAddToCart() {
  async function handleAddToCart() {
    if (!isLoggedIn()) {
      showToast('Please log in to add to cart');
      setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
      return;
    }

    if (!currentProduct) return;

    // Check if product has options but none selected
    if (currentProduct.options?.length > 0 && !selectedOption) {
      showToast('Please select an option');
      return;
    }

    try {
      const res = await fetch(`${API}/cart/add`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          productId:      currentProduct.product_id,
          selectedOption: selectedOption || null,
          quantity
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to add to cart');
        return;
      }

      showToast(`Added ${quantity}× to cart 🛒`);

      // Update cart count badge if it exists in header
      const cartBadge = document.getElementById('cart-count');
      if (cartBadge) cartBadge.textContent = data.cartCount;

    } catch (err) {
      showToast('Network error. Please try again.');
      console.error(err);
    }
  }

  document.getElementById('add-to-cart-btn')?.addEventListener('click', handleAddToCart);
  document.getElementById('sticky-add-to-cart')?.addEventListener('click', handleAddToCart);
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
      await fetch(`${API}/newsletter`, {
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
  await loadProduct();       // ← fetch real product first
  initQuantityControls();
  initWishlist();
  initAddToCart();
  initNewsletter();
  syncQuantity();
  syncWishlist();
});