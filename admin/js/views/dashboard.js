import { db, getSettings, isDirty } from '../api.js';
import { esc, icon, ago, statusChip, fail } from '../ui.js';
import { PLATFORMS, SOCIALS } from '/shared/schema.js';

export async function render(root, ctx) {
  ctx.setTitle('Dashboard');
  let rel, gal, ev, msg, bk, set;
  try {
    [rel, gal, ev, msg, bk, set] = await Promise.all([
      db.list('music_releases', { select: 'id,title,release_type,status,cover_url,updated_at', order: 'updated_at' }),
      db.list('gallery_items', { select: 'id,media_type,status' }),
      db.list('events', { select: 'id,event_date,status' }).catch(() => []),
      db.list('contact_messages', { select: 'id,status' }),
      db.list('booking_enquiries', { select: 'id,status' }),
      getSettings()
    ]);
  } catch (e) { return fail(e); }

  const today = new Date().toISOString().slice(0, 10);
  const pub = rel.filter(r => r.status === 'published').length, drafts = rel.length - pub;
  const photos = gal.filter(g => g.media_type === 'photo').length, videos = gal.length - photos;
  const upcoming = ev.filter(e => e.event_date >= today && e.status === 'published').length;
  const unread = msg.filter(m => m.status === 'new').length + bk.filter(b => b.status === 'new').length;
  const streamN = PLATFORMS.filter(p => set.streaming?.[p.key]).length, socialN = SOCIALS.filter(p => set.socials?.[p.key]).length;

  const todo = [
    ['Publish your first release', rel.some(r => r.status === 'published'), '#/music/new'],
    ['Upload images or add a video', gal.length > 0, '#/gallery'],
    ['Add your streaming platform links', streamN > 0, '#/links'],
    ['Add your social profiles', socialN > 0, '#/links'],
    ['Upload the official artist photo', Boolean(set.site?.artist_photo), '#/pages/site'],
    ['Add a public contact email', Boolean(set.site?.contact_email), '#/pages/site']
  ];
  const done = todo.filter(t => t[1]).length;
  const hour = new Date().getHours(), hi = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  root.innerHTML = `
<div class="page-h"><div><h2>${hi}</h2><p>Here is what is happening on the website.</p></div></div>
<div class="card publish-card" style="margin-bottom:1rem"><div><h2>${isDirty() ? 'You have changes that are not live yet' : 'Your site is up to date'}</h2><p>${isDirty() ? 'Everything you save is stored safely. Press Publish to make it visible to visitors.' : 'Save changes in any section, then press Publish to update the live website.'}${set.meta?.published_at ? ` Last published ${esc(ago(set.meta.published_at))}.` : ''}</p></div><button class="btn sun" id="dPublish">${icon('rocket')} Publish site</button></div>
<div class="grid g4" style="margin-bottom:1rem">
  <a class="card stat" href="#/music"><div class="si">${icon('music')}</div><div><b>${rel.length}</b><span>Releases · ${pub} live, ${drafts} draft${drafts === 1 ? '' : 's'}</span></div></a>
  <a class="card stat" href="#/gallery"><div class="si">${icon('image')}</div><div><b>${gal.length}</b><span>${photos} image${photos === 1 ? '' : 's'} · ${videos} video${videos === 1 ? '' : 's'}</span></div></a>
  <a class="card stat" href="#/events"><div class="si">${icon('calendar')}</div><div><b>${upcoming}</b><span>Upcoming show${upcoming === 1 ? '' : 's'}</span></div></a>
  <a class="card stat" href="#/inbox"><div class="si">${icon('inbox')}</div><div><b>${unread}</b><span>New message${unread === 1 ? '' : 's'} &amp; bookings</span></div></a>
</div>
<div class="card" style="margin-bottom:1rem"><h2 class="card-h">Quick actions</h2><div class="quick">
  <a href="#/music/new">${icon('music')} New release</a><a href="#/gallery?upload">${icon('upload')} Upload images</a><a href="#/gallery?video">${icon('video')} Add video</a><a href="#/events?new">${icon('calendar')} Add show</a><a href="#/pages">${icon('pages')} Edit pages</a><a href="#/links">${icon('link')} Streaming links</a></div></div>
<div class="grid g2">
  <div class="card"><h2 class="card-h">Recently edited music</h2>${rel.length ? `<div class="list">${rel.slice(0, 5).map(r => `<a href="#/music/${r.id}">${r.cover_url ? `<img class="th" src="${esc(r.cover_url)}" alt="">` : `<span class="th"></span>`}<span class="t"><b>${esc(r.title)}</b><small>${esc(r.release_type.toUpperCase())} · ${esc(ago(r.updated_at))}</small></span>${statusChip(r.status)}</a>`).join('')}</div>` : `<div class="empty-s">${icon('music')}<b>No releases yet</b><a class="btn primary" href="#/music/new">Add your first release</a></div>`}</div>
  <div class="card"><h2 class="card-h">Getting set up <small style="font-weight:600;color:var(--faint)">${done}/${todo.length}</small></h2><div class="progress" style="margin-bottom:.8rem"><i style="width:${(done / todo.length) * 100}%"></i></div>
    <div class="list">${todo.map(([t, ok, h]) => `<a href="${h}"><span style="width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;${ok ? 'background:var(--green);color:#fff' : 'border:2px solid var(--line-2)'}">${ok ? icon('check') : ''}</span><span class="t"><b style="${ok ? 'text-decoration:line-through;color:var(--faint);font-weight:600' : ''}">${esc(t)}</b></span></a>`).join('')}</div></div>
</div>`;
  root.querySelector('#dPublish').onclick = ctx.publish;
  root.querySelectorAll('.check svg').forEach(s => s.style.cssText = 'width:14px;height:14px');
  root.querySelectorAll('.list span[style*="border-radius:50%"] svg').forEach(s => s.style.cssText = 'width:14px;height:14px');
}
