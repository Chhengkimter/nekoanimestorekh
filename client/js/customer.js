/* =======================================================================
   customer.js — Neko Animestore Homepage
   Loads carousel dynamically from /api/pages
   ======================================================================= */

const API = 'http://localhost:3000/api';

/* =====================
   DYNAMIC CAROUSEL
   Loads store pages from API and populates the carousel track
   ===================== */
async function loadCarousel() {
  const track = document.querySelector('.carousel-track');
  if (!track) return;

  try {
    const res = await fetch(`${API}/pages`);
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
    // Fallback — keep existing static buttons if API fails
    track.innerHTML = `
      <a href="collection.html?slug=all" class="carousel-button">All Products</a>
      <a href="collection.html?slug=discount" class="carousel-button">Discounts</a>
    `;
  }
}

/* =====================
   NEWSLETTER
   ===================== */
function initNewsletter() {
  const form = document.querySelector('.newsletter');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type=email]');
    if (!input?.value) return;

    try {
      await fetch(`${API}/newsletter`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: input.value })
      });
    } catch {}

    alert('Thank you for subscribing! Check your email for 10% off.');
    input.value = '';
  });
}

/* =====================
   INIT
   ===================== */
document.addEventListener('DOMContentLoaded', () => {
  loadCarousel();
  initNewsletter();
});