-- Until launch, imported members get no queued email (campaigns, coupons, expiry notices),
-- so testing on the preview can't reach real people. Turn off on launch day:
--   update public.app_settings set launch_hold = false where id = 1;
alter table public.app_settings add column launch_hold boolean not null default false;
update public.app_settings set launch_hold = true where id = 1;

create or replace function public.hold_imported_emails() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select launch_hold from public.app_settings where id = 1)
     and exists (select 1 from auth.users u where u.id = new.member_id
                  and u.raw_user_meta_data->>'imported' = 'true') then
    return null;
  end if;
  return new;
end $$;

revoke execute on function public.hold_imported_emails() from public, anon, authenticated;

create trigger hold_imported_emails before insert on public.email_queue
for each row execute function public.hold_imported_emails();
