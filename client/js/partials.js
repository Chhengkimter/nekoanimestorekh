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
   ======================================================================= */

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

  async function init() {
    await Promise.all([
      injectPartial(ROOT_PREFIX + 'partials/header.html', 'header-root'),
      injectPartial(ROOT_PREFIX + 'partials/footer.html', 'footer-root')
    ]);
    document.dispatchEvent(new CustomEvent('partials:loaded'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();