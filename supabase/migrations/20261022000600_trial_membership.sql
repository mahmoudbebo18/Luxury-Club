-- Trial memberships: every new sign-up (and the imported members) starts as a free trial of
-- app_settings.new_member_days. A renewal from the admin panel (and, in phase 2, a payment) ends it.

alter table public.profiles add column is_trial boolean not null default false;

update public.profiles set is_trial = true where role = 'member';

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  joined timestamptz := coalesce(nullif(meta->>'joined_at', '')::timestamptz, now());
  days int := coalesce((select new_member_days from public.app_settings where id = 1), 365);
begin
  insert into public.profiles (id, email, full_name, university, study_year, district, phone, notes,
                               joined_at, expires_at, is_trial)
  values (new.id, new.email,
    coalesce(meta->>'full_name', ''), coalesce(meta->>'university', ''),
    coalesce(meta->>'study_year', ''), coalesce(meta->>'district', ''),
    coalesce(meta->>'phone', ''), nullif(meta->>'notes', ''),
    joined, coalesce(nullif(meta->>'expires_at', '')::timestamptz, joined + make_interval(days => days)),
    coalesce(nullif(meta->>'trial', '')::boolean, true));
  return new;
end $$;

-- Members can't flip their own trial flag.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.id          := old.id;
    new.member_no   := old.member_no;
    new.member_code := old.member_code;
    new.email       := old.email;
    new.role        := old.role;
    new.is_active   := old.is_active;
    new.is_trial    := old.is_trial;
    new.joined_at   := old.joined_at;
    new.expires_at  := old.expires_at;
    new.created_at  := old.created_at;
    new.photo_url   := old.photo_url;
  end if;
  return new;
end $$;

-- Renewing from the admin panel turns the trial into a full year.
create or replace function public.admin_renew_membership(p_member_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare new_expiry timestamptz;
begin
  perform public.assert_admin();
  update public.profiles set expires_at = greatest(expires_at, now()) + interval '1 year', is_trial = false
   where id = p_member_id returning expires_at into new_expiry;
  return new_expiry;
end $$;

-- The scan page shows whether the membership is a trial.
create or replace function public.get_member_card(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare m public.profiles; st text;
begin
  select * into m from public.profiles where member_code = p_code;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  st := public.membership_status(m);
  return json_build_object(
    'ok', true, 'status', st,
    'is_trial', m.is_trial,
    'name', m.full_name,
    'member_no', 'DSM-' || lpad(m.member_no::text, 4, '0'),
    'university', m.university,
    'photo_url', m.photo_url,
    'expires_at', m.expires_at,
    'coupons', case when st <> 'active' then '[]'::json else coalesce((
      select json_agg(json_build_object('id', c.id, 'code', c.code, 'title', b.title,
        'value', b.value_sar, 'partner', p.name, 'expires_at', b.expires_at)
        order by b.expires_at nulls last)
      from public.coupons c
      join public.coupon_batches b on b.id = c.batch_id
      join public.partners p on p.id = b.partner_id
      where c.member_id = m.id and c.status = 'assigned' and p.is_active
        and (b.expires_at is null or b.expires_at > now())), '[]'::json) end);
end $$;

-- admin_members expands p.* at creation time: rebuild it to include is_trial.
drop view public.admin_members;
create view public.admin_members with (security_invoker = on) as
select p.*,
       public.membership_status(p) as status,
       'DSM-' || lpad(p.member_no::text, 4, '0') as member_label,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'assigned')::int as coupons_available,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'redeemed')::int as coupons_redeemed
from public.profiles p;
revoke all on public.admin_members from anon;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
