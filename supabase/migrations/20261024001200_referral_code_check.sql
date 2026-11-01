-- Sign-up form: tell the visitor right away when an invite code doesn't match an ambassador
-- (typo, or the ambassador role was taken back) instead of signing up without the referral.
-- Same match as handle_new_user. Returns only yes/no, nothing about the ambassador.

create or replace function public.check_referral_code(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                  where referral_code = upper(nullif(trim(p_code), '')) and is_ambassador);
$$;

revoke execute on function public.check_referral_code(text) from public;
grant execute on function public.check_referral_code(text) to anon, authenticated;
