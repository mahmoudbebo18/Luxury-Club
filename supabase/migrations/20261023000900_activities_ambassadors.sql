-- Activities (individual or team sign-up with a seat limit, attendance check-in), the ambassador
-- programme (application, approval, referral link, check-in at activities) and coupon images.
--
-- Ambassadors stay members (role = 'member'): the counter, scan page, redemption and reminders all
-- filter on role = 'member', so the programme is a flag on the profile, not a new role.

-- ---------- Images (activities, coupons) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "media: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select public.is_admin()));
create policy "media: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));
create policy "media: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select public.is_admin()));

alter table public.coupon_batches add column image_url text;

-- Admin notifications (new activity sign-up, ambassador application). Empty = off.
alter table public.app_settings add column notify_email text not null default 'dasman@the-luxury-club.com';

create or replace function public.member_label(n int) returns text
language sql immutable set search_path = public as $$
  select 'DSM-' || lpad(n::text, 4, '0');
$$;

-- ---------- Activities ----------
create table public.activities (
  id                      uuid primary key default gen_random_uuid(),
  title                   text not null check (length(trim(title)) between 2 and 120),
  description             text not null default '',
  image_url               text,
  category                text not null default 'sport'
                          check (category in ('sport', 'entertainment', 'workshop', 'trip', 'other')),
  location                text not null default '',
  starts_at               timestamptz not null,
  ends_at                 timestamptz,
  registration_closes_at  timestamptz,
  mode                    text not null default 'individual' check (mode in ('individual', 'team')),
  capacity                int not null check (capacity between 1 and 5000),   -- seats, or teams in team mode
  team_min                int,                                                -- team size including the captain
  team_max                int,
  status                  text not null default 'published'
                          check (status in ('draft', 'published', 'closed', 'cancelled')),
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (mode = 'individual' or (team_min between 1 and 30 and team_max between team_min and 30))
);
create index activities_starts_idx on public.activities (starts_at);

create table public.activity_registrations (                -- one seat: a person, or a whole team
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references public.activities(id) on delete cascade,
  captain_id    uuid references public.profiles(id) on delete set null,
  team_name     text,
  status        text not null default 'registered' check (status in ('registered', 'cancelled')),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz,
  cancelled_by  uuid references public.profiles(id) on delete set null
);
create index activity_registrations_activity_idx on public.activity_registrations (activity_id, status);
create unique index activity_registrations_team_name_idx on public.activity_registrations (activity_id, lower(team_name))
  where status = 'registered' and team_name is not null;

-- Who is in each seat. A member is in at most one seat per activity; rows of a cancelled seat are deleted.
create table public.activity_participants (
  activity_id     uuid not null references public.activities(id) on delete cascade,
  member_id       uuid not null references public.profiles(id) on delete cascade,
  registration_id uuid not null references public.activity_registrations(id) on delete cascade,
  is_captain      boolean not null default false,
  added_at        timestamptz not null default now(),
  checked_in_at   timestamptz,
  checked_in_by   uuid references public.profiles(id) on delete set null,
  primary key (activity_id, member_id)
);
create index activity_participants_registration_idx on public.activity_participants (registration_id);
create index activity_participants_member_idx on public.activity_participants (member_id);

-- What a member sees: draft, open, full, closed (manually, deadline or started), ended, cancelled.
create or replace function public.activity_state(a public.activities, taken int) returns text
language sql stable set search_path = public as $$
  select case
    when a.status = 'cancelled' then 'cancelled'
    when a.status = 'draft' then 'draft'
    when coalesce(a.ends_at, a.starts_at) <= now() then 'ended'
    when a.status = 'closed' or a.starts_at <= now()
         or (a.registration_closes_at is not null and a.registration_closes_at <= now()) then 'closed'
    when taken >= a.capacity then 'full'
    else 'open' end;
$$;

create or replace function public.activity_taken(p_activity_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.activity_registrations where activity_id = p_activity_id and status = 'registered';
$$;

-- Check-in at the door: from a day before the start until a day after the end.
create or replace function public.checkin_open(a public.activities) returns boolean
language sql stable set search_path = public as $$
  select a.status in ('published', 'closed')
     and now() between a.starts_at - interval '1 day' and coalesce(a.ends_at, a.starts_at) + interval '1 day';
$$;

-- Capacity can't drop under the seats taken; the mode is fixed once people signed up.
create or replace function public.activities_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare taken int;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.activity_registrations where activity_id = old.id and status = 'registered') then
      raise exception 'has_registrations';
    end if;
    return old;
  end if;
  taken := public.activity_taken(new.id);
  if new.capacity < taken then raise exception 'capacity_below_taken' using detail = taken::text; end if;
  if new.mode <> old.mode and taken > 0 then raise exception 'mode_locked'; end if;
  new.updated_at := now();
  return new;
end $$;

create trigger activities_guard before update or delete on public.activities
for each row execute function public.activities_guard();

-- ---------- Ambassadors ----------
alter table public.profiles
  add column is_ambassador    boolean not null default false,
  add column ambassador_since timestamptz,
  add column referral_code    text unique,
  add column referred_by      uuid references public.profiles(id) on delete set null;
create index profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

create table public.ambassador_applications (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.profiles(id) on delete cascade,
  motivation    text not null,
  experience    text,
  social        text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note    text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create unique index ambassador_applications_pending_idx on public.ambassador_applications (member_id) where status = 'pending';

create or replace function public.is_ambassador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'member'
                   and p.is_ambassador and public.membership_status(p) = 'active');
