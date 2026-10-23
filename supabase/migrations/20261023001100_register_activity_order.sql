-- A member who is already in an activity is told so, even when the activity has filled up since
-- (the "full" check used to come first and hid it).

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
  if exists (select 1 from public.activity_participants where activity_id = a.id and member_id = me.id) then
    return json_build_object('ok', false, 'error', 'already_registered'); end if;
  taken := public.activity_taken(a.id);
  st := public.activity_state(a, taken);
  if st = 'full' then return json_build_object('ok', false, 'error', 'full'); end if;
  if st <> 'open' then return json_build_object('ok', false, 'error', 'closed'); end if;

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
    'team_name', coalesce(tname, 'تسجيل فردي'), 'team_size', (1 + cardinality(mates))::text,
    'seats_taken', (taken + 1)::text, 'seats_total', a.capacity::text,
    'seats_left', (a.capacity - taken - 1)::text));

  return json_build_object('ok', true, 'registration_id', reg_id, 'seats_left', a.capacity - taken - 1);
end $$;

grant execute on function public.register_activity(uuid, text, text[]) to authenticated;
