import { db, markDirty } from '../api.js';
import { $, esc, icon, fail, toast, confirmBox, openModal, statusChip, fmtDate } from '../ui.js';

export async function render(root, ctx) {
  ctx.setTitle('Live shows');
  let rows;
  const load = async () => { rows = await db.list('events', { order: 'event_date', asc: true }); };
  try { await load(); } catch (e) { return fail(e); }
  const today = new Date().toISOString().slice(0, 10);

  root.innerHTML = `<div class="page-h"><div><h2>Live shows</h2><p>Concerts and appearances listed on the Live page. Past dates hide automatically.</p></div><button class="btn primary" id="add">${icon('plus')} Add show</button></div><div class="card" id="out" style="padding:0;overflow:hidden"></div>`;
  const out = $('#out', root);
  const paint = () => {
    const up = rows.filter(r => r.event_date >= today), past = rows.filter(r => r.event_date < today).reverse();
    out.innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Date</th><th>Show</th><th>Location</th><th>Status</th></tr></thead><tbody>${[...up, ...past].map(r => `<tr data-id="${r.id}" class="${r.event_date < today ? 'past' : ''}"><td data-l="Date"><b>${esc(fmtDate(r.event_date))}</b></td><td data-l="Show">${esc(r.title)}</td><td data-l="Location" class="muted">${[r.venue, r.city, r.country].filter(Boolean).map(esc).join(', ') || '—'}</td><td data-l="Status">${statusChip(r.status)}${r.event_date < today ? ' <span class="chip">past</span>' : ''}</td></tr>`).join('')}</tbody></table>`
      : `<div class="empty-s" style="border:0">${icon('calendar')}<b>No shows yet</b><span>Add your first date and it will appear on the Live page.</span></div>`;
  };
  out.onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) form(rows.find(r => r.id === tr.dataset.id)); };

  function form(ev = null) {
    const r = ev || { title: '', event_date: '', venue: '', city: '', country: '', ticket_url: '', description: '', status: 'published' };
    openModal(`<form id="ef" class="fgrid" novalidate><label><span class="lbl">Show title <span class="req">*</span></span><input name="title" maxlength="140" value="${esc(r.title)}" placeholder="e.g. Okin Vibezz Live in Lagos" required></label>
<div class="fgrid two"><label><span class="lbl">Date <span class="req">*</span></span><input type="date" name="event_date" value="${esc(r.event_date)}" required></label><label><span class="lbl">Status</span><select name="status"><option value="published" ${r.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${r.status !== 'published' ? 'selected' : ''}>Draft</option></select></label></div>
<div class="fgrid two"><label><span class="lbl">Venue</span><input name="venue" maxlength="120" value="${esc(r.venue || '')}"></label><label><span class="lbl">City</span><input name="city" maxlength="80" value="${esc(r.city || '')}"></label></div>
<label><span class="lbl">Country</span><input name="country" maxlength="80" value="${esc(r.country || '')}"></label>
<label><span class="lbl">Ticket link</span><input name="ticket_url" type="url" maxlength="400" value="${esc(r.ticket_url || '')}" placeholder="https://"></label>
<label><span class="lbl">Details</span><textarea name="description" maxlength="800" style="min-height:90px">${esc(r.description || '')}</textarea></label>
<div class="m-actions">${ev ? `<button type="button" class="btn danger" id="del" style="margin-right:auto">${icon('trash')} Delete</button>` : ''}<button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">${ev ? 'Save changes' : 'Add show'}</button></div></form>`, {
      title: ev ? 'Edit show' : 'Add show', onMount: dlg => {
        const f = $('#ef', dlg), E = f.elements;
        f.onsubmit = async e => {
          e.preventDefault();
          if (!E.title.value.trim() || !E.event_date.value) { (E.title.value.trim() ? E.event_date : E.title).classList.add('invalid'); return toast('Please add a title and a date.', 'err'); }
          if (E.ticket_url.value && !/^https:\/\//.test(E.ticket_url.value.trim())) { E.ticket_url.classList.add('invalid'); return toast('The ticket link must start with https://', 'err'); }
          const row = { title: E.title.value.trim(), event_date: E.event_date.value, venue: E.venue.value.trim() || null, city: E.city.value.trim() || null, country: E.country.value.trim() || null, ticket_url: E.ticket_url.value.trim() || null, description: E.description.value.trim() || null, status: E.status.value };
          if (row.status === 'published') row.published_at = r.published_at || new Date().toISOString();
          try { ev ? await db.update('events', ev.id, row) : await db.insert('events', row); markDirty(); toast('Saved. Press Publish to put it live.'); dlg.close(); await load(); paint(); } catch (er) { fail(er); }
        };
        $('#del', dlg)?.addEventListener('click', async () => {
          dlg.close(); if (!await confirmBox({ title: 'Delete this show?', body: `"${r.title}" will be removed.`, ok: 'Delete', danger: true })) return;
          try { await db.remove('events', ev.id); markDirty(); toast('Deleted.'); await load(); paint(); } catch (er) { fail(er); }
        });
      }
    });
  }
  $('#add', root).onclick = () => form(); paint();
  if (ctx.query.has('new')) form();
}
