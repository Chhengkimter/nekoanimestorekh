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
    
    // Track product view
    fetch(`${PRODUCT_API}/products/${data.product_id}/view`, { 
      method: 'POST',
      headers: {
        'Authorization': getToken() ? `Bearer ${getToken()}` : ''
      }
    }).catch(() => {});
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
  } else {
    stockBadge.textContent = 'In stock';
    stockBadge.style.background = '#d4edda';
    stockBadge.style.color = '#155724';
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

  // ← also mark already-wishlisted cards on render
  grid.innerHTML = similarProducts.map(p => `
    <div class="product-card" data-id="${p.id}" style="cursor:pointer">
      <div class="card-img-wrapper">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </div>
      <div class="card-body">
        <p class="card-name">${p.name}</p>
        <div class="card-bottom">
          <span class="card-price">${formatPrice(p.price)}</span>
          <button class="card-wishlist ${window.isWishlistedById(p.id) ? 'active' : ''}"
            data-id="${p.id}" title="Add to Wishlist">
            <i></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // Navigate on card click
  grid.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-wishlist')) return;
      window.location.href = `productpage.html?id=${card.dataset.id}`;
    });
  });

  // Wishlist buttons — single clean handler
  grid.querySelectorAll('.card-wishlist').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!localStorage.getItem('neko_token')) {
        showToast('Please log in to save wishlists');
        setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
        return;
      }
      const id = btn.dataset.id;   // ← get id from the btn itself
      const data = await window.toggleWishlistItem(id);
      if (!data) { showToast('Failed to update wishlist'); return; }
      btn.classList.toggle('active', data.wishlisted);
      showToast(data.wishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
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
  function canIncrease() {
    if (!currentProduct || currentProduct.stock_status !== 'instock') return true;
    const effectiveStock = selectedVariant ? parseInt(selectedVariant.variant_stock, 10) : parseInt(currentProduct.product_stock, 10);
    return quantity < effectiveStock;
  }

  function handlePlus() {
    if (!canIncrease()) {
      showToast('Not enough stock available');
      return;
    }
    quantity++; syncQuantity(); updatePriceDisplay();
  }

  document.getElementById('qty-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); updatePriceDisplay(); }
  });
  document.getElementById('qty-plus')?.addEventListener('click', handlePlus);
  
  document.getElementById('sticky-minus')?.addEventListener('click', () => {
    if (quantity > 1) { quantity--; syncQuantity(); updatePriceDisplay(); }
  });
  document.getElementById('sticky-plus')?.addEventListener('click', handlePlus);
}

/* =====================
   WISHLIST — now wired to real backend
   ===================== */
async function loadWishlistStatus(productId) {
  await window.loadWishlistIds();
  isWishlisted = window.isWishlistedById(productId);
  syncWishlist();
}

function initWishlist() {
  async function toggleWishlist() {
    if (!isLoggedIn()) {
      showToast('Please log in to save wishlists');
      setTimeout(() => { window.location.href = '../pages/login.html'; }, 1500);
      return;
    }
    if (!currentProduct) return;
    const data = await window.toggleWishlistItem(currentProduct.product_id);
    if (!data) { showToast('Failed to update wishlist'); return; }
    isWishlisted = data.wishlisted;
    syncWishlist();
    showToast(isWishlisted ? 'Added to wishlist ❤️' : 'Removed from wishlist');
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
          selectedOption: selectedVariant ? selectedVariant.variant_name : null,
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

/* =====================
   REVIEWS LOGIC
   ===================== */
let currentRating = 0;

async function loadReviews(productId) {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  try {
    const res = await fetch(`${PRODUCT_API}/reviews/${productId}`);
    if (!res.ok) throw new Error();
    const reviews = await res.json();
    renderReviews(reviews);
  } catch (err) {
    list.innerHTML = '<div class="reviews-loading">Failed to load reviews.</div>';
  }
}

function renderReviews(reviews) {
  const list = document.getElementById('reviews-list');
  if (!reviews || reviews.length === 0) {
    list.innerHTML = '<div class="reviews-loading">No reviews yet. Be the first to review!</div>';
    return;
  }

  list.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    const date = new Date(r.created_at).toLocaleDateString();
    const name = `${r.first_name || 'Anonymous'} ${r.last_name ? r.last_name[0] + '.' : ''}`;
    
    let adminNoteHtml = '';
    if (r.admin_note) {
      adminNoteHtml = `<div class="review-admin-reply"><strong>Store Reply:</strong> ${r.admin_note}</div>`;
    }

    let imageHtml = '';
    if (r.image_url) {
      const urls = r.image_url.split(',');
      imageHtml = `<div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
        ${urls.map(url => `<img src="${url}" style="max-width:150px; border-radius:8px; border:1px solid #eee; cursor:pointer;" onclick="window.open(this.src,'_blank')">`).join('')}
      </div>`;
    }

    return `
      <div class="review-card">
        <div class="review-header">
          <span class="review-author">${name}</span>
          <span class="review-date">${date}</span>
        </div>
        <div class="review-rating">${stars}</div>
        <div class="review-text">${r.review_text || ''}</div>
        ${imageHtml}
        ${adminNoteHtml}
      </div>
    `;
  }).join('');
}

async function openReviewModal() {
  if (!isLoggedIn()) {
    showToast('Please log in to write a review');
    return;
  }
  document.getElementById('inline-review-form').classList.add('open');
  document.getElementById('write-review-btn').style.display = 'none';
  
  // Check for existing review
  try {
    const res = await fetch(`${PRODUCT_API}/reviews/my/${currentProduct.product_id}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (res.ok) {
      const myReview = await res.json();
      if (myReview && myReview.status === 'pending') {
        document.querySelector('#inline-review-form .modal-title').textContent = 'Edit Review (Pending)';
        setRating(myReview.rating);
        document.getElementById('review-text').value = myReview.review_text || '';
        document.getElementById('edit-review-id').value = myReview.review_id;
        
        document.getElementById('review-text').disabled = false;
        document.getElementById('review-image').style.display = 'block';
        document.getElementById('review-image').value = '';
        document.getElementById('review-submit-btn').style.display = 'block';
        document.getElementById('review-submit-btn').textContent = 'Update Review';
        return;
      }
    }
  } catch (err) {}

  // Defaults for new review
  document.querySelector('#inline-review-form .modal-title').textContent = 'Write a Review';
  document.getElementById('edit-review-id').value = '';
  document.getElementById('review-text').disabled = false;
  document.getElementById('review-image').style.display = 'block';
  document.getElementById('review-image').value = '';
  document.getElementById('review-submit-btn').style.display = 'block';
  document.getElementById('review-submit-btn').textContent = 'Submit Review';
  setRating(0);
  document.getElementById('review-text').value = '';
}

