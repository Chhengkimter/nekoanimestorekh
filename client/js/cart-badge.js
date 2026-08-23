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

  // Strategy 1: MutationObserver on the header root
  const root = document.getElementById('header-root');
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    callback();
  };

  if (root) {
    const observer = new MutationObserver(() => {
      if (getCartBadgeEls().length) {
        observer.disconnect();
        settle();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000); // safety net
  }

  // Strategy 2: Listen for custom event from partials.js
  document.addEventListener('partials:loaded', () => {
    if (getCartBadgeEls().length) settle();
  }, { once: true });

  // Strategy 3: Polling fallback in case observer misses it
  let polls = 0;
  const poller = setInterval(() => {
    polls++;
    if (getCartBadgeEls().length || polls > 40) { // 40 × 250ms = 10s
      clearInterval(poller);
      if (getCartBadgeEls().length) settle();
    }
  }, 250);
}

async function loadInitialCartCount() {
  if (typeof isLoggedIn !== 'function' || !isLoggedIn()) { updateCartBadgeUI(0); return; }
  try {
    const res = await fetch(`${CART_BADGE_API}/cart/count`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) { updateCartBadgeUI(0); return; }
    const data = await res.json();
    const count = typeof data.count === 'number' ? data.count : 0;
    updateCartBadgeUI(count);
  } catch (err) {
    console.error('Failed to load cart count:', err);
    updateCartBadgeUI(0);
  }
}

/* =====================
   FLY-TO-CART ANIMATION
   Animates a small dot from the clicked element to whichever cart
   icon is currently visible (desktop vs mobile header), then resolves.
   Exposed as window.flyToCart so any page script can trigger it.
   ===================== */
function getVisibleCartIconEl() {
  const candidates = document.querySelectorAll('.icon-link[title="Cart"]');
  for (const el of candidates) {
    // offsetParent is null when the element or an ancestor is display:none
    if (el.offsetParent !== null) return el;
  }
  return candidates[0] || null;
}

function flyToCart(originEl) {
  return new Promise(resolve => {
    if (!originEl) { resolve(); return; }
    const cartIcon = getVisibleCartIconEl();
    if (!cartIcon) { resolve(); return; }

    const startRect = originEl.getBoundingClientRect();
    const endRect   = cartIcon.getBoundingClientRect();

    const dot = document.createElement('div');
    dot.className = 'fly-dot';
    document.body.appendChild(dot);

    const startX = startRect.left + startRect.width / 2 - 7;
    const startY = startRect.top + startRect.height / 2 - 7;
    const endX   = endRect.left + endRect.width / 2 - 7;
    const endY   = endRect.top + endRect.height / 2 - 7;

    // place at start, no transition yet
    dot.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1)`;
    dot.style.opacity = '1';

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      dot.remove();
      resolve();
    };

    requestAnimationFrame(() => {
      dot.classList.add('flying'); // turns on the transition
      requestAnimationFrame(() => {
        dot.style.transform = `translate3d(${endX}px, ${endY}px, 0) scale(0.3)`;
        dot.style.opacity = '0.4';
      });
    });

    dot.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 900); // safety net in case transitionend never fires
  });
}

window.flyToCart = flyToCart;

// Runs as soon as this file loads, on every page that includes it
whenCartBadgesReady(loadInitialCartCount);