$$;

-- Sign-up through an ambassador's link (?ref=CODE) records who invited the new member.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  joined timestamptz := coalesce(nullif(meta->>'joined_at', '')::timestamptz, now());
  days int := coalesce((select new_member_days from public.app_settings where id = 1), 365);
  ref uuid := (select id from public.profiles
                where referral_code = upper(nullif(trim(meta->>'ref'), '')) and is_ambassador);
begin
  insert into public.profiles (id, email, full_name, university, study_year, district, phone, notes,
                               joined_at, expires_at, is_trial, referred_by)
  values (new.id, new.email,
    coalesce(meta->>'full_name', ''), coalesce(meta->>'university', ''),
    coalesce(meta->>'study_year', ''), coalesce(meta->>'district', ''),
    coalesce(meta->>'phone', ''), nullif(meta->>'notes', ''),
    joined, coalesce(nullif(meta->>'expires_at', '')::timestamptz, joined + make_interval(days => days)),
    coalesce(nullif(meta->>'trial', '')::boolean, true), ref);
  return new;
end $$;

-- Members can't grant themselves the ambassador flag or change who referred them.
create or replace function public.protect_profile_columns() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.id               := old.id;
    new.member_no        := old.member_no;
    new.member_code      := old.member_code;
    new.email            := old.email;
    new.role             := old.role;
    new.is_active        := old.is_active;
    new.is_trial         := old.is_trial;
    new.joined_at        := old.joined_at;
    new.expires_at       := old.expires_at;
    new.created_at       := old.created_at;
    new.photo_url        := old.photo_url;
    new.is_ambassador    := old.is_ambassador;
    new.ambassador_since := old.ambassador_since;
    new.referral_code    := old.referral_code;
    new.referred_by      := old.referred_by;
  end if;
  return new;
end $$;

-- ---------- RLS ----------
alter table public.activities              enable row level security;
alter table public.activity_registrations  enable row level security;
alter table public.activity_participants   enable row level security;
alter table public.ambassador_applications enable row level security;

-- Members and ambassadors go through the security definer functions below.
create policy "admin: all" on public.activities              for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.activity_registrations  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.activity_participants   for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.ambassador_applications for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Email helpers ----------
create or replace function public.activity_vars(a public.activities) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('activity_id', a.id, 'activity_title', a.title, 'activity_at', a.starts_at,
                            'activity_location', coalesce(nullif(a.location, ''), '—'));
$$;

create or replace function public.queue_member_email(p_kind text, p_member_ids uuid[], p_vars jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select p_kind, p.id, p.email, p.full_name, p_vars from public.profiles p where p.id = any(p_member_ids);
$$;

create or replace function public.queue_admin_email(p_kind text, p_vars jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.email_queue (kind, to_email, to_name, vars)
  select p_kind, s.notify_email, 'إدارة دسمان', p_vars
    from public.app_settings s where s.id = 1 and trim(s.notify_email) <> '';
$$;

-- ---------- Member: activities ----------
create or replace function public.list_activities()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.starts_at), '[]'::json) from (
    select a.id, a.title, a.description, a.image_url, a.category, a.location, a.starts_at, a.ends_at,
           a.registration_closes_at, a.mode, a.capacity, a.team_min, a.team_max,
           t.taken, public.activity_state(a, t.taken) as state,
           mine.registration_id, mine.is_captain, mine.team_name, mine.captain_name, mine.checked_in_at, mine.team
      from public.activities a
      cross join lateral (select public.activity_taken(a.id) as taken) t
      left join lateral (
        select p.registration_id, p.is_captain, p.checked_in_at, r.team_name, cap.full_name as captain_name,
               (select json_agg(json_build_object('member_no', public.member_label(m.member_no), 'name', m.full_name,
                                                  'is_captain', p2.is_captain) order by p2.is_captain desc, p2.added_at)
                  from public.activity_participants p2 join public.profiles m on m.id = p2.member_id
                 where p2.registration_id = p.registration_id) as team
          from public.activity_participants p
          join public.activity_registrations r on r.id = p.registration_id
          left join public.profiles cap on cap.id = r.captain_id
         where p.activity_id = a.id and p.member_id = auth.uid()) mine on true
     where a.status <> 'draft'
       and (a.status <> 'cancelled' or mine.registration_id is not null)
       and coalesce(a.ends_at, a.starts_at) > now() - interval '60 days'
  ) x
  where exists (select 1 from public.profiles where id = auth.uid() and role = 'member');
$$;

