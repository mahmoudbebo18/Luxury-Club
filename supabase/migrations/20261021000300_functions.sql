-- Public RPCs (counter, scan page, redemption), member RPCs and admin RPCs.

-- ---------- Public ----------
create or replace function public.public_member_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.profiles where role = 'member';
$$;

create or replace function public.get_member_card(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare m public.profiles; st text;
begin
  select * into m from public.profiles where member_code = p_code;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  st := public.membership_status(m);
  return json_build_object(
    'ok', true, 'status', st,
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

create or replace function public.redeem_coupon(
  p_member_code text, p_coupon_id uuid, p_pin text default null,
  p_device_token text default null, p_remember boolean default false)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  m public.profiles; c public.coupons; b public.coupon_batches; p public.partners; d public.partner_devices;
  new_token text; tries_left int; authorized boolean := false; redeemed_time timestamptz := now();
begin
  select * into m from public.profiles where member_code = p_member_code;
  if not found then return json_build_object('ok', false, 'error', 'invalid_member'); end if;
  if public.membership_status(m) <> 'active' then
    return json_build_object('ok', false, 'error', 'membership_inactive'); end if;

  -- Row lock: two cashiers pressing "redeem" together get exactly one success.
  select * into c from public.coupons where id = p_coupon_id and member_id = m.id for update;
  if not found then return json_build_object('ok', false, 'error', 'coupon_unavailable'); end if;
  if c.status = 'redeemed' then return json_build_object('ok', false, 'error', 'already_redeemed'); end if;
  if c.status <> 'assigned' then return json_build_object('ok', false, 'error', 'coupon_unavailable'); end if;

  select * into b from public.coupon_batches where id = c.batch_id;
  if b.expires_at is not null and b.expires_at <= now() then
    return json_build_object('ok', false, 'error', 'coupon_expired'); end if;

  select * into p from public.partners where id = b.partner_id for update;
  if not p.is_active then return json_build_object('ok', false, 'error', 'partner_inactive'); end if;

  -- 1) Remembered device?
  if p_device_token is not null and p_device_token <> '' then
    select * into d from public.partner_devices
     where token_hash = encode(digest(p_device_token, 'sha256'), 'hex') and expires_at > now();
    if found then
      if d.partner_id <> p.id then
        return json_build_object('ok', false, 'error', 'wrong_partner', 'partner', p.name); end if;
      authorized := (d.pin_version = p.pin_version);
    end if;
  end if;

  -- 2) PIN
  if not authorized then
    if p.locked_until is not null and p.locked_until > now() then
      return json_build_object('ok', false, 'error', 'locked', 'until', p.locked_until); end if;
    if p_pin is null or p_pin = '' then
      return json_build_object('ok', false, 'error', 'pin_required', 'partner', p.name); end if;
    if p.pin_hash <> crypt(p_pin, p.pin_hash) then
      update public.partners set
        locked_until = case when failed_tries + 1 >= 5 then now() + interval '15 minutes' end,
        failed_tries = case when failed_tries + 1 >= 5 then 0 else failed_tries + 1 end
      where id = p.id
      returning case when locked_until is not null then 0 else 5 - failed_tries end into tries_left;
      if tries_left = 0 then
        return json_build_object('ok', false, 'error', 'locked', 'until', now() + interval '15 minutes'); end if;
      return json_build_object('ok', false, 'error', 'wrong_pin', 'tries_left', tries_left);
    end if;
    update public.partners set failed_tries = 0, locked_until = null where id = p.id;
    if p_remember then
      new_token := public.gen_code(32);
      insert into public.partner_devices (token_hash, partner_id, pin_version, expires_at)
      values (encode(digest(new_token, 'sha256'), 'hex'), p.id, p.pin_version, now() + interval '12 hours');
    end if;
  end if;

  -- 3) Redeem
  update public.coupons set status = 'redeemed', redeemed_at = redeemed_time where id = c.id;
  insert into public.redemptions (coupon_id, partner_id, member_id, redeemed_at)
  values (c.id, p.id, m.id, redeemed_time);
  delete from public.partner_devices where expires_at < now();
  return json_build_object('ok', true, 'partner', p.name, 'value', b.value_sar, 'title', b.title,
                           'member', m.full_name, 'at', redeemed_time, 'device_token', new_token);
end $$;

-- ---------- Member ----------
create or replace function public.my_coupons()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', c.id, 'code', c.code, 'title', b.title, 'value', b.value_sar, 'partner', p.name,
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

