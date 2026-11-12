import { sb, db, friendly } from '../api.js';
import { $, $$, esc, icon, fail, toast, confirmBox, openModal, statusChip, fmtDate, ago } from '../ui.js';

const MSG_STATUS = ['new', 'read', 'replied', 'archived'];
const BK_STATUS = ['new', 'reviewing', 'awaiting_information', 'accepted', 'declined', 'cancelled'];
const LABELS = { name: 'Name', email: 'Email', phone: 'Phone', organisation: 'Organisation', event_type: 'Event type', event_date: 'Event date', event_time: 'Event time', duration: 'Duration', venue: 'Venue', city: 'City', country: 'Country', budget: 'Budget', description: 'Description', notes: 'Notes' };
const nice = s => s.replace(/_/g, ' ');

export async function render(root, ctx) {
  ctx.setTitle('Inbox');
  const canMsg = ctx.can('content');   // booking managers only see booking requests
  let tab = (!canMsg || ctx.query.get('tab') === 'bookings') ? 'bookings' : 'messages', msgs = [], bks = [];
  const load = async () => { [msgs, bks] = await Promise.all([canMsg ? db.list('contact_messages') : [], db.list('booking_enquiries')]); };
  try { await load(); } catch (e) { return fail(e); }

  root.innerHTML = `<div class="page-h"><div><h2>Inbox</h2><p>Messages and booking requests sent from the website forms.</p></div></div>
<div class="toolbar"><div class="pills" id="tp">${canMsg ? '<button data-v="messages">Messages <span id="cm"></span></button>' : ''}<button data-v="bookings">Booking requests <span id="cb"></span></button></div></div><div class="card" id="out" style="padding:0;overflow:hidden"></div>`;
  const out = $('#out', root);
  const counts = () => { const a = msgs.filter(m => m.status === 'new').length, b = bks.filter(m => m.status === 'new').length; if ($('#cm', root)) $('#cm', root).textContent = a ? `(${a})` : ''; $('#cb', root).textContent = b ? `(${b})` : ''; ctx.refreshBadge(); };
  const paint = () => {
    $$('#tp button', root).forEach(b => b.classList.toggle('on', b.dataset.v === tab)); counts();
    if (tab === 'messages') out.innerHTML = msgs.length ? `<table class="tbl"><thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Status</th></tr></thead><tbody>${msgs.map(m => `<tr data-id="${m.id}"><td data-l="From"><b>${esc(m.name)}</b><br><span class="muted">${esc(m.email)}</span></td><td data-l="Subject">${esc(m.subject || '(no subject)')}</td><td data-l="Received" class="muted">${esc(ago(m.created_at))}</td><td data-l="Status">${statusChip(m.status)}</td></tr>`).join('')}</tbody></table>` : empty('No messages yet', 'Messages from the contact form will appear here.');
    else out.innerHTML = bks.length ? `<table class="tbl"><thead><tr><th>Reference</th><th>From</th><th>Event</th><th>Date</th><th>Status</th></tr></thead><tbody>${bks.map(b => { const d = b.details || {}; return `<tr data-id="${b.id}"><td data-l="Ref"><b>${esc(b.reference)}</b></td><td data-l="From">${esc(d.name || '')}<br><span class="muted">${esc(d.email || '')}</span></td><td data-l="Event">${esc(d.event_type || '')}${d.city ? ` · ${esc(d.city)}` : ''}</td><td data-l="Date" class="muted">${d.event_date ? esc(fmtDate(d.event_date)) : '—'}</td><td data-l="Status">${statusChip(b.status)}</td></tr>`; }).join('')}</tbody></table>` : empty('No booking requests yet', 'Requests from the booking form will appear here.');
  };
  const empty = (t, s) => `<div class="empty-s" style="border:0">${icon('inbox')}<b>${t}</b><span>${s}</span></div>`;
  $('#tp', root).onclick = e => { const b = e.target.closest('button'); if (b) { tab = b.dataset.v; paint(); } };
  out.onclick = e => { const tr = e.target.closest('tr[data-id]'); if (!tr) return; tab === 'messages' ? openMsg(msgs.find(m => m.id === tr.dataset.id)) : openBooking(bks.find(b => b.id === tr.dataset.id)); };
  const setStatus = async (table, row, status) => { try { await db.update(table, row.id, { status }); row.status = status; paint(); } catch (e) { fail(e); } };

  async function openMsg(m) {
    if (m.status === 'new') setStatus('contact_messages', m, 'read');
    openModal(`<dl class="kv"><dt>From</dt><dd>${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></dd><dt>Subject</dt><dd>${esc(m.subject || '(none)')}</dd><dt>Received</dt><dd>${esc(fmtDate(m.created_at))}, ${esc(new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</dd></dl>
<div class="card" style="background:var(--bg);box-shadow:none;white-space:pre-wrap">${esc(m.message)}</div>
<label><span class="lbl">Status</span><select id="ms">${MSG_STATUS.map(s => `<option ${m.status === s || (m.status === 'new' && s === 'read') ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
<div class="m-actions"><button class="btn danger" id="dm" style="margin-right:auto">${icon('trash')} Delete</button><a class="btn primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message'))}">${icon('inbox')} Reply by email</a></div>`, {
      title: 'Message', onMount: dlg => {
        $('#ms', dlg).onchange = e => setStatus('contact_messages', m, e.target.value);
        $('#dm', dlg).onclick = async () => { dlg.close(); if (!await confirmBox({ title: 'Delete message?', body: 'This cannot be undone.', ok: 'Delete', danger: true })) return; try { await db.remove('contact_messages', m.id); msgs = msgs.filter(x => x.id !== m.id); paint(); toast('Deleted.'); } catch (e) { fail(e); } };
      }
    });
  }

  async function openBooking(b) {
    if (b.status === 'new') setStatus('booking_enquiries', b, 'reviewing');
    const d = b.details || {}; let notes = [];
    const { data } = await sb.from('booking_private_notes').select('*').eq('enquiry_id', b.id).order('created_at'); notes = data || [];
    const noteHtml = () => notes.length ? notes.map(n => `<div class="card" style="padding:.7rem .9rem;box-shadow:none;background:var(--bg)"><small class="muted">${esc(ago(n.created_at))}</small><div style="white-space:pre-wrap">${esc(n.note)}</div></div>`).join('') : '<p class="hint">No notes yet.</p>';
    openModal(`<dl class="kv"><dt>Reference</dt><dd><b>${esc(b.reference)}</b></dd>${Object.keys(LABELS).filter(k => d[k]).map(k => `<dt>${LABELS[k]}</dt><dd style="white-space:pre-wrap">${k === 'email' ? `<a href="mailto:${esc(d[k])}">${esc(d[k])}</a>` : esc(k === 'event_date' ? fmtDate(d[k]) : d[k])}</dd>`).join('')}<dt>Received</dt><dd>${esc(fmtDate(b.created_at))}</dd></dl>
<label><span class="lbl">Status</span><select id="bs">${BK_STATUS.map(s => `<option value="${s}" ${b.status === s || (b.status === 'new' && s === 'reviewing') ? 'selected' : ''}>${nice(s)}</option>`).join('')}</select></label>
<div><span class="lbl">Private notes</span><div id="nl" class="fgrid" style="margin:.4rem 0">${noteHtml()}</div><textarea id="nt" style="min-height:70px" placeholder="Add a private note (only staff can see it)"></textarea><button class="btn sm" id="na" style="margin-top:.5rem">${icon('plus')} Add note</button></div>
<div class="m-actions"><a class="btn primary" href="mailto:${esc(d.email || '')}?subject=${encodeURIComponent('Re: Booking request ' + b.reference)}">${icon('inbox')} Reply by email</a></div>`, {
      title: 'Booking request', wide: true, onMount: dlg => {
        $('#bs', dlg).onchange = e => setStatus('booking_enquiries', b, e.target.value);
        $('#na', dlg).onclick = async () => {
          const t = $('#nt', dlg).value.trim(); if (!t) return;
          try { const row = await db.insert('booking_private_notes', { enquiry_id: b.id, author_id: ctx.user()?.id, note: t }); notes.push(row); $('#nl', dlg).innerHTML = noteHtml(); $('#nt', dlg).value = ''; } catch (e) { fail(e); }
        };
      }
    });
  }
  paint();
}
