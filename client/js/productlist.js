/* =======================================================================
   productlist.js — shared logic for ALL product listing pages
   ======================================================================= */

const PRODUCTLIST_API = 'http://localhost:3000/api';

/* =====================
   HELPERS
   ===================== */
function formatPrice(price) {
  return '$' + parseFloat(price).toFixed(2);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
}

function mapProduct(p) {
  return {
    id:            p.product_id,
    name:          p.product_name,
    price:         parseFloat(p.sale_price || p.product_price),
    originalPrice: p.original_price ? parseFloat(p.original_price) : null,
    image:         p.primary_image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
    promotion:     p.promotion || null,
    stockStatus:   p.stock_status
  };
}

/* =====================
   LOAD PRODUCTS
   ===================== */
async function loadProducts() {
  const filter = window.PAGE_FILTER || {};

  if (filter.slug) {
    const res = await fetch(`${PRODUCTLIST_API}/pages/${filter.slug}`);
    if (!res.ok) { showToast('Page not found'); return []; }
    const data = await res.json();

    const bannerImg   = document.getElementById('collection-banner-img');
    const bannerTitle = document.getElementById('collection-banner-title');
    const bannerWrap  = document.getElementById('collection-banner');

    if (bannerImg && data.page.banner_url) {
      bannerImg.src = data.page.banner_url;
      bannerImg.alt = data.page.title;
    }
    if (bannerTitle) bannerTitle.textContent = data.page.title;
    if (!data.page.banner_url && bannerWrap) bannerWrap.style.display = 'none';
    document.title = `${data.page.title} — Neko Animestore`;

    return (data.products || []).map(mapProduct);
  }

  const params = new URLSearchParams();
  if (filter.promotion)  params.append('promotion', filter.promotion);
  if (filter.categoryId) params.append('category',  filter.categoryId);
  if (filter.search)     params.append('search',    filter.search);

  const res      = await fetch(`${PRODUCTLIST_API}/products?${params}`);
  const products = await res.json();
  return products.map(mapProduct);
}

/* =====================
   BUILD PRODUCT CARD
   ===================== */
function buildCard(product) {
  // ← single declaration, uses shared wishlistState from partials.js
  const wishlisted = window.isWishlistedById(product.id);

  const div = document.createElement('div');
  div.className  = 'product-card';
  div.dataset.id = product.id;

  const discountBadge = product.originalPrice && product.originalPrice > product.price
    ? `<span class="card-badge sale">SALE</span>` : '';

  const promoBadge = product.promotion && product.promotion !== 'discount'
    ? `<span class="card-badge promo">${product.promotion.replace('_', ' ')}</span>` : '';

  const stockBadge = product.stockStatus === 'preorder'
    ? `<span class="card-badge preorder">Pre-order</span>`
    : (product.stockStatus === 'instock' ? `<span class="card-badge instock">In stock</span>` : '');

  div.innerHTML = `
    <div class="card-img-wrapper">
      <div class="card-badges">
        ${discountBadge}${promoBadge}${stockBadge}
      </div>
      <img src="${product.image}" alt="${product.name}" loading="lazy">
    </div>
    <div class="card-body">
      <p class="card-name" title="${product.name}">${product.name}</p>
      <div class="card-bottom">
        <div class="card-prices">
          ${product.originalPrice && product.originalPrice > product.price
            ? `<span class="card-price-original">${formatPrice(product.originalPrice)}</span>
               <span class="card-price sale">${formatPrice(product.price)}</span>`
            : `<span class="card-price">${formatPrice(product.price)}</span>`
          }
        </div>
        <button
          class="card-wishlist${wishlisted ? ' active' : ''}"
          data-id="${product.id}"
          title="${wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
          aria-label="wishlist"
        ><i></i></button>
      </div>
    </div>
  `;

  div.addEventListener('click', (e) => {
    if (e.target.closest('.card-wishlist')) return;
    window.location.href = `productpage.html?id=${product.id}`;
  });

  // ← single click handler, uses shared toggleWishlistItem from partials.js
  div.querySelector('.card-wishlist').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!localStorage.getItem('neko_token')) {
      showToast('Please log in to save wishlists');
      return;
    }
    const data = await window.toggleWishlistItem(product.id);
    if (!data) { showToast('Failed to update wishlist'); return; }
    const btn = div.querySelector('.card-wishlist');
    btn.classList.toggle('active', data.wishlisted);
    btn.title = data.wishlisted ? 'Remove from wishlist' : 'Add to wishlist';
    showToast(data.wishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
  });

  return div;
}

/* =====================
   RENDER GRID
   ===================== */
function renderGrid(products) {
  const grid  = document.getElementById('product-grid');
  const empty = document.getElementById('empty-state');
  if (!grid) return;

  grid.innerHTML = '';

  if (!products || products.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  products.forEach(p => grid.appendChild(buildCard(p)));
}

/* =====================
   SEARCH FILTER
   ===================== */
function initSearch(products) {
  const el = document.getElementById('search-input');
  if (!el) return;
  el.addEventListener('input', () => {
    const q = el.value.toLowerCase().trim();
    if (!q) { renderGrid(products); return; }
    renderGrid(products.filter(p => p.name.toLowerCase().includes(q)));
  });
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
      await fetch(`${PRODUCTLIST_API}/newsletter`, {
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
  const grid = document.getElementById('product-grid');
  if (grid) grid.innerHTML = '<p style="color:#B99CC8;padding:2rem;text-align:center">Loading products…</p>';

  let products = [];
  try {
    await window.loadWishlistIds();   // ← load first, then render cards with correct state
    products = await loadProducts();
    renderGrid(products);
  } catch (err) {
    console.error('productlist init error:', err);
    if (grid) grid.innerHTML = '<p style="color:#e05c5c;padding:2rem;text-align:center">Failed to load products.</p>';
  }

  document.addEventListener('partials:loaded', () => {
    initSearch(products);
    initNewsletter();
  });
});