// Small UI toolkit: escaping, icons, toasts, dialogs, image fields, repeaters.
import { uploadImage, friendly } from './api.js';
const warnLow = (w, h) => toast(`That image is small (${w} × ${h}px). It will look soft, so use a larger one if you can.`, 'err', 7000);

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const I = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pages: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.2-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.4.2 4 1.8 4.5 4.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', left: '<path d="M19 12H5M11 6l-6 6 6 6"/>', right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"/>', video: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9l5 3-5 3z"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>', power: '<path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l4.5 4.5L19 7"/>', rocket: '<path d="M5 15c-1 1-2 4-2 6 2 0 5-1 6-2M14 4c4 0 6 2 6 6-2 4-5 7-9 8l-5-5c1-4 4-7 8-9z"/><circle cx="14.5" cy="9.5" r="1.5"/>',
  out: '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M16 8l4 4-4 4M20 12H9"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

/* ---------- toasts ---------- */
export function toast(msg, type = 'ok', ms = 4200) {
  const box = $('#toasts'), t = document.createElement('div');
  t.className = `toast ${type}`; t.setAttribute('role', type === 'err' ? 'alert' : 'status');
  t.innerHTML = `${icon(type === 'err' ? 'warn' : 'check')}<span>${esc(msg)}</span>`;
  box.append(t); requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
}
export const fail = e => { console.error(e); toast(friendly(e), 'err', 6500); };

/* ---------- dialogs ---------- */
export function openModal(html, { title = '', wide = false, onMount } = {}) {
  const dlg = $('#modal');
  dlg.className = wide ? 'wide' : '';
  dlg.innerHTML = `<div class="m-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('close')}</button></div><div class="m-body">${html}</div>`;
  const close = () => { if (dlg.open) dlg.close(); };
  dlg.onclick = e => { if (e.target === dlg || e.target.closest('[data-close]')) close(); };
  if (!dlg.open) dlg.showModal();
  onMount?.(dlg, close);
  return { el: dlg, close };
}
export function confirmBox({ title = 'Are you sure?', body = '', ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    const { el, close } = openModal(`<p>${esc(body)}</p><div class="m-actions"><button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button></div>`, { title });
    let done = false; const finish = v => { if (!done) { done = true; res(v); } };
    el.querySelector('[data-ok]').onclick = () => { finish(true); close(); };
    const onClose = () => { if (el.open) return; el.removeEventListener('close', onClose); finish(false); };
    el.addEventListener('close', onClose);
    el.querySelector('[data-ok]').focus();
  });
}

/* ---------- formatting ---------- */
export const fmtDate = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export function ago(iso) {
  if (!iso) return ''; const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 604800) return Math.floor(s / 86400) + ' d ago'; return fmtDate(iso);
}
export const statusChip = s => `<span class="chip st-${esc(s)}">${esc(s)}</span>`;
export const dur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '';
export const parseDur = v => { const m = String(v || '').trim().match(/^(\d+):([0-5]?\d)$/); return m ? (+m[1]) * 60 + (+m[2]) : (/^\d+$/.test(String(v || '').trim()) ? +v : null); };

