import { db, siteUrl, removeUpload, markDirty } from '../api.js';
import { $, $$, esc, icon, ago, statusChip, fail, toast, confirmBox, imageField, wireImageFields, repeater, wireRepeaters, readRepeater, dur, parseDur, debounce, fmtDate } from '../ui.js';
import { PLATFORMS, RELEASE_TYPES, slugify } from '/shared/schema.js';

export async function render(root, ctx) {
  const [id] = ctx.params;
  if (!id) return list(root, ctx);
  return edit(root, ctx, id === 'new' ? null : id);
}

/* ---------- list ---------- */
async function list(root, ctx) {
  ctx.setTitle('Music');
  let rows;
  try { rows = await db.list('music_releases', { order: 'release_date', select: '*, tracks(id)' }); } catch (e) { return fail(e); }
  rows.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || '') || b.created_at.localeCompare(a.created_at));
  let type = 'all', status = 'all', q = '';
  root.innerHTML = `<div class="page-h"><div><h2>Music</h2><p>Singles, EPs and albums. Each one becomes a card and its own page on the website.</p></div><a class="btn primary" href="#/music/new">${icon('plus')} New release</a></div>
<div class="toolbar"><div class="pills" id="tp"><button class="on" data-v="all">All</button>${RELEASE_TYPES.map(t => `<button data-v="${t.key}">${t.key === 'ep' ? 'EPs' : t.label + 's'}</button>`).join('')}</div>
<input class="grow" id="q" type="search" placeholder="Search releases" aria-label="Search releases"><select id="st" aria-label="Status"><option value="all">Any status</option><option value="published">Published</option><option value="draft">Draft</option></select></div><div id="out"></div>`;
  const out = $('#out', root);
  const paint = () => {
    const f = rows.filter(r => (type === 'all' || r.release_type === type) && (status === 'all' || r.status === status) && (!q || r.title.toLowerCase().includes(q)));
    out.innerHTML = f.length ? `<div class="cards">${f.map(r => `<a class="rc" href="#/music/${r.id}"><div class="cv">${r.cover_url ? `<img src="${esc(r.cover_url)}" alt="" loading="lazy">` : `<div class="ph"><img src="/assets/branding/logo-emblem.png" alt=""></div>`}<span class="chip">${esc(r.release_type.toUpperCase())}</span></div><div class="info"><b>${esc(r.title)}</b><small>${r.release_date ? esc(fmtDate(r.release_date)) : 'No date'} · ${r.tracks?.length || 0} track${r.tracks?.length === 1 ? '' : 's'}</small><div class="row2">${statusChip(r.status)}<small>${esc(ago(r.updated_at))}</small></div></div></a>`).join('')}</div>`
      : `<div class="empty-s">${icon('music')}<b>${rows.length ? 'No releases match' : 'No releases yet'}</b><span>${rows.length ? 'Try a different filter.' : 'Add a single, EP or album to get started.'}</span>${rows.length ? '' : `<a class="btn primary" href="#/music/new">${icon('plus')} New release</a>`}</div>`;
  };
  $('#tp', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.v; $$('#tp button', root).forEach(x => x.classList.toggle('on', x === b)); paint(); };
  $('#q', root).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); paint(); }, 120);
  $('#st', root).onchange = e => { status = e.target.value; paint(); };
  paint();
}