-- Teammate lookup by membership number (shown on the member's card), before submitting a team.
create or replace function public.find_teammate(p_activity_id uuid, p_member_no text)
returns json language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; m public.profiles; digits text := regexp_replace(coalesce(p_member_no, ''), '\D', '', 'g');
begin
  select * into me from public.profiles where id = auth.uid() and role = 'member';
  if not found or public.membership_status(me) <> 'active' then
    return json_build_object('ok', false, 'error', 'membership_inactive'); end if;
  if digits = '' or length(digits) > 6 then return json_build_object('ok', false, 'error', 'not_found'); end if;
  select * into m from public.profiles where member_no = digits::int and role = 'member';
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if m.id = me.id then return json_build_object('ok', false, 'error', 'self'); end if;
  if public.membership_status(m) <> 'active' then
    return json_build_object('ok', false, 'error', 'member_inactive', 'member_no', public.member_label(m.member_no)); end if;
  if exists (select 1 from public.activity_participants where activity_id = p_activity_id and member_id = m.id) then
    return json_build_object('ok', false, 'error', 'already_registered', 'member_no', public.member_label(m.member_no)); end if;
  return json_build_object('ok', true, 'member_no', public.member_label(m.member_no),
    'name', trim(split_part(m.full_name, ' ', 1) || ' ' || split_part(m.full_name, ' ', 2)));
end $$;

-- Validates a team's member numbers for an activity. Returns the teammate ids, or an error object.
create or replace function public.resolve_team(a public.activities, me public.profiles, p_member_nos text[], p_registration_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare nums int[]; missing int[]; ids uuid[]; bad json; size int;
begin
  select coalesce(array_agg(distinct d::int), '{}') into nums
    from (select regexp_replace(x, '\D', '', 'g') as d from unnest(coalesce(p_member_nos, '{}')) x) s
   where d <> '' and length(d) <= 6;
  nums := array_remove(nums, me.member_no);

  select coalesce(array_agg(n), '{}') into missing from unnest(nums) n
   where not exists (select 1 from public.profiles where member_no = n and role = 'member');
  if cardinality(missing) > 0 then
    return json_build_object('ok', false, 'error', 'member_not_found',
      'members', (select json_agg(public.member_label(n)) from unnest(missing) n)); end if;

  select coalesce(array_agg(id), '{}') into ids from public.profiles where member_no = any(nums) and role = 'member';

  select json_agg(public.member_label(p.member_no)) into bad from public.profiles p
   where p.id = any(ids) and public.membership_status(p) <> 'active';
  if bad is not null then return json_build_object('ok', false, 'error', 'member_inactive', 'members', bad); end if;

  select json_agg(public.member_label(p.member_no)) into bad from public.profiles p
    join public.activity_participants ap on ap.member_id = p.id and ap.activity_id = a.id
   where p.id = any(ids) and ap.registration_id is distinct from p_registration_id;
  if bad is not null then return json_build_object('ok', false, 'error', 'member_already_registered', 'members', bad); end if;

  size := 1 + cardinality(ids);
  if size < a.team_min or size > a.team_max then
    return json_build_object('ok', false, 'error', 'team_size', 'min', a.team_min, 'max', a.team_max); end if;
  return json_build_object('ok', true, 'ids', to_json(ids));
end $$;

create or replace function public.register_activity(p_activity_id uuid, p_team_name text default null, p_member_nos text[] default '{}')
returns json language plpgsql security definer set search_path = public as $$
declare
  me public.profiles; a public.activities; taken int; st text; team json;
  mates uuid[] := '{}'; reg_id uuid; tname text := nullif(trim(regexp_replace(coalesce(p_team_name, ''), '\s+', ' ', 'g')), '');
begin
  select * into me from public.profiles where id = auth.uid() and role = 'member';
  if not found or public.membership_status(me) <> 'active' then
    return json_build_object('ok', false, 'error', 'membership_inactive'); end if;

  -- Row lock: sign-ups for one activity run one at a time, so the last seat goes to exactly one person.
  select * into a from public.activities where id = p_activity_id for update;
  if not found or a.status = 'draft' then return json_build_object('ok', false, 'error', 'not_found'); end if;
  taken := public.activity_taken(a.id);
  st := public.activity_state(a, taken);
  if st = 'full' then return json_build_object('ok', false, 'error', 'full'); end if;
  if st <> 'open' then return json_build_object('ok', false, 'error', 'closed'); end if;
  if exists (select 1 from public.activity_participants where activity_id = a.id and member_id = me.id) then
    return json_build_object('ok', false, 'error', 'already_registered'); end if;

  if a.mode = 'team' then
    if tname is null or length(tname) < 2 or length(tname) > 40 then
      return json_build_object('ok', false, 'error', 'team_name_required'); end if;
    if exists (select 1 from public.activity_registrations where activity_id = a.id and status = 'registered'
                 and lower(team_name) = lower(tname)) then
      return json_build_object('ok', false, 'error', 'team_name_taken'); end if;
    team := public.resolve_team(a, me, p_member_nos, null);
    if not (team->>'ok')::boolean then return team; end if;
    select coalesce(array_agg(x::uuid), '{}') into mates from json_array_elements_text(team->'ids') x;
  else
    tname := null;
  end if;

  insert into public.activity_registrations (activity_id, captain_id, team_name) values (a.id, me.id, tname)
  returning id into reg_id;
  insert into public.activity_participants (activity_id, member_id, registration_id, is_captain)
  values (a.id, me.id, reg_id, true);
  insert into public.activity_participants (activity_id, member_id, registration_id)
  select a.id, x, reg_id from unnest(mates) x;

  perform public.queue_member_email('activity_registered', array[me.id],
    public.activity_vars(a) || jsonb_build_object('team_name', coalesce(tname, ''), 'team_size', (1 + cardinality(mates))::text));
  if cardinality(mates) > 0 then
    perform public.queue_member_email('activity_team_added', mates,
      public.activity_vars(a) || jsonb_build_object('team_name', tname, 'captain_name', me.full_name));
  end if;
  perform public.queue_admin_email('admin_activity_registration', public.activity_vars(a) || jsonb_build_object(
    'member_name', me.full_name, 'member_no', public.member_label(me.member_no),
    'team_name', coalesce(tname, '—'), 'team_size', (1 + cardinality(mates))::text,
    'seats_taken', (taken + 1)::text, 'seats_total', a.capacity::text,
    'seats_left', (a.capacity - taken - 1)::text));

  return json_build_object('ok', true, 'registration_id', reg_id, 'seats_left', a.capacity - taken - 1);
end $$;

-- Captain changes the teammates while registration is still open.
create or replace function public.update_team(p_registration_id uuid, p_member_nos text[])
returns json language plpgsql security definer set search_path = public as $$
declare me public.profiles; r public.activity_registrations; a public.activities; st text; team json; mates uuid[]; removed uuid[]; added uuid[];
begin
  select * into me from public.profiles where id = auth.uid() and role = 'member';
  if not found or public.membership_status(me) <> 'active' then
    return json_build_object('ok', false, 'error', 'membership_inactive'); end if;
  select * into r from public.activity_registrations where id = p_registration_id;
  if not found or r.captain_id is distinct from me.id or r.status <> 'registered' then
    return json_build_object('ok', false, 'error', 'not_found'); end if;
  select * into a from public.activities where id = r.activity_id for update;
  st := public.activity_state(a, public.activity_taken(a.id));
  if a.mode <> 'team' or st not in ('open', 'full') then return json_build_object('ok', false, 'error', 'closed'); end if;

  team := public.resolve_team(a, me, p_member_nos, r.id);
  if not (team->>'ok')::boolean then return team; end if;
  select coalesce(array_agg(x::uuid), '{}') into mates from json_array_elements_text(team->'ids') x;

  select coalesce(array_agg(member_id), '{}') into removed from public.activity_participants
   where registration_id = r.id and not is_captain and member_id <> all(mates);
  select coalesce(array_agg(x), '{}') into added from unnest(mates) x
   where not exists (select 1 from public.activity_participants where registration_id = r.id and member_id = x);

  delete from public.activity_participants where registration_id = r.id and member_id = any(removed);
  insert into public.activity_participants (activity_id, member_id, registration_id)
  select a.id, x, r.id from unnest(added) x;

  if cardinality(removed) > 0 then
    perform public.queue_member_email('registration_cancelled', removed,
      public.activity_vars(a) || jsonb_build_object('team_name', r.team_name));
  end if;
  if cardinality(added) > 0 then
    perform public.queue_member_email('activity_team_added', added,
      public.activity_vars(a) || jsonb_build_object('team_name', r.team_name, 'captain_name', me.full_name));
  end if;
  return json_build_object('ok', true);
end $$;

-- Individual or captain: cancels the seat (whole team). Teammate: leaves the team, the seat stays.
create or replace function public.leave_activity(p_registration_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare part public.activity_participants; r public.activity_registrations; a public.activities; others uuid[];
begin
  select * into part from public.activity_participants where registration_id = p_registration_id and member_id = auth.uid();
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  select * into a from public.activities where id = part.activity_id for update;
  if a.starts_at <= now() then return json_build_object('ok', false, 'error', 'too_late'); end if;

  if not part.is_captain then
    delete from public.activity_participants where activity_id = part.activity_id and member_id = part.member_id;
    return json_build_object('ok', true, 'left', 'team');
  end if;

  select * into r from public.activity_registrations where id = p_registration_id for update;
  select coalesce(array_agg(member_id), '{}') into others from public.activity_participants
   where registration_id = r.id and member_id <> auth.uid();
  update public.activity_registrations set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid() where id = r.id;
  delete from public.activity_participants where registration_id = r.id;
  if cardinality(others) > 0 then
    perform public.queue_member_email('registration_cancelled', others,
      public.activity_vars(a) || jsonb_build_object('team_name', coalesce(r.team_name, '')));
  end if;
  return json_build_object('ok', true, 'left', 'seat');
end $$;

-- ---------- Check-in (admin, or an active ambassador around the activity date) ----------
create or replace function public.checkin_activities()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.starts_at), '[]'::json) from (
    select a.id, a.title, a.image_url, a.location, a.starts_at, a.ends_at, a.mode, public.checkin_open(a) as checkin_open,
           (select count(*) from public.activity_participants p where p.activity_id = a.id)::int as participants,
           (select count(*) from public.activity_participants p where p.activity_id = a.id and p.checked_in_at is not null)::int as checked_in
      from public.activities a
     where a.status in ('published', 'closed')
       and coalesce(a.ends_at, a.starts_at) > now() - interval '1 day'
       and a.starts_at < now() + interval '14 days'
  ) x
  where public.is_admin() or public.is_ambassador();
$$;

create or replace function public.checkin_roster(p_activity_id uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare a public.activities;
begin
  if not (public.is_admin() or public.is_ambassador()) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into a from public.activities where id = p_activity_id;
  if not found or a.status not in ('published', 'closed')
     or coalesce(a.ends_at, a.starts_at) <= now() - interval '1 day' or a.starts_at >= now() + interval '14 days' then
    return json_build_object('ok', false, 'error', 'not_found'); end if;
  return json_build_object('ok', true, 'checkin_open', public.checkin_open(a),
    'activity', json_build_object('id', a.id, 'title', a.title, 'starts_at', a.starts_at, 'location', a.location, 'mode', a.mode),
    'participants', coalesce((
      select json_agg(json_build_object('member_id', m.id, 'name', m.full_name, 'member_no', public.member_label(m.member_no),
               'university', m.university, 'team_name', r.team_name, 'is_captain', p.is_captain,
               'checked_in_at', p.checked_in_at)
             order by r.team_name nulls last, r.created_at, p.is_captain desc, m.full_name)
        from public.activity_participants p
        join public.profiles m on m.id = p.member_id
        join public.activity_registrations r on r.id = p.registration_id
       where p.activity_id = a.id), '[]'::json));
end $$;

create or replace function public.set_checkin(p_activity_id uuid, p_member_id uuid, p_checked boolean)
returns json language plpgsql security definer set search_path = public as $$
declare a public.activities; checked timestamptz;
begin
  if not (public.is_admin() or public.is_ambassador()) then return json_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into a from public.activities where id = p_activity_id;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if not public.is_admin() and not public.checkin_open(a) then return json_build_object('ok', false, 'error', 'checkin_closed'); end if;
  update public.activity_participants
     set checked_in_at = case when p_checked then coalesce(checked_in_at, now()) end,
         checked_in_by = case when p_checked then coalesce(checked_in_by, auth.uid()) end
   where activity_id = a.id and member_id = p_member_id
  returning checked_in_at into checked;
  if not found then return json_build_object('ok', false, 'error', 'not_registered'); end if;
  return json_build_object('ok', true, 'checked_in_at', checked);
end $$;

-- The scan page, opened by an ambassador's or admin's camera: this member's activities to check in.
create or replace function public.member_checkins(p_member_code text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('activity_id', a.id, 'member_id', m.id, 'title', a.title, 'starts_at', a.starts_at,
           'team_name', r.team_name, 'checked_in_at', p.checked_in_at) order by a.starts_at), '[]'::json)
    from public.profiles m
    join public.activity_participants p on p.member_id = m.id
    join public.activity_registrations r on r.id = p.registration_id
    join public.activities a on a.id = p.activity_id
   where m.member_code = p_member_code and m.role = 'member' and public.checkin_open(a)
     and (public.is_admin() or public.is_ambassador());
$$;

-- ---------- Member: ambassador programme ----------
create or replace function public.apply_ambassador(p_motivation text, p_experience text default null, p_social text default null)
returns json language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid() and role = 'member';
  if not found or public.membership_status(me) <> 'active' then
    return json_build_object('ok', false, 'error', 'membership_inactive'); end if;
  if me.is_ambassador then return json_build_object('ok', false, 'error', 'already_ambassador'); end if;
  if exists (select 1 from public.ambassador_applications where member_id = me.id and status = 'pending') then
    return json_build_object('ok', false, 'error', 'pending_exists'); end if;
  if length(trim(coalesce(p_motivation, ''))) < 20 then return json_build_object('ok', false, 'error', 'too_short'); end if;

  insert into public.ambassador_applications (member_id, motivation, experience, social)
  values (me.id, left(trim(p_motivation), 1500), nullif(left(trim(coalesce(p_experience, '')), 1500), ''),
          nullif(left(trim(coalesce(p_social, '')), 200), ''));
  perform public.queue_admin_email('ambassador_request', jsonb_build_object(
    'member_name', me.full_name, 'member_no', public.member_label(me.member_no),
    'university', me.university, 'motivation', left(trim(p_motivation), 600)));
  return json_build_object('ok', true);
end $$;

create or replace function public.my_ambassador()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_ambassador', me.is_ambassador,
    'since', me.ambassador_since,
    'referral_code', case when me.is_ambassador then me.referral_code end,
    'application', (select json_build_object('status', x.status, 'created_at', x.created_at,
                                             'reviewed_at', x.reviewed_at, 'admin_note', x.admin_note)
                      from public.ambassador_applications x where x.member_id = me.id order by x.created_at desc limit 1),
    'stats', case when me.is_ambassador then (
      select json_build_object('total', count(*), 'active', count(*) filter (where public.membership_status(r) = 'active'),
                               'month', count(*) filter (where r.joined_at >= now() - interval '30 days'))
        from public.profiles r where r.referred_by = me.id) end,
    'referrals', case when me.is_ambassador then coalesce((
      select json_agg(json_build_object('name', r.full_name, 'university', r.university, 'joined_at', r.joined_at,
                                        'status', public.membership_status(r), 'is_trial', r.is_trial) order by r.joined_at desc)
        from public.profiles r where r.referred_by = me.id), '[]'::json) end)
  from public.profiles me where me.id = auth.uid() and me.role = 'member';
