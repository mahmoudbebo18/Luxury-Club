-- The admin account is not a membership: its code is not accepted on the scan / redeem page.

CREATE OR REPLACE FUNCTION public.get_member_card(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m public.profiles; st text;
begin
  select * into m from public.profiles where member_code = p_code and role = 'member';
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
end $function$;

CREATE OR REPLACE FUNCTION public.redeem_coupon(p_member_code text, p_coupon_id uuid, p_pin text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text, p_remember boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  m public.profiles; c public.coupons; b public.coupon_batches; p public.partners; d public.partner_devices;
  new_token text; tries_left int; authorized boolean := false; redeemed_time timestamptz := now();
begin
  select * into m from public.profiles where member_code = p_member_code and role = 'member';
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
end $function$;

