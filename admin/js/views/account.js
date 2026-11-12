import { sb, auth, getSettings, siteUrl, friendly } from '../api.js';
import { $, esc, icon, fail, toast, ago } from '../ui.js';

export async function render(root, ctx) {
  ctx.setTitle('Account');
  const u = ctx.user(); let roles = [], set = {};
  try { const r = await sb.from('user_roles').select('role').eq('user_id', u.id); roles = (r.data || []).map(x => x.role); set = await getSettings(); } catch (e) { fail(e); }
  root.innerHTML = `<div class="page-h"><div><h2>Account</h2><p>Your login and how publishing works.</p></div></div>
<div class="grid g2" style="align-items:start">
 <div class="card"><h2 class="card-h">Your login</h2><dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Role</dt><dd>${esc(roles.map(r => r.replace('_', ' ')).join(', ') || 'Editor')}</dd></dl>
  <form id="pf" class="fgrid" style="margin-top:1.2rem" novalidate><h3 style="font-size:1rem">Change password</h3><label><span class="lbl">New password</span><input id="np" type="password" autocomplete="new-password" minlength="10" placeholder="At least 10 characters"></label><label><span class="lbl">Confirm new password</span><input id="np2" type="password" autocomplete="new-password"></label><div><button class="btn primary" type="submit">Update password</button></div></form></div>
 <div class="card"><h2 class="card-h">Publishing</h2><p>Changes you save are stored safely in the database. Press <b>Publish</b> (top right) to rebuild the live website with them. It takes about a minute.</p>
  <dl class="kv"><dt>Website</dt><dd><a href="${esc(siteUrl || '/')}" target="_blank" rel="noopener">${esc(siteUrl || location.origin)}</a></dd><dt>Last published</dt><dd>${set.meta?.published_at ? esc(ago(set.meta.published_at)) : 'Not yet from the CMS'}</dd></dl>
  <div style="margin-top:1rem;display:flex;gap:.6rem;flex-wrap:wrap"><button class="btn sun" id="pub">${icon('rocket')} Publish now</button><button class="btn" id="out">${icon('out')} Sign out</button></div></div></div>`;
  $('#pub', root).onclick = ctx.publish;
  $('#out', root).onclick = () => auth.signOut();
  $('#pf', root).onsubmit = async e => {
    e.preventDefault(); const a = $('#np', root).value, b = $('#np2', root).value;
    if (a.length < 10) return toast('Use at least 10 characters.', 'err'); if (a !== b) return toast('The two passwords do not match.', 'err');
    try { await auth.setPassword(a); $('#np', root).value = $('#np2', root).value = ''; toast('Password updated.'); } catch (er) { fail(er); }
  };
}
