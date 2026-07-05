// ── Latest version from GitHub Releases ────────────────────────────────
(async function fetchLatestVersion() {
  const label = document.getElementById("version-label");
  if (!label) return;

  const CACHE_KEY = "flux-test-version";
  const CACHE_TTL_MS = 3_600_000; // 1 hour

  // ── Check cache first ─────────────────────────────────────────────────
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { version, ts } = JSON.parse(cached);
      if (Date.now() - ts < CACHE_TTL_MS) {
        label.textContent = version;
        return;
      }
    }
  } catch {
    // Corrupted cache entry — ignore and re-fetch.
  }

  // ── Fetch from GitHub ─────────────────────────────────────────────────
  try {
    const res = await fetch(
      "https://api.github.com/repos/siddheshgunjal/flux-test/releases/latest",
    );
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = await res.json();
    const version = data.tag_name || "?";
    label.textContent = version;

    // ── Persist to cache ────────────────────────────────────────────────
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ version, ts: Date.now() }),
      );
    } catch {
      // localStorage full or disabled — not critical.
    }
  } catch {
    // Keep the "—" placeholder on network/rate-limit errors.
  }
})();

// ── Floating particles ─────────────────────────────────────────────────
(function initParticles() {
  const container = document.getElementById("particles");
  const colors = ["#06b6d4", "#6366f1", "#8b5cf6"];

  function spawn() {
    const p = document.createElement("div");
    p.className = "flux-particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.top = 80 + Math.random() * 20 + "%";
    const size = Math.random() * 3 + 1;
    const dur = Math.random() * 10 + 10;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.opacity = String(0.1 + Math.random() * 0.25);
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.boxShadow = `0 0 ${size * 2}px currentColor`;
    p.style.animation = `flowUp ${dur}s linear forwards`;
    container.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000);
  }

  for (let i = 0; i < 15; i++) setTimeout(spawn, i * 200);
  setInterval(spawn, 800);
})();

// ── Scroll reveal ──────────────────────────────────────────────────────
(function initReveal() {
  const els = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  els.forEach((el) => observer.observe(el));
})();

// ── Smooth scroll for anchor links ────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = document.querySelector(a.getAttribute("href"));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
