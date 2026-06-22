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

  async function init() {
    await Promise.all([
      injectPartial(ROOT_PREFIX + 'partials/header.html', 'header-root'),
      injectPartial(ROOT_PREFIX + 'partials/carousel.html', 'carousel-root'),
      injectPartial(ROOT_PREFIX + 'partials/footer.html', 'footer-root')
    ]);
    loadCarousel();
    document.dispatchEvent(new CustomEvent('partials:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

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