-- ---------- Admin ----------
create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_create_partner(p_name text, p_pin text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid;
begin
  perform public.assert_admin();
  if p_pin !~ '^\d{4,8}$' then raise exception 'pin_format'; end if;
  insert into public.partners (name, pin_hash) values (trim(p_name), crypt(p_pin, gen_salt('bf')))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.admin_update_partner(p_id uuid, p_name text, p_is_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.partners set name = trim(p_name), is_active = p_is_active where id = p_id;
end $$;

create or replace function public.admin_set_partner_pin(p_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  if p_pin !~ '^\d{4,8}$' then raise exception 'pin_format'; end if;
  update public.partners
     set pin_hash = crypt(p_pin, gen_salt('bf')), pin_version = pin_version + 1,
         failed_tries = 0, locked_until = null
   where id = p_id;
  delete from public.partner_devices where partner_id = p_id;
end $$;

create or replace function public.admin_create_batch(
  p_partner_id uuid, p_title text, p_value numeric, p_quantity int, p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform public.assert_admin();
  insert into public.coupon_batches (partner_id, title, value_sar, quantity, expires_at)
  values (p_partner_id, trim(p_title), p_value, p_quantity, p_expires_at)
  returning id into new_id;
  insert into public.coupons (batch_id) select new_id from generate_series(1, p_quantity);
  return new_id;
end $$;

create or replace function public.admin_assign_coupons(p_batch_id uuid, p_member_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  members uuid[];
  remaining int;
  b public.coupon_batches;
  partner_name text;
begin
  perform public.assert_admin();
  select array_agg(distinct x) into members from unnest(p_member_ids) x;
  if members is null then return 0; end if;

  select * into b from public.coupon_batches where id = p_batch_id for update;
  if not found then raise exception 'batch_not_found'; end if;
  if b.expires_at is not null and b.expires_at <= now() then raise exception 'batch_expired'; end if;
  select name into partner_name from public.partners where id = b.partner_id;

  select count(*) into remaining from public.coupons where batch_id = p_batch_id and status = 'available';
  if remaining < array_length(members, 1) then
    raise exception 'not_enough_coupons' using detail = remaining::text;
  end if;

  with picked as (
    select id, row_number() over () as rn from public.coupons
     where batch_id = p_batch_id and status = 'available' limit array_length(members, 1)
  ), targets as (
    select m, row_number() over () as rn from unnest(members) m
  )
  update public.coupons c set member_id = t.m, status = 'assigned', assigned_at = now()
    from picked pk join targets t using (rn)
   where c.id = pk.id;

  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select 'coupon', p.id, p.email, p.full_name,
         jsonb_build_object('coupon_title', b.title, 'coupon_value', b.value_sar::text,
                            'partner', partner_name,
                            'coupon_expires', coalesce(to_char(b.expires_at at time zone 'Asia/Riyadh', 'YYYY-MM-DD'), ''))
    from public.profiles p where p.id = any(members);

  return array_length(members, 1);
end $$;

create or replace function public.admin_void_redemption(p_redemption_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.redemptions;
begin
  perform public.assert_admin();
  select * into r from public.redemptions where id = p_redemption_id for update;
  if not found or r.voided_at is not null then raise exception 'not_voidable'; end if;
  update public.redemptions set voided_at = now(), voided_by = auth.uid() where id = r.id;
  update public.coupons set status = 'assigned', redeemed_at = null where id = r.coupon_id;
end $$;

create or replace function public.admin_renew_membership(p_member_id uuid)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare new_expiry timestamptz;
begin
  perform public.assert_admin();
  update public.profiles set expires_at = greatest(expires_at, now()) + interval '1 year'
   where id = p_member_id returning expires_at into new_expiry;
  return new_expiry;
end $$;

create or replace function public.admin_set_active(p_member_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.profiles set is_active = p_active where id = p_member_id;
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
    'emails_pending',  (select count(*) from public.email_queue where status = 'pending')
  ) into result;
  return result;
end $$;

-- Campaign to explicit member ids; {{name}} etc. are filled per recipient by the mail worker.
create or replace function public.admin_create_campaign(
  p_subject text, p_body_html text, p_audience text, p_member_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; n int;
begin
  perform public.assert_admin();
  insert into public.email_campaigns (subject, body_html, audience, created_by)
  values (p_subject, p_body_html, p_audience, auth.uid()) returning id into cid;

  insert into public.email_queue (campaign_id, kind, member_id, to_email, to_name, subject, body_html)
  select cid, 'campaign', p.id, p.email, p.full_name, p_subject, p_body_html
    from public.profiles p where p.id = any(p_member_ids);
  get diagnostics n = row_count;

  update public.email_campaigns set total = n, status = case when n = 0 then 'done' else 'queued' end
   where id = cid;
  return cid;
end $$;

-- ---------- Scheduled (called by the mail worker with the service role) ----------
create or replace function public.queue_expiry_notices() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; k int;
begin
  -- 30 days before expiry
  insert into public.email_queue (kind, member_id, to_email, to_name, vars)
  select 'expiry_30', p.id, p.email, p.full_name, jsonb_build_object('expires_at', p.expires_at)
    from public.profiles p
   where p.role = 'member' and p.is_active
     and p.expires_at > now() and p.expires_at <= now() + interval '30 days'
     and not exists (select 1 from public.email_queue q where q.member_id = p.id and q.kind = 'expiry_30'
                       and q.vars->>'expires_at' = to_jsonb(p.expires_at) #>> '{}');
  get diagnostics k = row_count; n := n + k;

  -- On expiry
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

-- ---------- Grants ----------
-- New functions are executable by PUBLIC by default; open only what each role needs.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.public_member_count()                                  to anon, authenticated;
grant execute on function public.get_member_card(text)                                  to anon, authenticated;
grant execute on function public.redeem_coupon(text, uuid, text, text, boolean)         to anon, authenticated;
grant execute on function public.my_coupons()                                           to authenticated;
grant execute on function public.is_admin()                                             to authenticated;
grant execute on function public.membership_status(public.profiles)                     to authenticated;
grant execute on function public.admin_create_partner(text, text)                       to authenticated;
grant execute on function public.admin_update_partner(uuid, text, boolean)              to authenticated;
grant execute on function public.admin_set_partner_pin(uuid, text)                      to authenticated;
grant execute on function public.admin_create_batch(uuid, text, numeric, int, timestamptz) to authenticated;
grant execute on function public.admin_assign_coupons(uuid, uuid[])                     to authenticated;
grant execute on function public.admin_void_redemption(uuid)                            to authenticated;
grant execute on function public.admin_renew_membership(uuid)                           to authenticated;
grant execute on function public.admin_set_active(uuid, boolean)                        to authenticated;
grant execute on function public.admin_stats()                                          to authenticated;
grant execute on function public.admin_create_campaign(text, text, text, uuid[])        to authenticated;
-- gen_code is a column default: inserts run by security definer functions as the owner.
grant execute on function public.gen_code(int) to service_role;
grant execute on function public.queue_expiry_notices() to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
