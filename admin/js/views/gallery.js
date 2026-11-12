import { db, uploadImage, removeUpload, markDirty } from '../api.js';
import { $, $$, esc, icon, fail, toast, confirmBox, openModal, imageField, wireImageFields, debounce, warnLow } from '../ui.js';
import { parseYouTube } from '/shared/schema.js';

const thumbOf = g => g.thumbnail_url || (g.media_type === 'video' && g.video_id ? `https://i.ytimg.com/vi/${g.video_id}/hqdefault.jpg` : g.media_url) || '';
const nice = n => n.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase()).slice(0, 80) || 'Untitled';

export async function render(root, ctx) {
  ctx.setTitle('Images & videos');
  let items = [], kind = 'all', status = 'all';
  const load = async () => {
    items = await db.list('gallery_items', { order: 'sort_order', asc: true });
    items.sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
  };
  try { await load(); } catch (e) { return fail(e); }

  root.innerHTML = `<div class="page-h"><div><h2>Images &amp; videos</h2><p>Images appear on the Images page and videos on the Videos page.</p></div><div style="display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn" id="addVid">${icon('video')} Add video</button><button class="btn primary" id="addPic">${icon('upload')} Upload images</button></div></div>
<div class="toolbar"><div class="pills" id="kp"><button class="on" data-v="all">All</button><button data-v="photo">Images</button><button data-v="video">Videos</button></div><select id="st" aria-label="Status"><option value="all">Any status</option><option value="published">Published</option><option value="draft">Draft</option></select></div><div id="out"></div>`;
  const out = $('#out', root);
  const visible = () => items.filter(g => (kind === 'all' || g.media_type === kind) && (status === 'all' || g.status === status));

  const paint = () => {
    const v = visible();
    out.innerHTML = v.length ? `<div class="gg">${v.map((g, i) => `<article class="gc" data-id="${g.id}"><div class="tb">${thumbOf(g) ? `<img src="${esc(thumbOf(g))}" alt="" loading="lazy">` : ''}<div class="tag"><span>${icon(g.media_type === 'video' ? 'video' : 'image')}${g.media_type === 'video' ? 'Video' : 'Image'}</span>${g.featured ? `<span class="star">${icon('star')}Featured</span>` : ''}${g.status !== 'published' ? '<span>Draft</span>' : ''}</div></div>
<div class="ft"><b title="${esc(g.title)}">${esc(g.title)}</b><div class="acts"><div><button class="icon-btn" data-a="prev" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>${icon('left')}</button><button class="icon-btn" data-a="next" aria-label="Move later" ${i === v.length - 1 ? 'disabled' : ''}>${icon('right')}</button></div><div><button class="icon-btn" data-a="edit" aria-label="Edit">${icon('edit')}</button><button class="icon-btn danger" data-a="del" aria-label="Delete">${icon('trash')}</button></div></div></div></article>`).join('')}</div>`
      : `<div class="empty-s">${icon('image')}<b>${items.length ? 'Nothing matches' : 'Nothing here yet'}</b><span>${items.length ? 'Try a different filter.' : 'Upload images or add a YouTube video.'}</span></div>`;
  };
  const refresh = async () => { await load(); paint(); };

  /* reorder: swap with the neighbour in the current view, then renumber */
  async function move(id, dir) {
    const v = visible(), i = v.findIndex(g => g.id === id), n = v[i + dir]; if (!n) return;
    const a = items.indexOf(v[i]), b = items.indexOf(n); [items[a], items[b]] = [items[b], items[a]];
    const changed = []; items.forEach((g, k) => { if (g.sort_order !== k * 10) { g.sort_order = k * 10; changed.push(g); } });
    paint();
    try { await Promise.all(changed.map(g => db.update('gallery_items', g.id, { sort_order: g.sort_order }))); markDirty(); } catch (e) { fail(e); refresh(); }
  }

  out.onclick = async e => {
    const btn = e.target.closest('[data-a]'); if (!btn) return;
    const id = btn.closest('.gc').dataset.id, g = items.find(x => x.id === id);
    if (btn.dataset.a === 'prev') move(id, -1); else if (btn.dataset.a === 'next') move(id, 1);
    else if (btn.dataset.a === 'edit') editItem(g); else if (btn.dataset.a === 'del') {
      if (!await confirmBox({ title: 'Delete this item?', body: `"${g.title}" will be removed from the gallery.`, ok: 'Delete', danger: true })) return;
      try { await db.remove('gallery_items', id); [g.media_url, g.thumbnail_url].forEach(u => u && removeUpload(u)); markDirty(); toast('Deleted.'); refresh(); } catch (er) { fail(er); }
    }
  };
  $('#kp', root).onclick = e => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.v; $$('#kp button', root).forEach(x => x.classList.toggle('on', x === b)); paint(); };
  $('#st', root).onchange = e => { status = e.target.value; paint(); };

  /* ---------- upload photos ---------- */
  function uploadModal() {
    openModal(`<div class="imgf"><div class="imgf-box" id="dz" tabindex="0" role="button" style="aspect-ratio:16/9"><span class="ph">${icon('upload')}<b>Drop images here or click to choose</b><small>Select as many as you like. Each one is cropped to the standard 4:5 size (1200 × 1500) so the Images page stays perfectly even.</small></span></div><input type="file" id="files" accept="image/*" multiple hidden></div><div id="prog" class="hint"></div>`, {
      title: 'Upload images', wide: true, onMount: (dlg, close) => {
        const dz = $('#dz', dlg), inp = $('#files', dlg), prog = $('#prog', dlg);
        const go = async list => {
          const files = [...list].filter(f => f.type.startsWith('image/')); if (!files.length) return toast('Please choose image files.', 'err');
          dz.style.pointerEvents = 'none'; let ok = 0; const min = items.length ? Math.min(...items.map(i => i.sort_order)) : 0;
          for (const [i, f] of files.entries()) {
            prog.textContent = `Uploading ${i + 1} of ${files.length}: ${f.name}`;
            try {
              const url = await uploadImage(f, 'gallery', { crop: [1200, 1500], onLowRes: (w, h) => toast(`${f.name} is small (${w} × ${h}px) and may look soft.`, 'err', 6000) });
              await db.insert('gallery_items', { media_type: 'photo', title: nice(f.name), alt_text: nice(f.name), media_url: url, status: 'published', published_at: new Date().toISOString(), sort_order: min - (files.length - i) * 10 });
              ok++;
            } catch (e) { fail(new Error(`${f.name}: ${e.message}`)); }
          }
          if (ok) { markDirty(); toast(`${ok} image${ok === 1 ? '' : 's'} added. Click the pencil to add titles and descriptions.`); }
          close(); refresh();
        };
        dz.onclick = () => inp.click(); dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
        inp.onchange = () => go(inp.files);
        ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
        ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
        dz.addEventListener('drop', e => go(e.dataTransfer.files));
      }
    });
  }

  /* ---------- add video ---------- */
  function videoModal() {
    openModal(`<form id="vf" class="fgrid" novalidate><label><span class="lbl">YouTube link <span class="req">*</span></span><input name="url" placeholder="https://www.youtube.com/watch?v=…" required></label><div id="vp" class="imgf-box" style="aspect-ratio:16/9;cursor:default" hidden></div>
<label><span class="lbl">Title <span class="req">*</span></span><input name="title" maxlength="120" required></label><label><span class="lbl">Status</span><select name="status"><option value="published">Published</option><option value="draft">Draft</option></select></label>
<div class="m-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Add video</button></div></form>`, {
      title: 'Add video', onMount: dlg => {
        const f = $('#vf', dlg), vp = $('#vp', dlg);
        f.elements.url.addEventListener('input', debounce(() => { const id = parseYouTube(f.elements.url.value); vp.hidden = !id; vp.innerHTML = id ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Video thumbnail">` : ''; }, 150));
        f.onsubmit = async e => {
          e.preventDefault(); const id = parseYouTube(f.elements.url.value), title = f.elements.title.value.trim();
          if (!id) { f.elements.url.classList.add('invalid'); return toast('That does not look like a YouTube link.', 'err'); }
          if (!title) { f.elements.title.classList.add('invalid'); return toast('Please add a title.', 'err'); }
          const min = items.length ? Math.min(...items.map(i => i.sort_order)) : 0;
          try { await db.insert('gallery_items', { media_type: 'video', title, video_id: id, alt_text: title, status: f.elements.status.value, published_at: new Date().toISOString(), sort_order: min - 10 }); markDirty(); toast('Video added.'); dlg.close(); refresh(); } catch (er) { fail(er); }
        };
      }
    });
  }

  /* ---------- edit ---------- */
  function editItem(g) {
    const v = g.media_type === 'video';
    openModal(`<form id="ef" class="fgrid" novalidate>
${v ? `<label><span class="lbl">YouTube link</span><input name="url" value="${g.video_id ? `https://youtu.be/${esc(g.video_id)}` : ''}"></label>` : imageField({ name: 'media_url', value: g.media_url || '', folder: 'gallery', label: 'Image', crop: [1200, 1500], hint: 'Replacing the image crops it to the standard 4:5 size.' })}
<label><span class="lbl">Title <span class="req">*</span></span><input name="title" maxlength="120" value="${esc(g.title)}" required></label>
<label><span class="lbl">Caption</span><input name="caption" maxlength="240" value="${esc(g.caption || '')}"></label>
<label><span class="lbl">${v ? 'Description' : 'Alt text'}</span><input name="alt_text" maxlength="200" value="${esc(g.alt_text || '')}"><span class="hint">${v ? 'Short description of the video.' : 'Describe the photo for people using screen readers.'}</span></label>
<div class="fgrid two"><label><span class="lbl">Credit</span><input name="credit" maxlength="120" value="${esc(g.credit || '')}" placeholder="Photographer or source"></label><label><span class="lbl">Status</span><select name="status"><option value="published" ${g.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${g.status !== 'published' ? 'selected' : ''}>Draft</option></select></label></div>
${v ? imageField({ name: 'thumbnail_url', value: g.thumbnail_url || '', folder: 'gallery', label: 'Custom thumbnail (optional)', ratio: 'wide', hint: 'Leave empty to use the YouTube thumbnail.' }) : ''}
<label class="check"><input type="checkbox" name="featured" ${g.featured ? 'checked' : ''}> Show on the home page</label>
<div class="m-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save changes</button></div></form>`, {
      title: v ? 'Edit video' : 'Edit image', wide: true, onMount: dlg => {
        wireImageFields(dlg); const f = $('#ef', dlg), E = f.elements;
        f.onsubmit = async e => {
          e.preventDefault(); const title = E.title.value.trim(); if (!title) { E.title.classList.add('invalid'); return toast('Please add a title.', 'err'); }
          const row = { title, caption: E.caption.value.trim() || null, alt_text: E.alt_text.value.trim() || null, credit: E.credit.value.trim() || null, status: E.status.value, featured: E.featured.checked };
          if (E.status.value === 'published' && !g.published_at) row.published_at = new Date().toISOString();
          if (v) { const id = parseYouTube(E.url.value); if (!id) { E.url.classList.add('invalid'); return toast('That does not look like a YouTube link.', 'err'); } row.video_id = id; row.thumbnail_url = E.thumbnail_url.value || null; }
          else { if (!E.media_url.value) return toast('An image is required.', 'err'); row.media_url = E.media_url.value; }
          try {
            await db.update('gallery_items', g.id, row);
            if (!v && g.media_url && g.media_url !== row.media_url) removeUpload(g.media_url);
            if (v && g.thumbnail_url && g.thumbnail_url !== row.thumbnail_url) removeUpload(g.thumbnail_url);
            markDirty(); toast('Saved.'); dlg.close(); refresh();
          } catch (er) { fail(er); }
        };
      }
    });
  }

  $('#addPic', root).onclick = uploadModal; $('#addVid', root).onclick = videoModal;
  paint();
  if (ctx.query.has('upload')) uploadModal(); else if (ctx.query.has('video')) videoModal();
}
