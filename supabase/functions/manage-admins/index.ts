// Deploy:  supabase functions deploy manage-admins
// Lets an ACTIVE super_admin create and manage CMS logins. No emails are involved: the super admin
// sets the password and shares the login details. The new admin can change it after signing in.
// Runs with the service role key (provided automatically to Edge Functions), so the key never reaches
// the browser. Every call re-checks the caller's role in the database.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ROLES = ['super_admin', 'editor', 'booking_manager'];
const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization,content-type,apikey,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
const fail = (error: string, status = 400) => reply({ error }, status);
const nice = (m: string) => /already (been )?registered|already exists/i.test(m) ? 'That email already has an account.' : m;

Deno.serve(async (req) => {
  // Answer the browser's pre-check with exactly the headers it asks for (prevents spurious CORS failures)
  cors['Access-Control-Allow-Headers'] = req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers']; cors['Access-Control-Max-Age'] = '86400';
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return fail('Method not allowed', 405);
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return fail('Please sign in again.', 401);
    const url = Deno.env.get('SUPABASE_URL')!, anonKey = Deno.env.get('SUPABASE_ANON_KEY')!, serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const who = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: uerr } = await who.auth.getUser();
    if (uerr || !user) return fail('Please sign in again.', 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const activeSupers = async (): Promise<string[]> => {
      const { data: rs } = await admin.from('user_roles').select('user_id').eq('role', 'super_admin');
      const ids = (rs || []).map((r) => r.user_id); if (!ids.length) return [];
      const { data: ps } = await admin.from('profiles').select('id').in('id', ids).eq('is_active', true);
      return (ps || []).map((p) => p.id);
    };
    const supers = await activeSupers();
    if (!supers.includes(user.id)) return fail('Only a super admin can manage the team.', 403);
    const othersSupers = (excluding: string) => supers.filter((id) => id !== excluding).length > 0;

    const b = await req.json().catch(() => ({}));
    const action = String(b.action || '');
    const audit = (a: string, id: string, meta: Record<string, unknown> = {}) => admin.from('audit_logs').insert({ actor_id: user.id, action: `team.${a}`, entity_type: 'user', entity_id: id, metadata: meta }).then(() => {}, () => {});
    const target = String(b.user_id || '');
    const needTarget = () => (!/^[0-9a-f-]{36}$/i.test(target) ? 'Missing user.' : target === user.id ? 'You cannot do that to your own account.' : '');

    if (action === 'list') {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return fail(error.message);
      const [{ data: profiles }, { data: roles }] = await Promise.all([admin.from('profiles').select('id,full_name,is_active'), admin.from('user_roles').select('user_id,role')]);
      const pmap = new Map((profiles || []).map((p) => [p.id, p]));
      const members = list.users.filter((u) => pmap.has(u.id)).map((u) => ({
        id: u.id, email: u.email, full_name: pmap.get(u.id)!.full_name, is_active: pmap.get(u.id)!.is_active,
        roles: (roles || []).filter((r) => r.user_id === u.id).map((r) => r.role),
        last_sign_in_at: u.last_sign_in_at, created_at: u.created_at, never_signed_in: !u.last_sign_in_at
      })).sort((a, c) => a.created_at.localeCompare(c.created_at));
      return reply({ ok: true, members, me: user.id });
    }

    if (action === 'create') {
      const email = String(b.email || '').trim().toLowerCase(), name = String(b.full_name || '').trim().slice(0, 80), role = String(b.role || ''), pw = String(b.password || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address.');
      if (!ROLES.includes(role)) return fail('Choose a valid role.');
      if (pw.length < 10) return fail('The password needs at least 10 characters.');
      // email_confirm: true means the login works immediately. No verification email is ever sent.
      let uid = '', adopted = false;
      const created = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: name } });
      if (created.error) {
        if (!/already (been )?registered|already exists/i.test(created.error.message)) return fail(nice(created.error.message));
        // The email already has a login (for example one made in the Supabase dashboard).
        // If that person is not CMS staff yet, adopt the login: set the password and give them a role.
        const { data: all } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const found = all?.users.find((u) => (u.email || '').toLowerCase() === email);
        if (!found) return fail('That email already has an account.');
        const { data: have } = await admin.from('user_roles').select('role').eq('user_id', found.id);
        if ((have || []).length) return fail('That person is already an admin. Change their role in the list instead.');
        const up = await admin.auth.admin.updateUserById(found.id, { password: pw, email_confirm: true, ban_duration: 'none', user_metadata: { ...(found.user_metadata || {}), ...(name ? { full_name: name } : {}) } });
        if (up.error) return fail(up.error.message, 500);
        uid = found.id; adopted = true;
      } else uid = created.data.user.id;
      const p = await admin.from('profiles').upsert({ id: uid, full_name: name || null, is_active: true });
      await admin.from('user_roles').delete().eq('user_id', uid);
      const r = await admin.from('user_roles').insert({ user_id: uid, role });
      if (p.error || r.error) { if (!adopted) await admin.auth.admin.deleteUser(uid); return fail('Could not save the new admin. Nothing was changed.', 500); }
      await audit('create', uid, { email, role, adopted });
      return reply({ ok: true, id: uid, adopted });
    }

    if (action === 'set_role') {
      const e = needTarget(); if (e) return fail(e);
      const role = String(b.role || ''); if (!ROLES.includes(role)) return fail('Choose a valid role.');
      if (supers.includes(target) && role !== 'super_admin' && !othersSupers(target)) return fail('There must always be at least one active super admin.');
      await admin.from('user_roles').delete().eq('user_id', target);
      const r = await admin.from('user_roles').insert({ user_id: target, role });
      if (r.error) return fail(r.error.message, 500);
      await audit('set_role', target, { role }); return reply({ ok: true });
    }

    if (action === 'set_active') {
      const e = needTarget(); if (e) return fail(e);
      const active = Boolean(b.active);
      if (!active && supers.includes(target) && !othersSupers(target)) return fail('There must always be at least one active super admin.');
      const r = await admin.from('profiles').update({ is_active: active }).eq('id', target);
      if (r.error) return fail(r.error.message, 500);
      await admin.auth.admin.updateUserById(target, { ban_duration: active ? 'none' : '876000h' });
      await audit(active ? 'enable' : 'disable', target); return reply({ ok: true });
    }

    if (action === 'remove') {
      const e = needTarget(); if (e) return fail(e);
      if (supers.includes(target) && !othersSupers(target)) return fail('There must always be at least one active super admin.');
      const { error } = await admin.auth.admin.deleteUser(target);
      if (error) return fail(error.message, 500);
      await audit('remove', target); return reply({ ok: true });
    }

    if (action === 'set_password') {
      const e = needTarget(); if (e) return fail(e);
      const pw = String(b.password || ''); if (pw.length < 10) return fail('The password needs at least 10 characters.');
      const { error } = await admin.auth.admin.updateUserById(target, { password: pw });
      if (error) return fail(error.message, 500);
      await audit('set_password', target); return reply({ ok: true });
    }

    return fail('Unknown action.');
  } catch (e) {
    console.error(e);
    return fail('Something went wrong. Please try again.', 500);
  }
});