/* ---------- editor ---------- */
async function edit(root, ctx, id) {
  let r = { title: '', slug: '', release_type: 'single', cover_url: '', release_date: '', genre: '', label: '', description: '', featured: false, status: 'draft', seo_title: '', seo_description: '', tracks: [], release_platform_links: [] };
  if (id) { try { r = await db.get('music_releases', id, '*, tracks(*), release_platform_links(*)'); } catch (e) { fail(e); return (location.hash = '#/music'); } }
  ctx.setTitle(id ? r.title || 'Edit release' : 'New release');
  const tracks = (r.tracks || []).sort((a, b) => a.track_number - b.track_number).map(t => ({ title: t.title, featured_artists: t.featured_artists || '', producer_credit: t.producer_credit || '', duration: dur(t.duration_seconds) }));
  const links = (r.release_platform_links || []).sort((a, b) => (b.is_primary - a.is_primary) || (a.display_order - b.display_order)).map(l => ({ platform: l.platform, url: l.url }));
  let slugTouched = Boolean(id), dirty = false;

  root.innerHTML = `<div class="page-h"><div><a href="#/music" class="link" style="text-decoration:none">&larr; All music</a><h2>${id ? 'Edit release' : 'New release'}</h2></div>${id ? `<a class="btn ghost" id="vw" target="_blank" rel="noopener" href="${esc(siteUrl)}/music/${esc(r.slug)}/">${icon('ext')} View on site</a>` : ''}</div>
<form id="f" novalidate><div class="editor"><div>
 <div class="card"><h2 class="card-h">Release details</h2><div class="fgrid">
  <div><span class="lbl">Type</span><div class="seg" id="typeSeg" style="margin-top:.35rem">${RELEASE_TYPES.map(t => `<label><input type="radio" name="release_type" value="${t.key}" ${r.release_type === t.key ? 'checked' : ''}><span>${t.label}</span></label>`).join('')}</div></div>
  <label><span class="lbl">Title <span class="req">*</span></span><input name="title" maxlength="140" value="${esc(r.title)}" required></label>
  <label><span class="lbl">Page address</span><div class="slugrow"><span>/music/</span><input name="slug" maxlength="80" value="${esc(r.slug)}" aria-label="URL slug"></div><span class="hint">Created from the title. Letters, numbers and dashes only.</span></label>
  <div class="fgrid two"><label><span class="lbl">Release date</span><input type="date" name="release_date" value="${esc(r.release_date || '')}"></label><label><span class="lbl">Genre</span><input name="genre" maxlength="60" value="${esc(r.genre || '')}" placeholder="e.g. Afrobeats"></label></div>
  <label><span class="lbl">Label</span><input name="label" maxlength="80" value="${esc(r.label || '')}" placeholder="Okin Music Nation"></label>
  <label><span class="lbl">Description</span><textarea name="description" maxlength="2500" placeholder="Tell the story behind this release.">${esc(r.description || '')}</textarea></label>
 </div></div>
 <div class="card"><h2 class="card-h">Tracklist</h2><p class="hint" id="trHint" style="margin-top:-.5rem;margin-bottom:.8rem"></p>${repeater({ name: 'tracks', items: tracks, addLabel: 'Add track', fields: [{ k: 'title', l: 'Track title', w: 'w2' }, { k: 'featured_artists', l: 'Featured artists' }, { k: 'producer_credit', l: 'Producer' }, { k: 'duration', l: 'Length', ph: '3:45' }] })}</div>
 <div class="card"><h2 class="card-h">Where to listen</h2>${repeater({ name: 'links', items: links, addLabel: 'Add platform link', hint: 'The first link becomes the main "Listen" button. Pick a platform or type your own.', fields: [{ k: 'platform', l: 'Platform', list: PLATFORMS.map(p => p.label) }, { k: 'url', l: 'Link (https://…)', w: 'w2' }] })}</div>
 </div><div>
 <div class="card"><h2 class="card-h">Publishing</h2><div class="fgrid"><label><span class="lbl">Status</span><select name="status"><option value="draft" ${r.status !== 'published' ? 'selected' : ''}>Draft (hidden)</option><option value="published" ${r.status === 'published' ? 'selected' : ''}>Published</option></select></label>
  <label class="check"><input type="checkbox" name="featured" ${r.featured ? 'checked' : ''}> Feature on the Music page</label></div></div>
 <div class="card"><h2 class="card-h">Cover art</h2>${imageField({ name: 'cover_url', value: r.cover_url || '', folder: 'covers', label: 'Featured image', crop: [1200, 1200], hint: 'Cropped to a standard square (1200 × 1200). Use an image of at least 800 × 800 px.' })}</div>
 <div class="card"><h2 class="card-h">Search &amp; sharing</h2><div class="fgrid"><label><span class="lbl">Page title</span><input name="seo_title" maxlength="70" value="${esc(r.seo_title || '')}" placeholder="Defaults to the release title"></label><label><span class="lbl">Description</span><textarea name="seo_description" maxlength="170" style="min-height:80px" placeholder="Short summary for Google and social media">${esc(r.seo_description || '')}</textarea></label></div></div>
 </div></div>
 <div class="savebar"><div class="l"><span class="state" id="state">${id ? 'All changes saved' : 'Not saved yet'}</span></div><div class="r">${id ? `<button type="button" class="btn danger sm" id="del">${icon('trash')} Delete</button>` : ''}<button type="submit" class="btn primary" id="save">Save release</button></div></div></form>`;

  const f = $('#f', root), E = f.elements, state = $('#state', root);
  wireImageFields(root, () => touch()); wireRepeaters(root, () => touch());
  const typeHint = () => { const t = E.release_type.value; $('#trHint', root).textContent = t === 'single' ? 'Optional for a single. Add the song so it shows on the release page.' : 'Add every song on this ' + (t === 'ep' ? 'EP' : 'album') + ' in order.'; };
  typeHint();
  const touch = () => { dirty = true; state.textContent = 'Unsaved changes'; state.className = 'state dirty'; };
  f.addEventListener('input', e => {
    if (e.target.name === 'slug') { slugTouched = true; e.target.value = slugify(e.target.value); }
    if (e.target.name === 'title' && !slugTouched) E.slug.value = slugify(e.target.value);
    e.target.classList.remove('invalid'); touch();
  });
  f.addEventListener('change', e => { if (e.target.name === 'release_type') typeHint(); touch(); });
  ctx.setGuard(() => dirty);

  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const title = E.title.value.trim(), slug = slugify(E.slug.value || title);
    if (!title) { E.title.classList.add('invalid'); E.title.focus(); return toast('Please add a title.', 'err'); }
    if (!slug) { E.slug.classList.add('invalid'); return toast('Please add a page address.', 'err'); }
    const trs = readRepeater(root, 'tracks').filter(t => t.title);
    const lks = readRepeater(root, 'links').filter(l => l.platform || l.url);
    const bad = lks.find(l => !/^https:\/\/\S+$/.test(l.url) || !l.platform);
    if (bad) return toast(`Check the platform links: each needs a platform name and a link starting with https://`, 'err', 6000);
    const status = E.status.value;
    const payload = {
      release: { id: id || '', title, slug, release_type: E.release_type.value, cover_url: E.cover_url.value, release_date: E.release_date.value, genre: E.genre.value.trim(), label: E.label.value.trim(), description: E.description.value.trim(), featured: E.featured.checked, status, published_at: status === 'published' ? (r.published_at || new Date().toISOString()) : (r.published_at || ''), seo_title: E.seo_title.value.trim(), seo_description: E.seo_description.value.trim() },
      tracks: trs.map((t, i) => ({ track_number: i + 1, title: t.title, featured_artists: t.featured_artists, producer_credit: t.producer_credit, duration_seconds: parseDur(t.duration) })),
      links: lks.map((l, i) => ({ platform: l.platform, url: l.url, is_primary: i === 0, display_order: i }))
    };
    const b = $('#save', root); b.disabled = true; b.textContent = 'Saving…';
    try {
      const newId = await db.saveRelease(payload); dirty = false; markDirty();
      toast(status === 'published' ? 'Saved. Press Publish to put it live.' : 'Draft saved.');
      if (!id) { ctx.setGuard(null); location.hash = `#/music/${newId}`; } else { r.published_at = payload.release.published_at; r.slug = slug; state.textContent = 'All changes saved'; state.className = 'state'; $('#vw', root)?.setAttribute('href', `${siteUrl}/music/${slug}/`); ctx.setTitle(title); }
    } catch (e) { fail(e); } finally { b.disabled = false; b.textContent = 'Save release'; }
  });

  $('#del', root)?.addEventListener('click', async () => {
    if (!await confirmBox({ title: 'Delete this release?', body: `"${r.title}" and its tracks and links will be removed. This cannot be undone.`, ok: 'Delete release', danger: true })) return;
    try { await db.remove('music_releases', id); if (r.cover_url) removeUpload(r.cover_url); markDirty(); dirty = false; ctx.setGuard(null); toast('Release deleted.'); location.hash = '#/music'; } catch (e) { fail(e); }
  });
}
