// Shared behaviour: menu, header state, reveal-on-scroll, progress, video embeds, share, parallax.
const d = document, root = d.documentElement;
root.classList.add('js');

const hdr = d.querySelector('.hdr'), toggle = d.querySelector('.menu-toggle'), nav = d.querySelector('.nav');
function setMenu(open) {
  if (!nav || !toggle) return;
  nav.classList.toggle('open', open); hdr?.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open)); d.body.style.overflow = open ? 'hidden' : '';
}
toggle?.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
d.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
nav?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
matchMedia('(min-width:1021px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

// Reveal on scroll, staggered within each group and alternating direction in two-column layouts
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const t = e.target; t.classList.add('in'); io.unobserve(t); setTimeout(() => t.classList.add('done'), 1000 + (parseInt(t.style.getPropertyValue('--d')) || 0)); } }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
const groups = new Map();
d.querySelectorAll('.rv').forEach(el => {
  const g = el.parentElement, n = groups.get(g) || 0; groups.set(g, n + 1);
  el.style.setProperty('--d', Math.min(n, 8) * 80 + 'ms');
  if (g.classList.contains('split')) el.classList.add(n % 2 ? 'r' : 'l');
  io.observe(el);
});

// Header, progress bar, floating CTA
const bar = d.querySelector('.progress'), fab = d.querySelector('.fab');
let tick = false;
function onScroll() {
  const y = scrollY, h = root.scrollHeight - innerHeight;
  hdr?.classList.toggle('scrolled', y > 24);
  if (bar) bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  fab?.classList.toggle('show', y > 520);
  tick = false;
}
addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

d.querySelector('[data-top]')?.addEventListener('click', e => { e.preventDefault(); scrollTo({ top: 0, behavior: 'smooth' }); });

// Click-to-load video (privacy-enhanced YouTube domain)
d.querySelectorAll('[data-embed]').forEach(b => { if (b.tagName !== 'BUTTON' || b.classList.contains('gi')) return; b.addEventListener('click', () => {
  const f = d.createElement('iframe');
  f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.embed}?autoplay=1&rel=0`; f.title = b.dataset.title || 'Video';
  f.allow = 'autoplay; encrypted-media; picture-in-picture'; f.allowFullscreen = true; b.replaceWith(f);
}); });

// Share button (Web Share API, falls back to copying the link)
d.querySelectorAll('[data-share]').forEach(b => b.addEventListener('click', async () => {
  const data = { title: b.dataset.share, url: location.href };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); const t = b.innerHTML; b.textContent = 'Link copied'; setTimeout(() => b.innerHTML = t, 1800); } } catch { /* cancelled */ }
}));

// Gentle pointer parallax on the hero photo (fine pointers only, respects reduced motion)
const art = d.querySelector('.hero-art');
if (art && matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
  const hero = art.closest('.hero');
  hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; art.style.transform = `translate(${x * 14}px,${y * 10}px) rotate(${x * 2}deg)`; });
  hero.addEventListener('pointerleave', () => { art.style.transform = ''; });
  art.style.transition = 'transform .25s ease-out';
}
