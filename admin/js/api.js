// Supabase access for the CMS: auth, data helpers, image upload, publishing.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const cfg = window.CMS_CONFIG || {};
export const configured = Boolean(cfg.url && cfg.anonKey);
export const siteUrl = (cfg.siteUrl || '').replace(/\/$/, '');
export const functionUrl = name => `${(cfg.url || '').replace(/\/$/, '')}/functions/v1/${name}`;
/* supabase-js reports "Failed to send a request" when the browser got no usable answer: the function is not deployed under that exact name, crashed at start-up, or the browser pre-check was refused */
const isUnreachable = e => e && (e.name === 'FunctionsFetchError' || /Failed to send a request/i.test(e.message || ''));
const unreachable = name => Object.assign(new Error(`Could not reach the "${name}" function. Check that it is deployed with exactly that name (Supabase > Edge Functions).`), { fnName: name, fnUnreachable: true });
export const BUCKET = 'media';
// Read what the email link was for (invite / recovery) BEFORE the Supabase client consumes the URL hash.
export const urlType = (location.hash.match(/[#&]type=(\w+)/) || [])[1] || '';
export const sb = configured ? createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

/* ---------- errors ---------- */
export function friendly(e) {
  const m = (e && (e.message || e.error_description)) || String(e || 'Something went wrong');
  if (/duplicate key.*slug|slug.*already/i.test(m)) return 'That URL slug is already used by another release. Choose a different one.';
  if (/row-level security|permission denied|not authorized/i.test(m)) return 'You do not have permission to do that.';
  if (/jwt expired|invalid jwt/i.test(m)) return 'Your session expired. Please sign in again.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Network problem. Check your connection and try again.';
  if (/Invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/violates check constraint.*url/i.test(m)) return 'Links must start with https://';
  return m;
}
const unwrap = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };

/* ---------- auth ---------- */
export const auth = {
  session: async () => (await sb.auth.getSession()).data.session,
  signIn: (email, password) => sb.auth.signInWithPassword({ email, password }).then(unwrap),
  signOut: () => sb.auth.signOut(),
  reset: email => sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/admin/' }).then(unwrap),
  setPassword: password => sb.auth.updateUser({ password, data: { needs_password_change: false } }).then(unwrap),
  onChange: fn => sb.auth.onAuthStateChange(fn),
  hasAccess: async () => { const { data, error } = await sb.rpc('is_content_staff'); return !error && data === true; },
  /* roles + active flag for the signed-in user (RLS lets everyone read their own rows) */
  access: async uid => {
    const [r, p] = await Promise.all([sb.from('user_roles').select('role').eq('user_id', uid), sb.from('profiles').select('is_active').eq('id', uid).maybeSingle()]);
    return { roles: (r.data || []).map(x => x.role), active: Boolean(p.data && p.data.is_active) };
  }
};

/* ---------- generic table helpers ---------- */
export const db = {
  list: (t, { order = 'created_at', asc = false, select = '*' } = {}) => sb.from(t).select(select).order(order, { ascending: asc }).then(unwrap),
  get: (t, id, select = '*') => sb.from(t).select(select).eq('id', id).single().then(unwrap),
  insert: (t, row) => sb.from(t).insert(row).select().single().then(unwrap),
  update: (t, id, row) => sb.from(t).update(row).eq('id', id).select().single().then(unwrap),
  remove: (t, id) => sb.from(t).delete().eq('id', id).then(unwrap),
  saveRelease: payload => sb.rpc('cms_save_release', { p: payload }).then(unwrap)
};

/* ---------- site settings (one JSON row) ---------- */
export async function getSettings() {
  const { data, error } = await sb.from('site_settings').select('data').maybeSingle();
  if (error) throw new Error(friendly(error));
  return data?.data || {};
}
export async function saveSettings(mutate) {
  const next = mutate(structuredClone(await getSettings()));
  unwrap(await sb.from('site_settings').upsert({ id: true, data: next, updated_at: new Date().toISOString() }));
  markDirty();
  return next;
}

/* ---------- "unpublished changes" flag ---------- */
const KEY = 'okv_unpublished';
export const isDirty = () => localStorage.getItem(KEY) === '1';
export function markDirty() { localStorage.setItem(KEY, '1'); dispatchEvent(new Event('okv-dirty')); }
export function clearDirty() { localStorage.removeItem(KEY); dispatchEvent(new Event('okv-dirty')); }

/* ---------- images ---------- */
/* Centre-crop to an exact size (e.g. 1200 x 1500) so every image on the site has the same shape and resolution.
   Taller crops lean slightly towards the top, where faces usually are. */
async function cropTo(file, [W, H], onLowRes) {
  const bmp = await createImageBitmap(file);
  if (bmp.width < W * 0.6 || bmp.height < H * 0.6) onLowRes?.(bmp.width, bmp.height);
  const target = W / H, src = bmp.width / bmp.height;
  let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0;
  if (src > target) { sw = Math.round(bmp.height * target); sx = Math.round((bmp.width - sw) / 2); }
  else { sh = Math.round(bmp.width / target); sy = Math.round((bmp.height - sh) * (H > W ? 0.2 : 0.5)); }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  return await new Promise(r => c.toBlob(b => b ? r(b) : c.toBlob(r, 'image/jpeg', 0.9), 'image/webp', 0.86));
}

async function shrink(file, max, quality) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // gif/avif/others uploaded untouched
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900 * 1024 && file.type !== 'image/png') return file;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', quality));
    return blob && blob.size < file.size * 1.1 ? blob : file;
  } catch { return file; }
}
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif', 'image/avif': 'avif', 'image/jpeg': 'jpg' };

export async function uploadImage(file, folder = 'uploads', { max = 1800, quality = 0.86, crop = null, onLowRes = null } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG, WebP or GIF).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large (25 MB max).');
  let blob;
  if (crop && /^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) { try { blob = await cropTo(file, crop, onLowRes); } catch { blob = await shrink(file, max, quality); } }
  else blob = await shrink(file, max, quality);
  if (blob.size > 10 * 1024 * 1024) throw new Error('That image is still over 10 MB after compression. Please use a smaller one.');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[blob.type] || 'jpg'}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(friendly(error));
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
export async function removeUpload(url) {
  const m = String(url || '').match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`));
  if (m) await sb.storage.from(BUCKET).remove([decodeURIComponent(m[1])]).catch(() => {});
}

/* ---------- publishing ---------- */
export async function publishSite() {
  const { data, error } = await sb.functions.invoke('publish-site');
  if (error) {
    if (isUnreachable(error)) throw unreachable('publish-site');
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(friendly({ message: msg }));
  }
  if (data?.error) throw new Error(data.error);
  await saveSettingsQuiet(s => { s.meta = { ...(s.meta || {}), published_at: new Date().toISOString() }; return s; });
  clearDirty();
}
async function saveSettingsQuiet(mutate) {
  try { const next = mutate(structuredClone(await getSettings())); await sb.from('site_settings').upsert({ id: true, data: next, updated_at: new Date().toISOString() }); } catch { /* non-critical */ }
}

/* ---------- team management (Edge Function; super admins only) ---------- */
export async function manageAdmins(action, payload = {}) {
  const { data, error } = await sb.functions.invoke('manage-admins', { body: { action, ...payload } });
  if (error) {
    if (isUnreachable(error)) throw unreachable('manage-admins');
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(friendly({ message: msg }));
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
