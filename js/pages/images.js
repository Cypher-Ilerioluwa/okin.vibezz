// Images page: loading shimmer + accessible lightbox (keyboard, swipe, counter, focus return).
const tiles = [...document.querySelectorAll('.im')];
const dlg = document.getElementById('lb');

tiles.forEach(t => { const img = t.querySelector('img'); const done = () => t.classList.add('ld'); img.complete ? done() : img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); });

if (dlg && tiles.length) {
  const stage = dlg.querySelector('.stage'), cap = dlg.querySelector('figcaption'), count = dlg.querySelector('.count');
  let cur = 0, opener = null;
  const show = i => {
    cur = (i + tiles.length) % tiles.length; const t = tiles[cur].dataset;
    stage.innerHTML = ''; const im = new Image(); im.src = t.full; im.alt = t.alt; stage.append(im);
    cap.textContent = [t.title, t.credit && 'Credit: ' + t.credit].filter(Boolean).join('  |  ');
    count.textContent = `${cur + 1} / ${tiles.length}`;
    [cur + 1, cur - 1].forEach(n => { const p = new Image(); p.src = tiles[(n + tiles.length) % tiles.length].dataset.full; }); // preload neighbours
  };
  tiles.forEach((t, i) => t.addEventListener('click', () => { opener = t; show(i); dlg.showModal(); }));
  dlg.querySelector('.prev').onclick = () => show(cur - 1);
  dlg.querySelector('.next').onclick = () => show(cur + 1);
  dlg.querySelector('.close').onclick = () => dlg.close();
  dlg.addEventListener('close', () => { stage.innerHTML = ''; opener?.focus(); });
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target === stage) dlg.close(); });
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
  let x0 = null;
  stage.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); x0 = null; }, { passive: true });
}
