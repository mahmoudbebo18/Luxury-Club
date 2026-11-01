// Admin-only account operations that need the service role:
//   update_email: change a member's login email (and profile email via the auth trigger)
//   import:       create accounts for the members registered before the platform, and email
//                 each one a "set your password" link
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

type ImportRow = {
  email: string;
  full_name?: string;
  university?: string;
  study_year?: string;
  district?: string;
  phone?: string;
  notes?: string;
  joined_at?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // The caller must be signed in as an admin.
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData.user) return json({ error: 'unauthorized' }, 401);
  const { data: me } = await admin.from('profiles').select('role').eq('id', userData.user.id).single();
  if (me?.role !== 'admin') return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const { data: settings } = await admin.from('app_settings').select('site_url').eq('id', 1).single();
  const siteUrl = (settings?.site_url ?? 'https://dasman.the-luxury-club.com').replace(/\/$/, '');

  if (body.action === 'update_email') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'invalid_email' }, 400);
    const { error } = await admin.auth.admin.updateUserById(String(body.user_id), { email, email_confirm: true });
    if (error) return json({ error: /already/i.test(error.message) ? 'email_exists' : error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === 'import') {
    const rows: ImportRow[] = Array.isArray(body.members) ? body.members : [];
    const sendInvites = body.send_invites !== false;
    const results: { email: string; status: string }[] = [];
    for (const r of rows) {
      const email = String(r.email ?? '').trim().toLowerCase();
      if (!email) continue;
      const { error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: r.full_name ?? '',
          university: r.university ?? '',
          study_year: r.study_year ?? '',
          district: r.district ?? '',
          phone: r.phone ?? '',
          notes: r.notes ?? '',
          joined_at: r.joined_at ?? '',
          imported: 'true',
        },
      });
      if (error) {
        results.push({ email, status: /already/i.test(error.message) ? 'exists' : `error: ${error.message}` });
        continue;
      }
      if (sendInvites) {
        const { error: mailError } = await admin.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl}/reset` });
        results.push({ email, status: mailError ? `created, invite failed: ${mailError.message}` : 'created, invited' });
      } else {
        results.push({ email, status: 'created' });
      }
    }
    return json({ ok: true, results });
  }

  return json({ error: 'unknown_action' }, 400);
});
