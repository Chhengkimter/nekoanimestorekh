/* =======================================================================
   partials.js — loads shared header & footer into every page.
   Drop <div id="header-root"></div> and <div id="footer-root"></div>
   where the old <header>/<footer> blocks used to be, then include this
   script BEFORE your page-specific script (customer.js, productlist.js, etc).

   Other scripts should NOT assume the header/footer exist on
   DOMContentLoaded. Instead, listen for:

       document.addEventListener('partials:loaded', () => { ... });

   partials:loaded fires once both header and footer are injected
   (or have failed to load — it always fires, so page scripts never hang).

   loadCarousel() also lives here now (moved from customer.js): the
   carousel markup is now part of partials/header.html, so it has to
   be populated after the header injects, on every page, not just the
   homepage.
   ======================================================================= */

const PARTIALS_API = 'http://localhost:3000/api';

(function () {
  // Pages live in /pages/, partials live in /partials/ at project root.
  // Adjust ROOT_PREFIX if a page is not one level deep.
  const ROOT_PREFIX = '../';

  async function injectPartial(url, mountId) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      mount.innerHTML = await res.text();
    } catch (err) {
      console.error('partials.js: failed to load', url, err.message);
    }
  }

  /* Populates .carousel-track (now inside the header partial) with
     collection links from the API. Falls back to the static buttons
     already in the markup if the request fails. */
  async function loadCarousel() {
    const track = document.querySelector('.carousel-track');
    if (!track) return;

    try {
      const res = await fetch(`${PARTIALS_API}/pages`);
      if (!res.ok) throw new Error('Failed to load pages');

      const pages = await res.json();

      if (!pages || pages.length === 0) {
        track.innerHTML = '<span style="color:#B99CC8;padding:0 1rem;font-size:13px">No pages yet</span>';
        return;
      }

      track.innerHTML = pages.map(p =>
        `<a href="collection.html?slug=${p.slug}" class="carousel-button">${p.title}</a>`
      ).join('');

    } catch (err) {
      console.error('loadCarousel error:', err.message);
      // Leave the static fallback buttons already in header.html as-is
    }
  }

  function loadChatbot() {
    if (!document.querySelector('link[href*="chatbot.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = ROOT_PREFIX + 'css/chatbot.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="chatbot.js"]')) {
      const script = document.createElement('script');
      script.src = ROOT_PREFIX + 'js/chatbot.js';
      document.body.appendChild(script);
    }
  }

  async function init() {
    await Promise.all([
      injectPartial(ROOT_PREFIX + 'partials/header.html', 'header-root'),
      injectPartial(ROOT_PREFIX + 'partials/carousel.html', 'carousel-root'),
      injectPartial(ROOT_PREFIX + 'partials/footer.html', 'footer-root')
    ]);
    loadCarousel();
    loadChatbot();
    initHeaderSearch();
    document.dispatchEvent(new CustomEvent('partials:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* =======================================================================
   GLOBAL HEADER SEARCH INTEGRATION
   ======================================================================= */
window.handleHeaderSearch = function (event, mode) {
  if (event) event.preventDefault();
  const input = document.getElementById(`header-search-${mode}`) || document.querySelector('.header-search-input');
  const query = input ? input.value.trim() : '';
  
  if (query) {
    window.location.href = `collection.html?search=${encodeURIComponent(query)}`;
  }
  return false;
};

function initHeaderSearch() {
  const desktopInput = document.getElementById('header-search-desktop');
  const mobileInput = document.getElementById('header-search-mobile');
  const desktopDropdown = document.getElementById('search-dropdown-desktop');
  const mobileDropdown = document.getElementById('search-dropdown-mobile');

  const inputs = [desktopInput, mobileInput].filter(Boolean);
  if (inputs.length === 0) return;

  // Pre-fill input if currently viewing search results in collection.html
  const urlQuery = new URLSearchParams(window.location.search).get('search');
  if (urlQuery) {
    inputs.forEach(inp => inp.value = urlQuery);
  }

  let debounceTimer = null;

  async function performLiveSearch(inputEl, dropdownEl) {
    const q = inputEl.value.trim();
    
    // Sync other input value
    inputs.forEach(other => {
      if (other !== inputEl) other.value = inputEl.value;
    });

    if (!q || q.length < 2) {
      if (dropdownEl) dropdownEl.classList.remove('open');
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/products?search=${encodeURIComponent(q)}&limit=6`);
      if (!res.ok) return;
      const products = await res.json();

      if (!dropdownEl) return;

      if (!products || products.length === 0) {
        dropdownEl.innerHTML = `
          <div class="search-dropdown-empty">
            <i class="fas fa-search" style="font-size:18px; margin-bottom:4px; display:block; color:#ccc;"></i>
            No products found for "${q}"
          </div>`;
      } else {
        const itemsHtml = products.slice(0, 5).map(p => {
          const img = p.primary_image || 'https://i.pinimg.com/736x/d1/44/68/d14468697401a86272d2b631e6f62069.jpg';
          const price = parseFloat(p.sale_price || p.product_price).toFixed(2);
          const stockClass = p.stock_status === 'preorder' ? 'preorder' : 'instock';
          const stockText = p.stock_status === 'preorder' ? 'Pre-Order' : 'In Stock';

          return `
            <a href="productpage.html?id=${p.product_id}" class="search-dropdown-item">
              <img src="${img}" alt="${p.product_name}" class="search-dropdown-img">
              <div class="search-dropdown-info">
                <div class="search-dropdown-name">${p.product_name}</div>
                <div class="search-dropdown-meta">
                  <span>$${price}</span>
                  <span class="search-dropdown-stock ${stockClass}">${stockText}</span>
                </div>
              </div>
            </a>`;
        }).join('');

        const footerHtml = `
          <a href="collection.html?search=${encodeURIComponent(q)}" class="search-dropdown-footer">
            See all results for "${q}" →
          </a>`;

        dropdownEl.innerHTML = itemsHtml + footerHtml;
      }

      dropdownEl.classList.add('open');
    } catch (err) {
      console.error('Live search error:', err);
    }
  }

  inputs.forEach(inp => {
    const isDesktop = inp.id.includes('desktop');
    const dropdown = isDesktop ? desktopDropdown : mobileDropdown;

    inp.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => performLiveSearch(inp, dropdown), 180);
    });

    inp.addEventListener('focus', () => {
      if (inp.value.trim().length >= 2) performLiveSearch(inp, dropdown);
    });

    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = inp.value.trim();
        if (q) window.location.href = `collection.html?search=${encodeURIComponent(q)}`;
      }
    });
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-search-form')) {
      if (desktopDropdown) desktopDropdown.classList.remove('open');
      if (mobileDropdown) mobileDropdown.classList.remove('open');
    }
  });
}

/* =======================================================================
   WISHLIST HELPERS — shared across all pages
   ======================================================================= */

const WISHLIST_API = 'http://localhost:3000/api';

window.wishlistState = {};

window.loadWishlistIds = async function () {
  const token = localStorage.getItem('neko_token');
  if (!token) return;
  try {
    const res = await fetch(`${WISHLIST_API}/wishlist/ids`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return;
    const ids = await res.json();
    ids.forEach(id => { window.wishlistState[Number(id)] = true; });
  } catch (err) {
    console.error('Failed to load wishlist ids:', err);
  }
};

window.toggleWishlistItem = async function (productId) {
  const token = localStorage.getItem('neko_token');
  if (!token) return null;
  try {
    const res = await fetch(`${WISHLIST_API}/wishlist/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ productId })
    });
    if (!res.ok) return null;
    const data = await res.json();
    window.wishlistState[Number(productId)] = data.wishlisted;
    return data;
  } catch (err) {
    console.error('Wishlist toggle error:', err);
    return null;
  }
};

window.isWishlistedById = function (productId) {
  return !!window.wishlistState[Number(productId)];
};