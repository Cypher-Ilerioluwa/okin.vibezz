import { getSettings, saveSettings } from '../api.js';
import { $, $$, esc, icon, fail, toast } from '../ui.js';
import { PLATFORMS, SOCIALS, textOn } from '/shared/schema.js';

export async function render(root, ctx) {
  ctx.setTitle('Streaming & social');
  let s; try { s = await getSettings(); } catch (e) { return fail(e); }
  let dirty = false;
  const rows = (list, key) => list.map(p => `<div class="lr"><span class="pico" style="background:${p.color};color:${textOn(p.color)}">${esc(p.abbr)}</span><b>${esc(p.label)}</b><input data-g="${key}" data-k="${p.key}" type="url" inputmode="url" value="${esc(s[key]?.[p.key] || '')}" placeholder="https://" aria-label="${esc(p.label)} link"><a class="icon-btn" data-test target="_blank" rel="noopener" href="${esc(s[key]?.[p.key] || '#')}" aria-label="Open ${esc(p.label)} link" ${s[key]?.[p.key] ? '' : 'hidden'}>${icon('ext')}</a></div>`).join('');
  root.innerHTML = `<div class="page-h"><div><h2>Streaming &amp; social</h2><p>Paste your profile links. Platforms with a link become clickable on the Music page; the rest show "Link coming soon".</p></div></div>
<form id="f" novalidate><div class="card" style="margin-bottom:1rem"><h2 class="card-h">Streaming platforms <small style="font-weight:600;color:var(--faint)">Music page</small></h2><div class="link-rows">${rows(PLATFORMS, 'streaming')}</div></div>
<div class="card"><h2 class="card-h">Social profiles <small style="font-weight:600;color:var(--faint)">Footer, Contact page and Home</small></h2><div class="link-rows">${rows(SOCIALS, 'socials')}</div></div>
<div class="savebar"><div class="l"><span class="state" id="state">All changes saved</span></div><div class="r"><button class="btn primary" type="submit" id="save">Save links</button></div></div></form>`;
  const f = $('#f', root), state = $('#state', root);
  f.addEventListener('input', e => {
    e.target.classList.remove('invalid'); dirty = true; state.textContent = 'Unsaved changes'; state.className = 'state dirty';
    const t = e.target.closest('.lr')?.querySelector('[data-test]'); if (t) { t.hidden = !e.target.value.trim(); t.href = e.target.value.trim() || '#'; }
  });
  ctx.setGuard(() => dirty);
  f.addEventListener('submit', async e => {
    e.preventDefault(); const out = { streaming: {}, socials: {} }; let bad = null;
    $$('input[data-g]', f).forEach(i => {
      let v = i.value.trim(); if (!v) return;
      if (!/^https?:\/\//i.test(v) && /^[\w-]+\.[\w.-]+/.test(v)) v = 'https://' + v;
      try { const u = new URL(v); if (u.protocol !== 'https:') throw 0; out[i.dataset.g][i.dataset.k] = u.href; i.value = u.href; } catch { i.classList.add('invalid'); bad ||= i; }
    });
    if (bad) { bad.focus(); return toast('Links must be full web addresses starting with https://', 'err'); }
    const b = $('#save', root); b.disabled = true; b.textContent = 'Saving…';
    try { await saveSettings(x => { x.streaming = out.streaming; x.socials = out.socials; return x; }); dirty = false; state.textContent = 'All changes saved'; state.className = 'state'; toast('Links saved. Press Publish to put them live.'); }
    catch (er) { fail(er); } finally { b.disabled = false; b.textContent = 'Save links'; }
  });
}
