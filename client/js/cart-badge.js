/* =======================================================================
   cart-badge.js — shared across every page that includes the header.
   Keeps the cart icon badge in sync regardless of which page-specific
   script (productpage.js, cart.js, etc.) is loaded.
   Depends on getToken()/isLoggedIn() from auth.js — load this AFTER
   auth.js on every page.
   ======================================================================= */

const CART_BADGE_API = 'http://localhost:3000/api';

function getCartBadgeEls() {
  return [
    document.getElementById('cart-badge-desktop'),
    document.getElementById('cart-badge-mobile')
  ].filter(Boolean);
}

function updateCartBadgeUI(count, animate = false) {
  const badges = getCartBadgeEls();
  badges.forEach(badge => {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.toggle('visible', count > 0);
    if (animate) {
      badge.classList.remove('bump');
      requestAnimationFrame(() => badge.classList.add('bump'));
      badge.addEventListener('animationend', () => badge.classList.remove('bump'), { once: true });
    }
  });
}

// Header is injected async by partials.js, so wait for the badge
// elements to actually exist before touching them.
function whenCartBadgesReady(callback) {
  if (getCartBadgeEls().length) { callback(); return; }
  const root = document.getElementById('header-root');
  if (!root) { callback(); return; }

  const observer = new MutationObserver(() => {
    if (getCartBadgeEls().length) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000); // safety net
}

async function loadInitialCartCount() {
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) { updateCartBadgeUI(0); return; }
  try {
    const res = await fetch(`${CART_BADGE_API}/cart`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) return;
    const data = await res.json();

    let count = 0;
    if (Array.isArray(data)) {
      count = data.reduce((sum, item) => sum + (item.quantity || 1), 0);
    } else if (Array.isArray(data.items)) {
      count = data.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    } else if (typeof data.cartCount === 'number') {
      count = data.cartCount;
    }
    updateCartBadgeUI(count);
  } catch (err) {
    console.error('Failed to load cart count:', err);
  }
}

// Runs as soon as this file loads, on every page that includes it
whenCartBadgesReady(loadInitialCartCount);