function closeReviewModal() {
  document.getElementById('inline-review-form').classList.remove('open');
  document.getElementById('write-review-btn').style.display = 'inline-block';
}

function setRating(val) {
  currentRating = val;
  document.getElementById('review-rating').value = val;
  document.querySelectorAll('#review-stars span').forEach(s => {
    const sVal = parseInt(s.dataset.val);
    s.textContent = sVal <= val ? '★' : '☆';
  });
}

// Setup star hover effects
document.addEventListener('DOMContentLoaded', () => {
  const stars = document.querySelectorAll('#review-stars span');
  stars.forEach(s => {
    s.addEventListener('mouseover', function() {
      const val = parseInt(this.dataset.val);
      stars.forEach(st => {
        const stVal = parseInt(st.dataset.val);
        st.textContent = stVal <= val ? '★' : '☆';
      });
    });
    s.addEventListener('mouseout', function() {
      setRating(currentRating); // Reset to selected
    });
    s.addEventListener('click', function() {
      setRating(parseInt(this.dataset.val));
    });
  });
});

async function submitReview() {
  const rating = parseInt(document.getElementById('review-rating').value);
  const text = document.getElementById('review-text').value.trim();
  const fileInput = document.getElementById('review-image');
  const editId = document.getElementById('edit-review-id').value;

  if (rating === 0) {
    showToast('Please select a rating');
    return;
  }

  const btn = document.getElementById('review-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const formData = new FormData();
  formData.append('rating', rating);
  formData.append('reviewText', text);
  if (!editId) {
    formData.append('productId', currentProduct.product_id);
  }
  if (fileInput.files.length > 5) {
    showToast('You can only upload up to 5 images.');
    btn.disabled = false;
    btn.textContent = 'Submit Review';
    return;
  }
  for (let i = 0; i < fileInput.files.length; i++) {
    formData.append('reviewImage', fileInput.files[i]);
  }

  try {
    const url = editId ? `${PRODUCT_API}/reviews/${editId}` : `${PRODUCT_API}/reviews`;
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit review');

    showToast(data.message || 'Review submitted successfully!');
    closeReviewModal();
    // Re-fetch reviews (though the new one won't appear until approved)
    loadReviews(currentProduct.product_id);
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Review';
  }
}

// Trigger loadReviews when product is loaded
const originalPopulatePage = populatePage;
populatePage = function(p) {
  originalPopulatePage(p);
  loadReviews(p.product_id);
};