const buttons = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.grid [data-type]')];
const empty = document.getElementById('empty');
function apply(f) {
  buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
  let n = 0;
  cards.forEach(c => { const show = f === 'all' || c.dataset.type === f; c.hidden = !show; if (show) { n++; c.classList.remove('in'); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('in'))); } });
  if (empty) empty.hidden = n > 0;
  history.replaceState(null, '', f === 'all' ? location.pathname + location.hash : '?type=' + f + location.hash);
}
if (buttons.length) {
  buttons.forEach(b => b.addEventListener('click', () => apply(b.dataset.filter)));
  const q = new URLSearchParams(location.search).get('type');
  apply(['single', 'ep', 'album'].includes(q) ? q : 'all');
}
