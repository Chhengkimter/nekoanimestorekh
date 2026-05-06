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

/* =====================
   FAKE DATA
   Replace each array / fetch with real DB calls later.
   ===================== */
const DISCOUNT_PRODUCTS = [
    { id: 1,  name: "Tanjiro Figure",          price: 24.99, originalPrice: 34.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 2,  name: "Nezuko Plushie",          price: 14.99, originalPrice: 19.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 3,  name: "Zenitsu Keychain",        price: 5.99,  originalPrice: 8.99,  image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 4,  name: "Inosuke Poster",          price: 9.99,  originalPrice: 14.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 5,  name: "Rengoku Acrylic Stand",   price: 11.50, originalPrice: 15.00, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 6,  name: "Mitsuri Badge Set",       price: 7.99,  originalPrice: 11.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 7,  name: "Shinobu Figure",          price: 18.00, originalPrice: 25.00, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 8,  name: "Muzan Canvas Print",      price: 21.99, originalPrice: 29.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
];

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

    /* Navigate to product page on card click */
    div.addEventListener("click", (e) => {
        if (e.target.closest(".card-wishlist")) return;
        // TODO: window.location.href = `ProductPage.html?id=${product.id}`;
        showToast(`Opening "${product.name}"…`);
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

/* =====================
   INIT
   Each page can override window.PAGE_PRODUCTS before this script
   loads, or we fall back to the fake data for the current page.
   ===================== */
document.addEventListener("DOMContentLoaded", () => {
    /* Decide which product list to show.
       Pages set  window.PAGE_PRODUCTS = [...]  before this script.
       Falls back to DISCOUNT_PRODUCTS for discount.html. */
    const products = window.PAGE_PRODUCTS || DISCOUNT_PRODUCTS;

    renderGrid(products);
    initSearch(products);
    initNewsletter();
});