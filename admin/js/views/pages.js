import { sb, db, getSettings, saveSettings, siteUrl, friendly, markDirty } from '../api.js';
import { $, $$, esc, icon, fail, toast, confirmBox, imageField, wireImageFields, repeater, wireRepeaters, readRepeater } from '../ui.js';
import { PAGES, LEGAL_SLUGS, SEO_DEFAULTS, defaultShareImage, parseYouTube } from '/shared/schema.js';
import { LEGAL, legalToMarkup } from '/shared/legal.js';

export async function render(root, ctx) {
  const [slug] = ctx.params;
  if (!slug) return list(root, ctx);
  if (LEGAL_SLUGS.includes(slug)) return legalEditor(root, ctx, slug);
  const page = PAGES.find(p => p.slug === slug);
  if (!page) { location.hash = '#/pages'; return; }
  return pageEditor(root, ctx, page);
}

/* ---------- list ---------- */
function list(root, ctx) {
  ctx.setTitle('Pages');
  root.innerHTML = `<div class="page-h"><div><h2>Pages</h2><p>Edit the words, headings, images and search/link-preview details of every page. Empty fields use the built-in text.</p></div></div>
<h3 style="margin:.4rem 0 .8rem">Site pages</h3><div class="pg-list">${PAGES.map(p => `<a class="card pg" href="#/pages/${p.slug}"><b>${esc(p.title)}</b><small>${esc(p.desc)}</small><span class="go">Edit ${icon('right')}</span></a>`).join('')}</div>
<h3 style="margin:1.8rem 0 .8rem">Legal pages</h3><div class="pg-list">${LEGAL_SLUGS.map(s => `<a class="card pg" href="#/pages/${s}"><b>${esc(LEGAL[s][0])}</b><small>/legal/${s}/</small><span class="go">Edit ${icon('right')}</span></a>`).join('')}</div>`;
}

/* ---------- field editor for a page ---------- */
const inputFor = (f, cur) => {
  const val = cur ?? '';
  if (f.t === 'image') return imageField({ name: f.k, value: val, folder: 'pages', label: f.l, hint: f.h, crop: f.crop });
  if (f.t === 'repeater') return `<div><span class="lbl">${esc(f.l)}</span>${repeater({ name: f.k, items: Array.isArray(cur) ? cur : f.d, addLabel: 'Add item', fields: f.items.map(i => ({ k: i.k, l: i.l, w: i.t === 'textarea' ? 'w2' : '' })) })}</div>`;
  const ph = esc(String(f.ph || f.d || '').slice(0, 160));
  return `<label><span class="lbl">${esc(f.l)}</span>${f.t === 'textarea' ? `<textarea name="${f.k}" placeholder="${ph}" style="min-height:${String(f.d || '').length > 300 ? 220 : 100}px">${esc(val)}</textarea>` : `<input name="${f.k}" value="${esc(val)}" placeholder="${ph}">`}${f.h ? `<span class="hint">${esc(f.h)}</span>` : ''}</label>`;
};

