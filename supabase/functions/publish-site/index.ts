// Deploy:  supabase functions deploy publish-site
// Secret:  supabase secrets set NETLIFY_BUILD_HOOK_URL="https://api.netlify.com/build_hooks/xxxx"
// The CMS calls this with the signed-in user's token. Only active content staff can trigger a rebuild,
// and the build hook URL never reaches the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization,content-type,apikey,x-client-info',
  'Access-Control-Allow-Methods': 'POST,OPTIONS'
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  // Answer the browser's pre-check with exactly the headers it asks for (prevents spurious CORS failures)
  cors['Access-Control-Allow-Headers'] = req.headers.get('access-control-request-headers') || cors['Access-Control-Allow-Headers']; cors['Access-Control-Max-Age'] = '86400';
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return reply({ error: 'Please sign in again.' }, 401);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: uerr } = await sb.auth.getUser();
  if (uerr || !user) return reply({ error: 'Please sign in again.' }, 401);

  const { data: allowed, error: rerr } = await sb.rpc('is_content_staff');
  if (rerr || !allowed) return reply({ error: 'Your account cannot publish this site.' }, 403);

  const hook = Deno.env.get('NETLIFY_BUILD_HOOK_URL');
  if (!hook) return reply({ error: 'Publishing is not set up yet: add the NETLIFY_BUILD_HOOK_URL secret in Supabase.' }, 500);

  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) return reply({ error: `Netlify refused the build request (${res.status}).` }, 502);
  return reply({ ok: true, at: new Date().toISOString() });
});
