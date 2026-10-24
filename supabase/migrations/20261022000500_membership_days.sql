-- Membership length for new sign-ups and the "expiring soon" reminder are admin settings,
-- not fixed in code (e.g. a 14-day trial before paid subscriptions arrive in phase 2).

alter table public.app_settings
  add column new_member_days int not null default 365 check (new_member_days between 1 and 3650),
  add column reminder_days   int not null default 30  check (reminder_days between 1 and 365);

-- New profiles expire after app_settings.new_member_days. The admin import may pass an explicit
-- expires_at in the metadata (e.g. to keep existing members on their original year).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  joined timestamptz := coalesce(nullif(meta->>'joined_at', '')::timestamptz, now());
  days int := coalesce((select new_member_days from public.app_settings where id = 1), 365);
begin
  insert into public.profiles (id, email, full_name, university, study_year, district, phone, notes,
                               joined_at, expires_at)
  values (new.id, new.email,
    coalesce(meta->>'full_name', ''), coalesce(meta->>'university', ''),
    coalesce(meta->>'study_year', ''), coalesce(meta->>'district', ''),
    coalesce(meta->>'phone', ''), nullif(meta->>'notes', ''),
    joined, coalesce(nullif(meta->>'expires_at', '')::timestamptz, joined + make_interval(days => days)));
  return new;
end $$;

-- The reminder goes out app_settings.reminder_days before expiry (kind stays 'expiry_30').
create or replace function public.queue_expiry_notices() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int := 0; k int;
  remind interval := make_interval(days => coalesce((select reminder_days from public.app_settings where id = 1), 30));
begin
  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select 'expiry_30', p.id, p.email, p.full_name, jsonb_build_object('expires_at', p.expires_at)
    from public.profiles p
   where p.role = 'member' and p.is_active
     and p.expires_at > now() and p.expires_at <= now() + remind
     -- not for a membership that started inside the reminder window (e.g. remind 30 days on a 14-day trial)
     and p.joined_at <= p.expires_at - remind
     and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'expiry_30'
                       and q.vars->>'expires_at' = to_jsonb(p.expires_at) #>> '{}');
  get diagnostics k = row_count; n := n + k;

  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select 'expired', p.id, p.email, p.full_name, jsonb_build_object('expires_at', p.expires_at)
    from public.profiles p
   where p.role = 'member' and p.is_active
     and p.expires_at <= now() and p.expires_at > now() - interval '7 days'
     and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'expired'
                       and q.vars->>'expires_at' = to_jsonb(p.expires_at) #>> '{}');
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.queue_expiry_notices() from public, anon, authenticated;

update public.email_templates set label = 'تذكير قبل الانتهاء' where kind = 'expiry_30';
