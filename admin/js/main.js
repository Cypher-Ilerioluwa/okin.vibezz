// CMS controller: boot, sign-in, access check, hash router, publish button.
import { configured, sb, auth, db, isDirty, publishSite, friendly, siteUrl, urlType } from './api.js';
import { $, $$, esc, icon, toast, fail, confirmBox } from './ui.js';

// need: 'content' = super admin or editor, 'team' = super admin only, 'any' = every active staff role
const ROUTES = {
  dashboard: { label: 'Dashboard', icon: 'dash', need: 'content', load: () => import('./views/dashboard.js') },
  music: { label: 'Music', icon: 'music', need: 'content', load: () => import('./views/music.js'), group: 'Content' },
  gallery: { label: 'Images & videos', icon: 'image', need: 'content', load: () => import('./views/gallery.js'), group: 'Content' },
  events: { label: 'Live shows', icon: 'calendar', need: 'content', load: () => import('./views/events.js'), group: 'Content' },
  pages: { label: 'Pages', icon: 'pages', need: 'content', load: () => import('./views/pages.js'), group: 'Content' },
  links: { label: 'Streaming & social', icon: 'link', need: 'content', load: () => import('./views/links.js'), group: 'Content' },
  inbox: { label: 'Inbox', icon: 'inbox', need: 'any', load: () => import('./views/inbox.js'), group: 'Messages' },
  team: { label: 'Team & access', icon: 'team', need: 'team', load: () => import('./views/team.js'), group: 'Settings' },
  account: { label: 'Account', icon: 'user', need: 'any', load: () => import('./views/account.js'), group: 'Settings' }
};
const STAFF_ROLES = ['super_admin', 'editor', 'booking_manager'];
let roles = [];
const can = need => need === 'any' || (need === 'team' ? roles.includes('super_admin') : roles.includes('super_admin') || roles.includes('editor'));
const allowed = () => Object.entries(ROUTES).filter(([, r]) => can(r.need));

const show = id => { for (const s of ['boot', 'login', 'notice', 'app']) $('#' + s).hidden = s !== id; };
let entered = false, user = null, guard = null, lastHash = '', suppress = false, token = 0, mustSetPassword = ['invite', 'recovery'].includes(urlType);

/* ---------- boot ---------- */
async function boot() {
  if (!configured) return notice('CMS not configured', 'Supabase details are missing. Set SUPABASE_URL and SUPABASE_ANON_KEY in your Netlify environment variables, then redeploy.');
  auth.onChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { history.replaceState(null, '', location.pathname); return loginMode('newPassForm'); }
    if (event === 'SIGNED_OUT') { entered = false; user = null; loginMode('loginForm'); return; }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !entered && $('#newPassForm').hidden) {
      // Coming back from a "forgot password" email link: choose a new password first
      if (mustSetPassword) { mustSetPassword = false; history.replaceState(null, '', location.pathname); return loginMode('newPassForm', 'Choose a new password to continue.'); }
      setTimeout(() => enter(session), 0);
    }
  });
  const session = await auth.session();
  if (!session) { if (!$('#newPassForm') || $('#newPassForm').hidden) loginMode('loginForm'); }
}

function notice(title, body, btn) {
  $('#nTitle').textContent = title; $('#nBody').textContent = body;
  const b = $('#nBtn'); b.hidden = !btn; if (btn) { b.textContent = btn.label; b.onclick = btn.fn; }
  show('notice');
}

async function enter(session) {
  if (entered) return; entered = true; user = session.user;
  try {
    const a = await auth.access(user.id); roles = a.roles.filter(r => STAFF_ROLES.includes(r));
    if (!a.active || !roles.length) { entered = false; return notice(a.active ? 'No access' : 'Account disabled', a.active ? 'This account is not authorised to manage the website. Ask a super admin to give you access.' : 'This account has been disabled. Ask a super admin if you think this is a mistake.', { label: 'Sign out', fn: () => auth.signOut() }); }
  } catch (e) { entered = false; return notice('Could not check access', friendly(e), { label: 'Sign out', fn: () => auth.signOut() }); }
  buildShell(); show('app'); refreshBadge();
  if (!location.hash || location.hash === '#') location.hash = `#/${allowed()[0][0]}`; else route();
}

/* ---------- login forms ---------- */
function loginMode(id, note = '') {
  for (const f of ['loginForm', 'resetForm', 'newPassForm']) $('#' + f).hidden = f !== id;
  for (const m of ['lMsg', 'rMsg', 'nMsg']) { $('#' + m).textContent = ''; $('#' + m).className = 'msg'; }
  if (note) { $('#nMsg').textContent = note; $('#nMsg').className = 'msg ok'; }
  show('login'); $('#' + id).querySelector('input')?.focus();
}
const msg = (id, text, ok) => { const m = $('#' + id); m.textContent = text; m.className = 'msg' + (ok ? ' ok' : ''); };
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const em = $('#lEmail').value.trim(), pw = $('#lPass').value;
  if (!em || !pw) return msg('lMsg', 'Enter your email and password.');
  const b = $('#lGo'); b.disabled = true; b.textContent = 'Signing in…'; msg('lMsg', '');
  try { await auth.signIn(em, pw); } catch (err) { msg('lMsg', friendly(err)); } finally { b.disabled = false; b.textContent = 'Sign in'; }
});
$('#lForgot').onclick = () => { loginMode('resetForm'); $('#rEmail').value = $('#lEmail').value; };
$('#rBack').onclick = () => loginMode('loginForm');
$('#resetForm').addEventListener('submit', async e => {
  e.preventDefault(); const em = $('#rEmail').value.trim(); if (!em) return msg('rMsg', 'Enter your email address.');
  try { await auth.reset(em); msg('rMsg', 'If that email has an account, a reset link is on its way.', true); } catch (err) { msg('rMsg', friendly(err)); }
});
$('#newPassForm').addEventListener('submit', async e => {
  e.preventDefault(); const pw = $('#nPass').value; if (pw.length < 10) return msg('nMsg', 'Use at least 10 characters.');
  try { await auth.setPassword(pw); msg('nMsg', 'Password updated.', true); const s = await auth.session(); entered = false; $('#newPassForm').hidden = true; if (s) enter(s); else loginMode('loginForm'); } catch (err) { msg('nMsg', friendly(err)); }
});

