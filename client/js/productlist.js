/* =====================================================================
   productlist.js  –  shared logic for ALL product-listing pages
   (discount.html, new-arrivals.html, figures.html, etc.)

   HOW TO USE ON A NEW PAGE:
     1. Add  <div id="product-grid"></div>  in your HTML
     2. Include  <script src="productlist.js"></script>
     3. Before that script tag, define a  window.PAGE_PRODUCTS  array
        with the products for that page, OR just let it fall back to
        the fake data below while you build the DB connection.
   ===================================================================== */

// Replace the fake DISCOUNT_PRODUCTS and the DOMContentLoaded block with:

const API = 'http://localhost:3000/api';

// Each page sets this before loading productlist.js:
// window.PAGE_FILTER = { promotion: 'discount' }
// window.PAGE_FILTER = { promotion: 'new_arrival' }
// window.PAGE_FILTER = { categoryId: 3 }

async function loadProducts() {
  const filter  = window.PAGE_FILTER || {};
  const params  = new URLSearchParams();

  if (filter.promotion)  params.append('promotion', filter.promotion);
  if (filter.categoryId) params.append('category',  filter.categoryId);
  if (filter.search)     params.append('search',    filter.search);

  const res      = await fetch(`${API}/products?${params}`);
  const products = await res.json();

  // Map API fields to what buildCard() expects
  return products.map(p => ({
    id:            p.product_id,
    name:          p.product_name,
    price:         parseFloat(p.sale_price),
    originalPrice: p.original_price ? parseFloat(p.original_price) : null,
    image:         p.primary_image  || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg',
    promotion:     p.promotion
  }));
}

document.addEventListener('DOMContentLoaded', async () => {
  const products = await loadProducts();
  renderGrid(products);
  initSearch(products);
  initNewsletter();
});
/* =====================
   WISHLIST STATE
   (per session – persist to DB / localStorage later)
   ===================== */
const wishlistState = {};  // { productId: true/false }

/* =====================
   HELPERS
   ===================== */
function formatPrice(price) {
    return "$" + price.toFixed(2);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 2500);
}

/* =====================
   BUILD A PRODUCT CARD
   ===================== */
function buildCard(product) {
    const div = document.createElement("div");
    div.className = "product-card";
    div.dataset.id = product.id;

    const wishlisted = !!wishlistState[product.id];

    div.innerHTML = `
        <div class="card-img-wrapper">
            <img src="${product.image}" alt="${product.name}" loading="lazy">
        </div>
        <div class="card-body">
            <p class="card-name" title="${product.name}">${product.name}</p>
            <div class="card-bottom">
                <span class="card-price">${formatPrice(product.price)}</span>
                <button
                    class="card-wishlist${wishlisted ? " active" : ""}"
                    data-id="${product.id}"
                    title="${wishlisted ? "Remove from wishlist" : "Add to wishlist"}"
                    aria-label="wishlist"
                >
                    <i></i>
                </button>
            </div>
        </div>
    `;

    div.addEventListener("click", (e) => {
        if (e.target.closest(".card-wishlist")) return;
        window.location.href = `../pages/productpage.html?id=${product.id}`;
    });

    /* Wishlist toggle */
    div.querySelector(".card-wishlist").addEventListener("click", (e) => {
        e.stopPropagation();
        const id = product.id;
        wishlistState[id] = !wishlistState[id];
        const btn = div.querySelector(".card-wishlist");
        btn.classList.toggle("active", wishlistState[id]);
        btn.title = wishlistState[id] ? "Remove from wishlist" : "Add to wishlist";
        showToast(wishlistState[id] ? "Added to wishlist ❤️" : "Removed from wishlist");
        // TODO: sync to DB
    });

    return div;
}

/* =====================
   RENDER GRID
   ===================== */
function renderGrid(products) {
    const grid = document.getElementById("product-grid");
    const empty = document.getElementById("empty-state");
    if (!grid) return;

    grid.innerHTML = "";

    if (!products || products.length === 0) {
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";
    products.forEach(p => grid.appendChild(buildCard(p)));
}

/* =====================
   SEARCH FILTER
   (filters the current page's products client-side;
    swap for a server search later)
   ===================== */
function initSearch(products) {
    function doFilter(query) {
        const q = query.toLowerCase().trim();
        if (!q) { renderGrid(products); return; }
        renderGrid(products.filter(p => p.name.toLowerCase().includes(q)));
    }

    ["search-input", "search-input-mobile"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => doFilter(el.value));
        /* Keep both inputs in sync */
        el.addEventListener("input", () => {
            ["search-input", "search-input-mobile"].forEach(other => {
                if (other !== id) {
                    const o = document.getElementById(other);
                    if (o) o.value = el.value;
                }
            });
        });
    });
}

/* =====================
   NEWSLETTER
   ===================== */
function initNewsletter() {
    document.getElementById("newsletter-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = e.target.querySelector("input[type=email]");
        if (input?.value) {
            showToast("Subscribed! Check your email for 10% off 🎉");
            input.value = "";
        }
    });
}