async function pageEditor(root, ctx, page) {
  ctx.setTitle(`Edit ${page.title}`);
  let s; try { s = await getSettings(); } catch (e) { return fail(e); }
  const isSite = page.scope === 'site';
  const store = () => (isSite ? (s.site ||= {}) : ((s.pages ||= {})[page.slug] ||= {}));
  const cur = store();
  let dirty = false;

  root.innerHTML = `<div class="page-h"><div><a href="#/pages" class="link" style="text-decoration:none">&larr; All pages</a><h2>${esc(page.title)}</h2><p>${esc(page.desc)}</p></div>${page.path ? `<a class="btn ghost" target="_blank" rel="noopener" href="${esc(siteUrl)}${page.path}">${icon('ext')} View page</a>` : ''}</div>
<form id="f" novalidate><div class="card"><div class="fgrid">${page.fields.filter(f => f.g !== 'seo').map(f => inputFor(f, cur[f.k])).join('')}</div></div>
${page.seo ? `<div class="card" style="margin-top:1rem"><h2 class="card-h">Search &amp; link preview</h2><p class="hint" style="margin-top:-.5rem;margin-bottom:1rem">Controls how this page appears on Google and when the link is shared on WhatsApp, Facebook, X and iMessage.</p><div class="fgrid">${page.fields.filter(f => f.g === 'seo').map(f => inputFor(f, cur[f.k])).join('')}</div><div style="margin-top:1.2rem"><span class="lbl">Preview</span><div id="sp" style="margin-top:.4rem"></div></div></div>` : ''}
<div class="savebar"><div class="l"><span class="state" id="state">All changes saved</span></div><div class="r"><button type="button" class="btn sm ghost" id="reset">Reset to defaults</button><button class="btn primary" type="submit" id="save">Save changes</button></div></div></form>`;
  const f = $('#f', root), state = $('#state', root);
  const touch = () => { dirty = true; state.textContent = 'Unsaved changes'; state.className = 'state dirty'; };
  const host = (() => { try { return new URL(siteUrl || location.origin).host; } catch { return location.host; } })();
  const paintPrev = () => {
    const sp = $('#sp', root); if (!sp) return; const E = f.elements, d = SEO_DEFAULTS[page.slug];
    const t = E.seo_title.value.trim() || d.title, ds = E.seo_description.value.trim() || d.desc, img = E.og_image.value || defaultShareImage(page.slug);
    sp.innerHTML = `<div class="seo-prev"><div class="im" style="background-image:url('${esc(img)}')"></div><div class="tx"><small>${esc(host)}</small><b>${esc(t)}</b><span>${esc(ds)}</span></div></div>`;
  };
  wireImageFields(root, () => { touch(); paintPrev(); }); wireRepeaters(root, touch); paintPrev();
  f.addEventListener('input', e => { e.target.classList.remove('invalid'); touch(); paintPrev(); }); ctx.setGuard(() => dirty);

  f.addEventListener('submit', async e => {
    e.preventDefault(); const E = f.elements, next = {};
    for (const fl of page.fields) {
      if (fl.t === 'repeater') {
        const rows = readRepeater(root, fl.k).filter(r => Object.values(r).some(Boolean));
        if (JSON.stringify(rows) !== JSON.stringify(fl.d)) next[fl.k] = rows;
      } else {
        let v = (E[fl.k]?.value || '').trim();
        if (fl.k === 'featured_video_id' && v) { const id = parseYouTube(v); if (!id) { E[fl.k].classList.add('invalid'); return toast('That does not look like a YouTube link or video ID.', 'err'); } v = id; }
        if (fl.k === 'contact_email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { E[fl.k].classList.add('invalid'); return toast('Enter a valid email address.', 'err'); }
        if (v && v !== (fl.d || '')) next[fl.k] = v;
      }
    }
    const b = $('#save', root); b.disabled = true; b.textContent = 'Saving…';
    try { s = await saveSettings(x => { isSite ? (x.site = next) : ((x.pages ||= {})[page.slug] = next); return x; }); dirty = false; state.textContent = 'All changes saved'; state.className = 'state'; toast('Saved. Press Publish to put it live.'); }
    catch (er) { fail(er); } finally { b.disabled = false; b.textContent = 'Save changes'; }
  });
  $('#reset', root).onclick = async () => {
    if (!await confirmBox({ title: 'Reset this page?', body: 'All your edits on this page will be replaced by the built-in text and images.', ok: 'Reset to defaults', danger: true })) return;
    try { await saveSettings(x => { isSite ? (x.site = {}) : ((x.pages ||= {})[page.slug] = {}); return x; }); dirty = false; ctx.setGuard(null); toast('Reset to defaults.'); pageEditor(root, ctx, page); } catch (er) { fail(er); }
  };
}

/* ---------- legal pages (stored in the `pages` table) ---------- */
async function legalEditor(root, ctx, slug) {
  const [def] = LEGAL[slug]; ctx.setTitle(`Edit ${def}`);
  const { data: row, error } = await sb.from('pages').select('*').eq('slug', slug).maybeSingle();
  if (error) return fail(new Error(friendly(error)));
  let dirty = false;
  root.innerHTML = `<div class="page-h"><div><a href="#/pages" class="link" style="text-decoration:none">&larr; All pages</a><h2>${esc(def)}</h2><p>${row ? 'Using your edited version.' : 'Showing the built-in text. Edit and save to replace it.'}</p></div><a class="btn ghost" target="_blank" rel="noopener" href="${esc(siteUrl)}/legal/${slug}/">${icon('ext')} View page</a></div>
<form id="f" novalidate><div class="card"><div class="fgrid"><label><span class="lbl">Page title</span><input name="title" maxlength="120" value="${esc(row?.title || def)}"></label>
<label><span class="lbl">Text</span><textarea name="body" style="min-height:420px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9rem">${esc(row?.body || legalToMarkup(slug))}</textarea><span class="hint">Start a section with <b>## Heading</b>. Start list lines with <b>- </b>. Leave a blank line between paragraphs.</span></label>
<label><span class="lbl">Search description</span><input name="seo_description" maxlength="170" value="${esc(row?.seo_description || '')}" placeholder="Short summary for Google"></label></div></div>
<div class="savebar"><div class="l"><span class="state" id="state">${row ? 'All changes saved' : 'Not customised yet'}</span></div><div class="r">${row ? '<button type="button" class="btn sm ghost" id="reset">Reset to built-in text</button>' : ''}<button class="btn primary" type="submit" id="save">Save page</button></div></div></form>`;
  const f = $('#f', root), state = $('#state', root);
  f.addEventListener('input', () => { dirty = true; state.textContent = 'Unsaved changes'; state.className = 'state dirty'; }); ctx.setGuard(() => dirty);
  f.addEventListener('submit', async e => {
    e.preventDefault(); const E = f.elements;
    if (!E.title.value.trim() || !E.body.value.trim()) return toast('Title and text are required.', 'err');
    const data = { slug, title: E.title.value.trim(), body: E.body.value.trim(), seo_description: E.seo_description.value.trim() || null, status: 'published', published_at: row?.published_at || new Date().toISOString() };
    const b = $('#save', root); b.disabled = true; b.textContent = 'Saving…';
    try { const { error: er } = await sb.from('pages').upsert(data, { onConflict: 'slug' }); if (er) throw er; markDirty(); dirty = false; ctx.setGuard(null); toast('Saved. Press Publish to put it live.'); legalEditor(root, ctx, slug); } catch (er) { fail(er); b.disabled = false; b.textContent = 'Save page'; }
  });
  $('#reset', root)?.addEventListener('click', async () => {
    if (!await confirmBox({ title: 'Reset this page?', body: 'Your edited text will be deleted and the built-in version used again.', ok: 'Reset', danger: true })) return;
    try { await db.remove('pages', row.id); markDirty(); dirty = false; ctx.setGuard(null); toast('Reset to built-in text.'); legalEditor(root, ctx, slug); } catch (er) { fail(er); }
  });
}
