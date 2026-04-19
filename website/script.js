// ── Floating particles ──────────────────────────────────────────────
(function initParticles() {
    const container = document.getElementById('particles');
    const colors = ['#06b6d4', '#6366f1', '#8b5cf6'];

    function spawn() {
        const p = document.createElement('div');
        p.className = 'flux-particle';
        p.style.left     = Math.random() * 100 + '%';
        p.style.top      = (80 + Math.random() * 20) + '%';
        const size       = Math.random() * 3 + 1;
        const dur        = Math.random() * 10 + 10;
        p.style.width    = size + 'px';
        p.style.height   = size + 'px';
        p.style.opacity  = String(0.1 + Math.random() * 0.25);
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        p.style.boxShadow  = `0 0 ${size * 2}px currentColor`;
        p.style.animation  = `flowUp ${dur}s linear forwards`;
        container.appendChild(p);
        setTimeout(() => p.remove(), dur * 1000);
    }

    for (let i = 0; i < 15; i++) setTimeout(spawn, i * 200);
    setInterval(spawn, 800);
})();

// ── Scroll reveal ────────────────────────────────────────────────────
(function initReveal() {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.12 });
    els.forEach(el => observer.observe(el));
})();

// ── Smooth scroll for anchor links ──────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
