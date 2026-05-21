/* =====================
   FAKE PRODUCT DATA
   (Replace with real DB/API calls later)
   ===================== */
const product = {
    id: 1,
    name: "Demon Slayer Tanjiro Kamado Figure – Limited Edition Collector's Set",
    price: 24.99,
    description: `This stunning limited edition figure captures Tanjiro Kamado in his iconic battle stance, 
meticulously crafted with hand-painted details and premium PVC material. Standing at 22cm tall, 
this collector's piece features authentic costume detailing, dynamic pose, and interchangeable 
accessories including his signature Nichirin Sword. Each figure comes individually numbered with 
a certificate of authenticity. Perfect for display or as a gift for any Demon Slayer fan. 
Imported directly from Japan — limited quantities available. Ages 15+. Not suitable for children under 3 years.`,
    options: ["Standard", "With Base", "Box Set", "Deluxe Edition"],
    image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg",
};

const similarProducts = [
    { id: 2,  name: "Nezuko Figure",         price: 19.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 3,  name: "Zenitsu Keychain",      price: 7.99,  image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 4,  name: "Inosuke Poster",        price: 12.50, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 5,  name: "Rengoku Acrylic Stand", price: 15.00, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 6,  name: "Mitsuri Badge Set",     price: 9.99,  image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 7,  name: "Shinobu Figure",        price: 22.00, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 8,  name: "Tanjiro Plushie",       price: 17.50, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
    { id: 9,  name: "Muzan Canvas Print",    price: 29.99, image: "https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg" },
];

/* =====================
   STATE
   ===================== */
let quantity = 1;
let selectedOption = product.options[0];
let isWishlisted = false;
// Per-card wishlist state: id -> bool
const cardWishlist = {};

/* =====================
   HELPERS
   ===================== */
function formatPrice(price) {
    return "$" + price.toFixed(2);
}

function showToast(message) {
    let toast = document.getElementById("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove("show"), 2500);
}

function syncQuantity() {
    const mainVal = document.getElementById("qty-value");
    const stickyVal = document.getElementById("sticky-qty-value");
    if (mainVal) mainVal.textContent = quantity;
    if (stickyVal) stickyVal.textContent = quantity;
}

function syncWishlist() {
    const icons = [
        document.getElementById("wishlist-icon"),
        document.getElementById("sticky-wishlist-icon"),
    ];
    const btns = [
        document.getElementById("wishlist-btn"),
        document.getElementById("sticky-wishlist-btn"),
    ];

    icons.forEach(icon => {
        if (!icon) return;
        icon.className = isWishlisted ? "fa-heart" : "fa-heart";
    });

    btns.forEach(btn => {
        if (!btn) return;
        if (isWishlisted) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
}

/* =====================
   OPTION BUTTONS
   ===================== */
function initOptions() {
    const grid = document.getElementById("options-grid");
    if (!grid) return;

    grid.querySelectorAll(".option-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            grid.querySelectorAll(".option-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            selectedOption = btn.dataset.option;
        });
    });
}

/* =====================
   QUANTITY CONTROLS
   ===================== */
function initQuantityControls() {
    // Desktop
    document.getElementById("qty-minus")?.addEventListener("click", () => {
        if (quantity > 1) { quantity--; syncQuantity(); }
    });
    document.getElementById("qty-plus")?.addEventListener("click", () => {
        quantity++;
        syncQuantity();
    });

    // Mobile sticky
    document.getElementById("sticky-minus")?.addEventListener("click", () => {
        if (quantity > 1) { quantity--; syncQuantity(); }
    });
    document.getElementById("sticky-plus")?.addEventListener("click", () => {
        quantity++;
        syncQuantity();
    });
}

/* =====================
   WISHLIST
   ===================== */
function initWishlist() {
    function toggleWishlist() {
        isWishlisted = !isWishlisted;
        syncWishlist();
        showToast(isWishlisted ? "Added to wishlist ❤️" : "Removed from wishlist");
        // TODO: send to DB
    }

    document.getElementById("wishlist-btn")?.addEventListener("click", toggleWishlist);
    document.getElementById("sticky-wishlist-btn")?.addEventListener("click", toggleWishlist);
}

/* =====================
   ADD TO CART
   ===================== */
function initAddToCart() {
    function handleAddToCart() {
        showToast(`Added ${quantity}× "${selectedOption}" to cart 🛒`);
        // TODO: send to DB / cart state
    }

    document.getElementById("add-to-cart-btn")?.addEventListener("click", handleAddToCart);
    document.getElementById("sticky-add-to-cart")?.addEventListener("click", handleAddToCart);
}

/* =====================
   SIMILAR PRODUCTS GRID
   ===================== */
function renderSimilarProducts() {
    const grid = document.getElementById("similar-grid");
    if (!grid) return;

    grid.innerHTML = similarProducts.map(p => `
        <div class="product-card" data-id="${p.id}">
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
    `).join("");

    // Card click → navigate to product (placeholder)
    grid.querySelectorAll(".product-card").forEach(card => {
        card.addEventListener("click", (e) => {
            // Don't navigate when clicking wishlist heart
            if (e.target.closest(".card-wishlist")) return;
            const id = card.dataset.id;
            showToast(`Opening product #${id}…`);
            // TODO: window.location.href = `ProductPage.html?id=${id}`;
        });
    });

    // Card wishlist buttons
    grid.querySelectorAll(".card-wishlist").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            cardWishlist[id] = !cardWishlist[id];
            btn.classList.toggle("active", cardWishlist[id]);
            showToast(cardWishlist[id] ? "Added to wishlist ❤️" : "Removed from wishlist");
            // TODO: send to DB
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
   ===================== */
document.addEventListener("DOMContentLoaded", () => {
    initOptions();
    initQuantityControls();
    initWishlist();
    initAddToCart();
    renderSimilarProducts();
    initNewsletter();
    syncQuantity();
    syncWishlist();
});