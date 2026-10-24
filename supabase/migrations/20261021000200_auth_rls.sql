-- Membership status, sign-up triggers, row level security and admin views.

create or replace function public.membership_status(p public.profiles) returns text
language sql stable set search_path = public as $$
  select case
    when not p.is_active       then 'suspended'
    when p.expires_at <= now() then 'expired'
    else 'active' end;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create the profile from sign-up metadata (the #join form, or the admin import).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  joined timestamptz := coalesce(nullif(meta->>'joined_at', '')::timestamptz, now());
begin
  insert into public.profiles (id, email, full_name, university, study_year, district, phone, notes,
                               joined_at, expires_at)
  values (new.id, new.email,
    coalesce(meta->>'full_name', ''), coalesce(meta->>'university', ''),
    coalesce(meta->>'study_year', ''), coalesce(meta->>'district', ''),
    coalesce(meta->>'phone', ''), nullif(meta->>'notes', ''),
    joined, joined + interval '1 year');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Welcome email once the address is confirmed; keep profiles.email in sync with auth.
create or replace function public.handle_user_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and coalesce(new.raw_user_meta_data->>'imported', '') <> 'true' then
    insert into public.email_queue (kind, member_id, to_email, to_name)
    select 'welcome', p.id, p.email, p.full_name from public.profiles p where p.id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated after update on auth.users
for each row execute function public.handle_user_updated();

-- Members may edit their personal fields only.
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
    new.joined_at   := old.joined_at;
    new.expires_at  := old.expires_at;
    new.created_at  := old.created_at;
    new.photo_url   := old.photo_url;
  end if;
  return new;
end $$;

create trigger protect_profile_columns before update on public.profiles
for each row execute function public.protect_profile_columns();

-- ---------- RLS ----------
alter table public.profiles        enable row level security;
alter table public.partners        enable row level security;
alter table public.partner_devices enable row level security;
alter table public.coupon_batches  enable row level security;
alter table public.coupons         enable row level security;
alter table public.redemptions     enable row level security;
alter table public.app_settings    enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_queue     enable row level security;
alter table public.keep_alive      enable row level security;

create policy "own profile or admin: read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "own profile or admin: update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create policy "own coupons or admin: read" on public.coupons for select to authenticated
  using (member_id = (select auth.uid()) or (select public.is_admin()));

create policy "admin: all" on public.partners        for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.coupon_batches  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.redemptions     for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.app_settings    for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.email_templates for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.email_campaigns for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: read" on public.email_queue    for select to authenticated using ((select public.is_admin()));
-- partner_devices: no policies, only reachable through security definer functions.

create policy "public read" on public.keep_alive for select to anon, authenticated using (true);

-- PIN hashes never leave the database, even for admins; partners change only through admin_* functions.
revoke all on public.partners, public.partner_devices from anon, authenticated;
grant select (id, name, logo_url, is_active, pin_version, failed_tries, locked_until, created_at)
  on public.partners to authenticated;

-- ---------- Admin views (security_invoker: RLS of the caller applies) ----------
create view public.admin_members with (security_invoker = on) as
select p.*,
       public.membership_status(p) as status,
       'DSM-' || lpad(p.member_no::text, 4, '0') as member_label,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'assigned')::int as coupons_available,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'redeemed')::int as coupons_redeemed
from public.profiles p;

create view public.admin_batches with (security_invoker = on) as
select b.*, pt.name as partner_name,
       count(c.*) filter (where c.status = 'available')::int as remaining,
       count(c.*) filter (where c.status = 'assigned')::int  as assigned,
       count(c.*) filter (where c.status = 'redeemed')::int  as redeemed
from public.coupon_batches b
join public.partners pt on pt.id = b.partner_id
left join public.coupons c on c.batch_id = b.id
group by b.id, pt.name;

create view public.admin_redemptions with (security_invoker = on) as
select r.id, r.redeemed_at, r.voided_at, r.partner_id, r.member_id, r.coupon_id,
       pt.name as partner_name, c.code as coupon_code, b.title as coupon_title, b.value_sar,
       p.full_name as member_name, 'DSM-' || lpad(p.member_no::text, 4, '0') as member_label,
       v.full_name as voided_by_name
from public.redemptions r
join public.partners pt on pt.id = r.partner_id
join public.coupons c on c.id = r.coupon_id
join public.coupon_batches b on b.id = c.batch_id
left join public.profiles p on p.id = r.member_id
left join public.profiles v on v.id = r.voided_by;

create view public.admin_partners with (security_invoker = on) as
select id, name, logo_url, is_active, pin_version, locked_until, created_at from public.partners;

revoke all on public.admin_members, public.admin_batches, public.admin_redemptions, public.admin_partners from anon;
