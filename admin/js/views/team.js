import { manageAdmins, functionUrl } from '../api.js';
import { $, $$, esc, icon, fail, toast, confirmBox, openModal, ago } from '../ui.js';

const ROLES = {
  super_admin: { label: 'Super admin', desc: 'Full control, including adding and removing other admins.' },
  editor: { label: 'Editor', desc: 'Edits music, images, videos, pages, shows and links. Answers messages and bookings. Can publish.' },
  booking_manager: { label: 'Booking manager', desc: 'Sees and answers booking requests only. Cannot edit the website.' }
};
const roleOf = m => m.roles.find(r => ROLES[r]) || 'editor';

/* strong, easy-to-read temporary password (no look-alike characters) */
function makePassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const v = crypto.getRandomValues(new Uint32Array(14));
  return [...v].map(n => a[n % a.length]).join('').replace(/(.{4})(.{5})(.*)/, '$1-$2-$3');
}

export async function render(root, ctx) {
  ctx.setTitle('Team & access');
  let members = [], me = ctx.user().id;
  const load = async () => { const r = await manageAdmins('list'); members = r.members; me = r.me || me; };
  try { await load(); } catch (e) {
    if (e.fnUnreachable) {
      const u = functionUrl('manage-admins');
      root.innerHTML = `<div class="card diag"><h2 style="font-size:1.3rem;margin-bottom:.4rem">The CMS cannot reach the <code>manage-admins</code> function</h2>
<p class="dim">The function is not answering the browser. Work through this, it takes a minute:</p>
<ol><li><b>Open the function address</b> in a new tab: <a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></li>
<li>Look at what the page says:
<table class="tbl nohover" style="margin:.6rem 0"><tbody>
<tr><td><code>{"error":"Method not allowed"}</code><br><span class="muted">or</span> <code>Missing authorization header</code></td><td><b>The function is running.</b> Turn off <b>Verify JWT</b> for it: Supabase &gt; Edge Functions &gt; manage-admins &gt; Details. (This is safe: the function checks your login itself.) Or redeploy with <code>supabase functions deploy manage-admins --no-verify-jwt</code>. Then reload this page.</td></tr>
<tr><td><code>"code":"NOT_FOUND"</code> <span class="muted">/ Requested function was not found</span></td><td><b>Not deployed, or named differently.</b> The name must be exactly <code>manage-admins</code> (with a hyphen, all lower case). Deploy it again.</td></tr>
<tr><td><code>"code":"BOOT_ERROR"</code></td><td><b>The code crashed on start-up.</b> Open Edge Functions &gt; manage-admins &gt; <b>Logs</b> to see why, and re-paste the code from <code>supabase/functions/manage-admins/index.ts</code> exactly.</td></tr>
<tr><td>The page does not load at all</td><td>Check <code>SUPABASE_URL</code> in Netlify is exactly your project URL, then redeploy.</td></tr></tbody></table></li>
<li>Reload this page: <button class="btn sm" onclick="location.reload()">Reload</button></li></ol></div>`;
      return;
    }
    root.innerHTML = `<div class="empty-s">${icon('warn')}<b>Team management is not available</b><span>${esc(e.message)}</span></div>`; return;
  }

  root.innerHTML = `<div class="page-h"><div><h2>Team &amp; access</h2><p>Add people who can sign in to this CMS and choose what each of them can do.</p></div><button class="btn primary" id="add">${icon('plus')} Add admin</button></div>
<div class="card" id="out" style="padding:0;overflow:hidden"></div>
<div class="grid g3" style="margin-top:1rem">${Object.entries(ROLES).map(([k, r]) => `<div class="card"><span class="chip r-${k}">${r.label}</span><p class="dim" style="margin:.7rem 0 0">${r.desc}</p></div>`).join('')}</div>`;
  const out = $('#out', root);

  const status = m => !m.is_active ? '<span class="chip st-archived">Disabled</span>' : m.never_signed_in ? '<span class="chip st-draft">Not signed in yet</span>' : '<span class="chip st-published">Active</span>';
  const paint = () => {
    out.innerHTML = `<table class="tbl nohover"><thead><tr><th>Person</th><th>Role</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>${members.map(m => {
      const self = m.id === me, role = roleOf(m);
      return `<tr data-id="${m.id}"><td data-l="Person"><b>${esc(m.full_name || m.email)}</b>${self ? ' <span class="chip">You</span>' : ''}<br><span class="muted">${esc(m.email)}</span></td>
<td data-l="Role">${self ? `<span class="chip r-${role}">${ROLES[role].label}</span>` : `<select data-a="role" aria-label="Role for ${esc(m.email)}">${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${k === role ? 'selected' : ''}>${r.label}</option>`).join('')}</select>`}</td>
<td data-l="Status">${status(m)}</td><td data-l="Last sign-in" class="muted">${m.last_sign_in_at ? esc(ago(m.last_sign_in_at)) : 'Never'}</td>
<td class="acts">${self ? '' : `<button class="icon-btn" data-a="pw" title="Set a new password" aria-label="Set a new password">${icon('key')}</button><button class="icon-btn" data-a="active" title="${m.is_active ? 'Disable sign-in' : 'Enable sign-in'}" aria-label="${m.is_active ? 'Disable' : 'Enable'} account">${icon('power')}</button><button class="icon-btn danger" data-a="remove" title="Remove admin" aria-label="Remove admin">${icon('trash')}</button>`}</td></tr>`;
    }).join('')}</tbody></table>`;
  };
  const refresh = async () => { await load(); paint(); };
  paint();

  /* ---- row actions ---- */
  out.addEventListener('change', async e => {
    const sel = e.target.closest('select[data-a=role]'); if (!sel) return;
    const m = members.find(x => x.id === sel.closest('tr').dataset.id), prev = roleOf(m);
    try { await manageAdmins('set_role', { user_id: m.id, role: sel.value }); m.roles = [sel.value]; toast(`${m.full_name || m.email} is now ${ROLES[sel.value].label.toLowerCase()}.`); }
    catch (er) { sel.value = prev; fail(er); }
  });
  out.addEventListener('click', async e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const m = members.find(x => x.id === b.closest('tr').dataset.id), who = m.full_name || m.email;
    try {
      if (b.dataset.a === 'pw') passwordModal(m);
      else if (b.dataset.a === 'active') {
        if (m.is_active && !await confirmBox({ title: `Disable ${who}?`, body: 'They will be signed out of the CMS and cannot sign in again until you enable them.', ok: 'Disable', danger: true })) return;
        await manageAdmins('set_active', { user_id: m.id, active: !m.is_active }); toast(m.is_active ? 'Account disabled.' : 'Account enabled.'); await refresh();
      } else if (b.dataset.a === 'remove') {
        if (!await confirmBox({ title: `Remove ${who}?`, body: 'Their login is deleted for good. Content they created stays on the website.', ok: 'Remove admin', danger: true })) return;
        await manageAdmins('remove', { user_id: m.id }); toast('Admin removed.'); await refresh();
      }
    } catch (er) { fail(er); }
  });

  /* ---- credentials hand-over ---- */
  const credentials = (email, pw, title = 'Share these login details') => openModal(`<p>Send these to <b>${esc(email)}</b> through a private channel (WhatsApp, in person, etc.). After signing in they can change their password under <b>Account</b>.</p>