$$;

-- ---------- Admin ----------
create or replace function public.admin_cancel_activity(p_activity_id uuid, p_notify boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare a public.activities; ids uuid[];
begin
  perform public.assert_admin();
  update public.activities set status = 'cancelled' where id = p_activity_id and status <> 'cancelled' returning * into a;
  if not found then raise exception 'not_found'; end if;
  if p_notify and coalesce(a.ends_at, a.starts_at) > now() then
    select coalesce(array_agg(member_id), '{}') into ids from public.activity_participants where activity_id = a.id;
    perform public.queue_member_email('activity_cancelled', ids, public.activity_vars(a));
  end if;
end $$;

create or replace function public.admin_cancel_registration(p_registration_id uuid, p_notify boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare r public.activity_registrations; a public.activities; ids uuid[];
begin
  perform public.assert_admin();
  select * into r from public.activity_registrations where id = p_registration_id and status = 'registered' for update;
  if not found then raise exception 'not_found'; end if;
  select * into a from public.activities where id = r.activity_id for update;
  select coalesce(array_agg(member_id), '{}') into ids from public.activity_participants where registration_id = r.id;
  update public.activity_registrations set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid() where id = r.id;
  delete from public.activity_participants where registration_id = r.id;
  if p_notify then
    perform public.queue_member_email('registration_cancelled', ids,
      public.activity_vars(a) || jsonb_build_object('team_name', coalesce(r.team_name, '')));
  end if;
end $$;

create or replace function public.grant_ambassador(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if exists (select 1 from public.profiles where id = p_member_id and is_ambassador) then return; end if;
  loop
    code := upper(public.gen_code(6));
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  update public.profiles set is_ambassador = true, ambassador_since = now(), referral_code = coalesce(referral_code, code)
   where id = p_member_id and role = 'member';
  if not found then raise exception 'not_found'; end if;
  perform public.queue_member_email('ambassador_approved', array[p_member_id],
    jsonb_build_object('referral_code', (select referral_code from public.profiles where id = p_member_id)));
end $$;

create or replace function public.admin_review_ambassador(p_application_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare app public.ambassador_applications;
begin
  perform public.assert_admin();
  select * into app from public.ambassador_applications where id = p_application_id and status = 'pending' for update;
  if not found then raise exception 'not_found'; end if;
  update public.ambassador_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(trim(coalesce(p_note, '')), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = app.id;
  if p_approve then
    perform public.grant_ambassador(app.member_id);
  else
    perform public.queue_member_email('ambassador_rejected', array[app.member_id],
      jsonb_build_object('admin_note', coalesce(nullif(trim(coalesce(p_note, '')), ''), '')));
  end if;
end $$;

-- Grant without an application, or take the role back (the referral code and history are kept).
create or replace function public.admin_set_ambassador(p_member_id uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if p_on then
    perform public.grant_ambassador(p_member_id);
    update public.ambassador_applications set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where member_id = p_member_id and status = 'pending';
  else
    update public.profiles set is_ambassador = false where id = p_member_id;
  end if;
end $$;

create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  perform public.assert_admin();
  select json_build_object(
    'members_total',   (select count(*) from public.profiles where role = 'member'),
    'new_week',        (select count(*) from public.profiles where role = 'member' and joined_at >= now() - interval '7 days'),
    'new_month',       (select count(*) from public.profiles where role = 'member' and joined_at >= now() - interval '30 days'),
    'active',          (select count(*) from public.profiles p where role = 'member' and public.membership_status(p) = 'active'),
    'expired',         (select count(*) from public.profiles p where role = 'member' and public.membership_status(p) = 'expired'),
    'suspended',       (select count(*) from public.profiles p where role = 'member' and public.membership_status(p) = 'suspended'),
    'coupons_assigned',(select count(*) from public.coupons where status in ('assigned', 'redeemed')),
    'coupons_redeemed',(select count(*) from public.coupons where status = 'redeemed'),
    'emails_pending',  (select count(*) from public.email_queue where status = 'pending'),
    'activities_upcoming', (select count(*) from public.activities where status in ('published', 'closed') and starts_at > now()),
    'ambassadors',     (select count(*) from public.profiles where role = 'member' and is_ambassador),
    'ambassador_pending', (select count(*) from public.ambassador_applications where status = 'pending')
  ) into result;
  return result;
end $$;

-- ---------- Scheduled: reminder the day before an activity (Riyadh dates) ----------
create or replace function public.queue_activity_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select 'activity_reminder', m.id, m.email, m.full_name, public.activity_vars(a) || jsonb_build_object('team_name', coalesce(r.team_name, ''))
    from public.activities a
    join public.activity_participants p on p.activity_id = a.id
    join public.activity_registrations r on r.id = p.registration_id
    join public.profiles m on m.id = p.member_id
   where a.status in ('published', 'closed')
     and (a.starts_at at time zone 'Asia/Riyadh')::date = (now() at time zone 'Asia/Riyadh')::date + 1
     and not exists (select 1 from public.email_queue q where q.member_id = m.id and q.kind = 'activity_reminder'
                       and q.vars->>'activity_id' = a.id::text);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- My coupons: with the batch image ----------
create or replace function public.my_coupons()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', c.id, 'code', c.code, 'title', b.title, 'value', b.value_sar, 'partner', p.name, 'image_url', b.image_url,
      'expires_at', b.expires_at, 'assigned_at', c.assigned_at, 'redeemed_at', c.redeemed_at,
      'state', case
        when c.status = 'redeemed' then 'used'
        when b.expires_at is not null and b.expires_at <= now() then 'expired'
        else 'available' end)
    order by c.assigned_at desc), '[]'::json)
  from public.coupons c
  join public.coupon_batches b on b.id = c.batch_id
  join public.partners p on p.id = b.partner_id
  where c.member_id = auth.uid() and c.status in ('assigned', 'redeemed');
$$;

-- ---------- Admin views ----------
-- Views expand * at creation time: rebuild the ones over tables that gained columns.
drop view public.admin_members;
create view public.admin_members with (security_invoker = on) as
select p.*,
       public.membership_status(p) as status,
       'DSM-' || lpad(p.member_no::text, 4, '0') as member_label,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'assigned')::int as coupons_available,
       (select count(*) from public.coupons c where c.member_id = p.id and c.status = 'redeemed')::int as coupons_redeemed,
       ref.full_name as referred_by_name,
       (select count(*) from public.profiles x where x.referred_by = p.id)::int as referrals
from public.profiles p
left join public.profiles ref on ref.id = p.referred_by;

drop view public.admin_batches;
create view public.admin_batches with (security_invoker = on) as
select b.*, pt.name as partner_name,
       count(c.*) filter (where c.status = 'available')::int as remaining,
       count(c.*) filter (where c.status = 'assigned')::int  as assigned,
       count(c.*) filter (where c.status = 'redeemed')::int  as redeemed
from public.coupon_batches b
join public.partners pt on pt.id = b.partner_id
left join public.coupons c on c.batch_id = b.id
group by b.id, pt.name;

create view public.admin_activities with (security_invoker = on) as
select a.*, t.taken, public.activity_state(a, t.taken) as state,
       (select count(*) from public.activity_participants p where p.activity_id = a.id)::int as participants,
       (select count(*) from public.activity_participants p where p.activity_id = a.id and p.checked_in_at is not null)::int as checked_in,
       (select count(*) from public.activity_registrations r where r.activity_id = a.id and r.status = 'cancelled')::int as cancelled
from public.activities a
cross join lateral (select count(*)::int as taken from public.activity_registrations r
                     where r.activity_id = a.id and r.status = 'registered') t;

create view public.admin_activity_roster with (security_invoker = on) as
select p.activity_id, p.registration_id, p.member_id, p.is_captain, p.added_at, p.checked_in_at,
       r.team_name, r.created_at as registered_at,
       m.full_name, 'DSM-' || lpad(m.member_no::text, 4, '0') as member_label, m.email, m.phone, m.university,
       public.membership_status(m) as member_status,
       ci.full_name as checked_in_by_name
from public.activity_participants p
join public.activity_registrations r on r.id = p.registration_id
join public.profiles m on m.id = p.member_id
left join public.profiles ci on ci.id = p.checked_in_by;

create view public.admin_ambassador_applications with (security_invoker = on) as
select x.*, m.full_name, 'DSM-' || lpad(m.member_no::text, 4, '0') as member_label, m.email, m.phone,
       m.university, m.study_year, m.is_ambassador, public.membership_status(m) as member_status,
       rv.full_name as reviewed_by_name
from public.ambassador_applications x
join public.profiles m on m.id = x.member_id
left join public.profiles rv on rv.id = x.reviewed_by;

revoke all on public.admin_members, public.admin_batches, public.admin_activities, public.admin_activity_roster,
              public.admin_ambassador_applications from anon;

-- ---------- Email templates ----------
-- Placeholders added: {{activity_title}} {{activity_date}} {{activity_location}} {{team_name}} {{team_size}}
-- {{captain_name}} {{activities_url}} {{member_name}} {{seats_taken}} {{seats_total}} {{seats_left}}
-- {{university}} {{motivation}} {{referral_code}} {{referral_url}} {{ambassador_url}} {{admin_url}} {{admin_note}}
insert into public.email_templates (kind, label, subject, body_html) values
('activity_registered', 'تأكيد التسجيل في نشاط', 'تم تسجيلك في {{activity_title}}',
 '<p>أهلًا {{name}}،</p>
<p>تم تأكيد تسجيلك في <strong>{{activity_title}}</strong>.</p>
<p>الموعد: <strong>{{activity_date}}</strong><br>المكان: <strong>{{activity_location}}</strong></p>
<p>{{team_line}}</p>
<p>احضر في الموعد واعرض بطاقتك الرقمية عند الدخول لتسجيل حضورك.</p>
<p><a class="btn" href="{{activities_url}}">عرض أنشطتي</a></p>'),
('activity_team_added', 'إضافة لفريق في نشاط', 'أضافك {{captain_name}} إلى فريق {{team_name}}',
 '<p>أهلًا {{name}}،</p>
<p>أضافك <strong>{{captain_name}}</strong> إلى فريق <strong>{{team_name}}</strong> في <strong>{{activity_title}}</strong>.</p>
<p>الموعد: <strong>{{activity_date}}</strong><br>المكان: <strong>{{activity_location}}</strong></p>
<p>إن لم تكن ترغب في المشاركة، يمكنك الانسحاب من الفريق من صفحة الأنشطة.</p>
<p><a class="btn" href="{{activities_url}}">عرض أنشطتي</a></p>'),
('registration_cancelled', 'إلغاء تسجيل في نشاط', 'أُلغي تسجيلك في {{activity_title}}',
 '<p>أهلًا {{name}}،</p>
<p>أُلغي تسجيلك في <strong>{{activity_title}}</strong> المقرر في {{activity_date}}.</p>
<p>إن كان ذلك بالخطأ، يمكنك التسجيل من جديد ما دامت المقاعد متاحة.</p>
<p><a class="btn" href="{{activities_url}}">الأنشطة المتاحة</a></p>'),
('activity_cancelled', 'إلغاء نشاط', 'إلغاء {{activity_title}}',
 '<p>أهلًا {{name}}،</p>
<p>نعتذر منك، أُلغي نشاط <strong>{{activity_title}}</strong> الذي كان مقررًا في {{activity_date}}.</p>
<p>تابع صفحة الأنشطة لمعرفة الأنشطة القادمة.</p>
<p><a class="btn" href="{{activities_url}}">الأنشطة القادمة</a></p>'),
('activity_reminder', 'تذكير قبل النشاط بيوم', 'تذكير: {{activity_title}} غدًا',
 '<p>أهلًا {{name}}،</p>
<p>نذكّرك بأن <strong>{{activity_title}}</strong> غدًا.</p>
<p>الموعد: <strong>{{activity_date}}</strong><br>المكان: <strong>{{activity_location}}</strong></p>
<p>اعرض بطاقتك الرقمية عند الدخول لتسجيل حضورك. نراك هناك!</p>
<p><a class="btn" href="{{activities_url}}">تفاصيل النشاط</a></p>'),
('admin_activity_registration', 'للإدارة: تسجيل جديد في نشاط', 'تسجيل جديد في {{activity_title}} ({{seats_taken}}/{{seats_total}})',
 '<p>سجّل <strong>{{member_name}}</strong> ({{member_no}}) في <strong>{{activity_title}}</strong>.</p>
<p>الفريق: <strong>{{team_name}}</strong> · عدد الأشخاص: <strong>{{team_size}}</strong></p>
<p>المقاعد: <strong>{{seats_taken}} من {{seats_total}}</strong>، والمتبقي <strong>{{seats_left}}</strong>.</p>
<p><a class="btn" href="{{admin_url}}/activities">لوحة الأنشطة</a></p>'),
('ambassador_request', 'للإدارة: طلب سفير جديد', 'طلب جديد: {{member_name}} يريد أن يصبح سفيرًا',
 '<p>قدّم <strong>{{member_name}}</strong> ({{member_no}}) من <strong>{{university}}</strong> طلبًا ليصبح سفيرًا لدسمان.</p>
<p>لماذا يريد أن يكون سفيرًا:</p>
<p style="background:#f7f2e7;padding:12px 16px;border-radius:12px;">{{motivation}}</p>
<p><a class="btn" href="{{admin_url}}/ambassadors">مراجعة الطلب</a></p>'),
('ambassador_approved', 'قبول السفير', 'مبروك! أصبحت سفيرًا لدسمان',
 '<p>أهلًا {{name}}،</p>
<p>يسعدنا قبولك <strong>سفيرًا لدسمان</strong>.</p>
<p>شارك رابط الدعوة الخاص بك مع زملائك، وكل من يسجّل عن طريقه يُحسب لك:</p>
<p style="direction:ltr;text-align:center;font-weight:bold;">{{referral_url}}</p>
<p>ومن صفحة السفير تستطيع تسجيل حضور الأعضاء في الأنشطة.</p>
<p><a class="btn" href="{{ambassador_url}}">صفحة السفير</a></p>'),
('ambassador_rejected', 'الاعتذار عن طلب السفير', 'بخصوص طلبك لتكون سفيرًا لدسمان',
 '<p>أهلًا {{name}}،</p>
<p>شكرًا لاهتمامك ببرنامج سفراء دسمان. نعتذر عن عدم قبول طلبك هذه المرة.</p>
<p>{{admin_note}}</p>
<p>يمكنك التقديم مرة أخرى لاحقًا، وتبقى عضويتك ومزاياها كما هي.</p>');

-- ---------- Grants ----------
grant execute on function public.list_activities()                               to authenticated;
grant execute on function public.find_teammate(uuid, text)                       to authenticated;
grant execute on function public.register_activity(uuid, text, text[])           to authenticated;
grant execute on function public.update_team(uuid, text[])                       to authenticated;
grant execute on function public.leave_activity(uuid)                            to authenticated;
grant execute on function public.checkin_activities()                            to authenticated;
grant execute on function public.checkin_roster(uuid)                            to authenticated;
grant execute on function public.set_checkin(uuid, uuid, boolean)                to authenticated;
grant execute on function public.member_checkins(text)                           to authenticated;
grant execute on function public.apply_ambassador(text, text, text)              to authenticated;
grant execute on function public.my_ambassador()                                 to authenticated;
grant execute on function public.is_ambassador()                                 to authenticated;
grant execute on function public.admin_cancel_activity(uuid, boolean)            to authenticated;
grant execute on function public.admin_cancel_registration(uuid, boolean)        to authenticated;
grant execute on function public.admin_review_ambassador(uuid, boolean, text)    to authenticated;
grant execute on function public.admin_set_ambassador(uuid, boolean)             to authenticated;
grant execute on function public.my_coupons()                                    to authenticated;
grant execute on function public.admin_stats()                                   to authenticated;
-- Used inside views read by the admin (security_invoker).
grant execute on function public.activity_state(public.activities, int)          to authenticated;
grant execute on function public.member_label(int)                               to authenticated;
grant execute on function public.queue_activity_reminders()                      to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.activities_guard() from public, anon, authenticated;
revoke execute on function public.grant_ambassador(uuid) from public, anon, authenticated;
revoke execute on function public.resolve_team(public.activities, public.profiles, text[], uuid) from public, anon, authenticated;
revoke execute on function public.queue_member_email(text, uuid[], jsonb) from public, anon, authenticated;
revoke execute on function public.queue_admin_email(text, jsonb) from public, anon, authenticated;
revoke execute on function public.activity_taken(uuid) from public, anon, authenticated;
