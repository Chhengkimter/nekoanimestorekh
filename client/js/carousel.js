// js/carousel.js
document.addEventListener('partials:loaded', async () => {
  const track = document.querySelector('.carousel-track');
  if (!track) return;

  try {
    const res = await fetch('/api/categories'); // whatever your endpoint is
    const categories = await res.json();

    track.innerHTML = categories.map(cat => `
      <a href="collection.html?slug=${cat.slug}" class="carousel-button">${cat.name}</a>
    `).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
});