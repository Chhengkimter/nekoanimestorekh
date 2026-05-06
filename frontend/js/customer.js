// Newsletter form handling
const newsletter = document.querySelector('.newsletter');
if (newsletter) {
    newsletter.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletter.querySelector('input').value;
        if (email) {
            alert('Thank you for subscribing! Check your email for 10% off.');
            newsletter.querySelector('input').value = '';
        }
    });
}