/* ---------- image field ---------- */
export function imageField({ name, value = '', folder = 'uploads', label = 'Image', hint = '', ratio = '', crop = null }) {
  if (!ratio && crop) ratio = crop[0] === crop[1] ? 'sq' : crop[0] > crop[1] ? 'og' : 'tall';
  return `<div class="imgf ${ratio || 'sq'}" data-imgf data-folder="${esc(folder)}" ${crop ? `data-crop="${crop[0]}x${crop[1]}"` : ''}><span class="lbl">${esc(label)}</span>
<input type="hidden" name="${esc(name)}" value="${esc(value)}">
<div class="imgf-box" tabindex="0" role="button" aria-label="Upload ${esc(label)}">${value ? `<img src="${esc(value)}" alt="">` : `<span class="ph">${icon('upload')}<b>Drop an image or click to upload</b><small>JPG, PNG or WebP</small></span>`}<div class="busy-ov" hidden><span class="spin"></span></div></div>
<div class="imgf-actions"><button type="button" class="btn sm" data-pick>${icon('upload')} ${value ? 'Replace' : 'Upload'}</button><button type="button" class="btn sm ghost" data-clear ${value ? '' : 'hidden'}>Remove</button><input type="file" accept="image/*" hidden></div>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}</div>`;
}
export function wireImageFields(root, onChange) {
  $$('[data-imgf]', root).forEach(f => {
    const input = $('input[type=hidden]', f), box = $('.imgf-box', f), file = $('input[type=file]', f), ov = $('.busy-ov', f), pick = $('[data-pick]', f), clear = $('[data-clear]', f);
    const render = () => {
      const v = input.value;
      box.querySelector('img, .ph')?.remove();
      box.insertAdjacentHTML('afterbegin', v ? `<img src="${esc(v)}" alt="">` : `<span class="ph">${icon('upload')}<b>Drop an image or click to upload</b><small>JPG, PNG or WebP</small></span>`);
      clear.hidden = !v; pick.innerHTML = `${icon('upload')} ${v ? 'Replace' : 'Upload'}`;
    };
    const upload = async fl => {
      if (!fl) return; ov.hidden = false;
      try { const c = f.dataset.crop ? f.dataset.crop.split('x').map(Number) : null; input.value = await uploadImage(fl, f.dataset.folder, { crop: c, onLowRes: warnLow }); render(); onChange?.(); toast('Image uploaded'); }
      catch (e) { fail(e); } finally { ov.hidden = true; file.value = ''; }
    };
    pick.onclick = () => file.click(); box.onclick = () => file.click();
    box.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    file.onchange = () => upload(file.files[0]);
    clear.onclick = () => { input.value = ''; render(); onChange?.(); };
    ['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove('drag'); }));
    box.addEventListener('drop', e => upload(e.dataTransfer.files[0]));
  });
}

/* ---------- repeater (rows of small fields; add / remove / reorder) ---------- */
export function repeater({ name, items = [], fields, addLabel = 'Add row', min = 0, hint = '' }) {
  const row = it => `<div class="rep-row">${fields.map(f => `<label class="${f.w || ''}"><span class="lbl">${esc(f.l)}</span>${f.t === 'textarea'
    ? `<textarea data-k="${f.k}" rows="2" placeholder="${esc(f.ph || '')}">${esc(it?.[f.k] ?? '')}</textarea>`
    : `<input data-k="${f.k}" type="text" ${f.list ? `list="dl-${name}-${f.k}"` : ''} value="${esc(it?.[f.k] ?? '')}" placeholder="${esc(f.ph || '')}">`}${f.list ? `<datalist id="dl-${name}-${f.k}">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</label>`).join('')}
<div class="rep-ctl"><button type="button" class="icon-btn" data-rep="up" aria-label="Move up">${icon('up')}</button><button type="button" class="icon-btn" data-rep="down" aria-label="Move down">${icon('down')}</button><button type="button" class="icon-btn danger" data-rep="del" aria-label="Remove">${icon('trash')}</button></div></div>`;
  return `<div class="rep" data-rep-root="${esc(name)}" data-min="${min}"><div class="rep-rows">${items.map(row).join('')}</div>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}<button type="button" class="btn sm" data-rep="add">${icon('plus')} ${esc(addLabel)}</button><template>${row({})}</template></div>`;
}
export function wireRepeaters(root, onChange) {
  $$('[data-rep-root]', root).forEach(r => {
    const rows = $('.rep-rows', r), tpl = $('template', r);
    r.addEventListener('click', e => {
      const b = e.target.closest('[data-rep]'); if (!b || !r.contains(b)) return;
      const act = b.dataset.rep, rw = b.closest('.rep-row');
      if (act === 'add') { rows.append(tpl.content.cloneNode(true)); rows.lastElementChild.querySelector('input,textarea')?.focus(); }
      if (act === 'del') rw.remove();
      if (act === 'up' && rw.previousElementSibling) rw.previousElementSibling.before(rw);
      if (act === 'down' && rw.nextElementSibling) rw.nextElementSibling.after(rw);
      onChange?.();
    });
  });
}
export const readRepeater = (root, name) => $$(`[data-rep-root="${name}"] .rep-row`, root).map(rw => Object.fromEntries($$('[data-k]', rw).map(i => [i.dataset.k, i.value.trim()])));
export { warnLow };