<div class="cred"><div><span class="lbl">Sign-in page</span><code>${esc(location.origin)}/admin/</code></div><div><span class="lbl">Email</span><code>${esc(email)}</code></div><div><span class="lbl">Password</span><code>${esc(pw)}</code></div></div>
<div class="m-actions"><button class="btn" id="cp">${icon('copy')} Copy details</button><button class="btn primary" data-close>Done</button></div>`, {
    title, onMount: dlg => { $('#cp', dlg).onclick = async () => { try { await navigator.clipboard.writeText(`Sign in: ${location.origin}/admin/\nEmail: ${email}\nPassword: ${pw}`); toast('Copied.'); } catch { toast('Copy failed. Select the text instead.', 'err'); } }; }
  });

  function passwordModal(m) {
    openModal(`<form id="pf" class="fgrid" novalidate><p class="dim" style="margin:0">Set a new password for this person, then send it to them. The old password stops working straight away.</p>
<label><span class="lbl">New password</span><div class="pw-row"><input name="pw" value="${makePassword()}" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="gen">${icon('refresh')} New</button></div><span class="hint">At least 10 characters. Type your own or use the generated one.</span></label>
<div class="m-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Set password</button></div></form>`, {
      title: `New password for ${m.full_name || m.email}`, onMount: dlg => {
        const f = $('#pf', dlg); $('#gen', dlg).onclick = () => { f.pw.value = makePassword(); };
        f.onsubmit = async ev => { ev.preventDefault(); const pw = f.pw.value.trim(); if (pw.length < 10) return toast('Use at least 10 characters.', 'err');
          try { await manageAdmins('set_password', { user_id: m.id, password: pw }); dlg.close(); credentials(m.email, pw, 'Password updated'); } catch (er) { fail(er); } };
      }
    });
  }

  /* ---- add admin ---- */
  $('#add', root).onclick = () => openModal(`<form id="af" class="fgrid" novalidate>
<label><span class="lbl">Full name</span><input name="name" maxlength="80" autocomplete="off"></label>
<label><span class="lbl">Email (their username) <span class="req">*</span></span><input name="email" type="email" maxlength="200" autocomplete="off" required></label>
<div><span class="lbl">Role</span><div class="rolepick">${Object.entries(ROLES).map(([k, r]) => `<label class="rolecard"><input type="radio" name="role" value="${k}" ${k === 'editor' ? 'checked' : ''}><span><b>${r.label}</b><small>${r.desc}</small></span></label>`).join('')}</div></div>
<label><span class="lbl">Password <span class="req">*</span></span><div class="pw-row"><input name="pw" value="${makePassword()}" autocomplete="off" spellcheck="false"><button type="button" class="btn sm" id="gen">${icon('refresh')} New</button></div><span class="hint">At least 10 characters. You will see the login details after saving so you can send them. They can change the password after signing in.</span></label>
<div class="m-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit" id="go">Create admin</button></div></form>`, {
    title: 'Add admin', wide: true, onMount: dlg => {
      const f = $('#af', dlg), E = f.elements;
      $('#gen', dlg).onclick = () => { E.pw.value = makePassword(); };
      f.onsubmit = async ev => {
        ev.preventDefault(); const email = E.email.value.trim(), pw = E.pw.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { E.email.classList.add('invalid'); E.email.focus(); return toast('Enter a valid email address.', 'err'); }
        if (pw.length < 10) { E.pw.classList.add('invalid'); return toast('The password needs at least 10 characters.', 'err'); }
        const go = $('#go', dlg); go.disabled = true; go.textContent = 'Creating…';
        try {
          await manageAdmins('create', { email, full_name: E.name.value.trim(), role: E.role.value, password: pw });
          dlg.close(); await refresh(); credentials(email, pw);
        } catch (er) { fail(er); go.disabled = false; go.textContent = 'Create admin'; }
      };
    }
  });
}