/* ---------- shell ---------- */
function buildShell() {
  let html = '', group = '';
  for (const [key, r] of allowed()) {
    if (r.group && r.group !== group) { group = r.group; html += `<div class="nav-sep">${group}</div>`; }
    html += `<a class="nav-a" data-r="${key}" href="#/${key}">${icon(r.icon)}<span>${r.label}</span>${key === 'inbox' ? '<span class="badge" id="inboxBadge" hidden></span>' : ''}</a>`;
  }
  $('#nav').innerHTML = html;
  $('#who').textContent = `${user?.email || ''} · ${roles.includes('super_admin') ? 'Super admin' : roles.includes('editor') ? 'Editor' : 'Booking manager'}`;
  $('#publishBtn').hidden = !can('content');
  $('#signOut').innerHTML = `${icon('out')} Sign out`;
  $('#menuBtn').innerHTML = icon('menu');
  $('#viewSite').innerHTML = `${icon('ext')}<span>View site</span>`; $('#viewSite').href = siteUrl || '/';
  $('#viewSite2').innerHTML = `${icon('ext')} View website`; $('#viewSite2').href = siteUrl || '/';
  paintPublish();
}
const openNav = o => document.body.classList.toggle('nav-open', o);
$('#menuBtn').onclick = () => openNav(true); $('#scrim').onclick = () => openNav(false);
$('#signOut').onclick = async () => { if (guard?.() && !confirm('You have unsaved changes. Sign out anyway?')) return; guard = null; await auth.signOut(); };

function paintPublish() {
  $('#publishBtn').innerHTML = `${icon('rocket')} Publish<span class="dot" ${isDirty() ? '' : 'hidden'}></span>`;
  $('#publishBtn').title = isDirty() ? 'You have changes that are not live yet' : 'Rebuild the live website';
}
addEventListener('okv-dirty', paintPublish);
export async function publishFlow() {
  const ok = await confirmBox({ title: 'Publish changes?', body: 'This rebuilds the live website with everything you have saved. It usually takes about a minute.', ok: 'Publish now' });
  if (!ok) return;
  const b = $('#publishBtn'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Publishing…';
  try { await publishSite(); toast('Publishing started. Your changes go live in about a minute.'); } catch (e) { fail(e); } finally { b.disabled = false; paintPublish(); }
}
$('#publishBtn').onclick = publishFlow;

export async function refreshBadge() {
  try {
    const [m, b] = await Promise.all([can('content') ? db.list('contact_messages', { select: 'id,status' }) : [], db.list('booking_enquiries', { select: 'id,status' })]);
    const n = m.filter(x => x.status === 'new').length + b.filter(x => x.status === 'new').length;
    const el = $('#inboxBadge'); if (el) { el.textContent = n; el.hidden = !n; }
  } catch { /* non-critical */ }
}

/* ---------- router ---------- */
const ctx = {
  setTitle: t => { $('#title').textContent = t; document.title = `${t} · Okin Vibezz CMS`; },
  setGuard: fn => { guard = fn; },
  go: h => { guard = null; location.hash = h; },
  refreshBadge, publish: publishFlow, user: () => user, can, roles: () => roles
};
async function route() {
  if (!entered) return;
  const [hpath, hquery = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const segs = hpath.split('/').filter(Boolean).map(decodeURIComponent), query = new URLSearchParams(hquery);
  let key = ROUTES[segs[0]] ? segs[0] : allowed()[0][0];
  if (!can(ROUTES[key].need)) { key = allowed()[0][0]; history.replaceState(null, '', `#/${key}`); }
  $$('.nav-a').forEach(a => a.classList.toggle('on', a.dataset.r === key));
  openNav(false);
  const my = ++token, view = $('#view');
  view.innerHTML = '<div class="empty-s"><span class="spin lg"></span></div>';
  ctx.setTitle(ROUTES[key].label);
  try {
    const mod = await ROUTES[key].load();
    if (my !== token) return;
    view.innerHTML = ''; guard = null;
    await mod.render(view, { ...ctx, params: segs.slice(1), query });
  } catch (e) { if (my === token) { view.innerHTML = `<div class="empty-s">${icon('warn')}<b>Something went wrong</b><span>${esc(friendly(e))}</span><button class="btn" onclick="location.reload()">Reload</button></div>`; console.error(e); } }
  scrollTo(0, 0); view.focus({ preventScroll: true });
}
addEventListener('hashchange', () => {
  if (suppress) { suppress = false; return; }
  if (guard?.() && !confirm('You have unsaved changes. Leave this page without saving?')) { suppress = true; location.hash = lastHash; return; }
  lastHash = location.hash; route();
});
addEventListener('beforeunload', e => { if (guard?.()) { e.preventDefault(); e.returnValue = ''; } });
lastHash = location.hash;
boot();
