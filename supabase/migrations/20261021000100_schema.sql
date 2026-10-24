-- Dasman membership platform: tables (plan section 5).

create extension if not exists pgcrypto with schema extensions;

-- Random base62 code, used for member QR links and coupon codes.
create or replace function public.gen_code(len int) returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := '';
  b bytea := gen_random_bytes(len);
begin
  for i in 0..len - 1 loop
    result := result || substr(chars, (get_byte(b, i) % 62) + 1, 1);
  end loop;
  return result;
end $$;

create sequence public.member_no_seq start 1;

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  member_no     int unique not null default nextval('public.member_no_seq'),
  member_code   text unique not null default public.gen_code(10),
  full_name     text not null,
  university    text not null,
  study_year    text not null,
  district      text not null,
  phone         text not null,
  email         text not null,
  notes         text,
  photo_url     text,
  role          text not null default 'member' check (role in ('member', 'admin')),
  is_active     boolean not null default true,       -- manual suspension by admin
  joined_at     timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '1 year',
  created_at    timestamptz not null default now()
);
alter sequence public.member_no_seq owned by public.profiles.member_no;

create table public.partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  pin_hash      text not null,                       -- crypt(pin, gen_salt('bf'))
  pin_version   int not null default 1,              -- bumped on PIN change, invalidates remembered devices
  is_active     boolean not null default true,
  failed_tries  int not null default 0,
  locked_until  timestamptz,
  created_at    timestamptz not null default now()
);

create table public.partner_devices (                -- "remember this device"
  token_hash    text primary key,                    -- sha256 of the token
  partner_id    uuid not null references public.partners(id) on delete cascade,
  pin_version   int not null,
  expires_at    timestamptz not null
);

create table public.coupon_batches (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id),
  title         text not null,
  value_sar     numeric(10,2) not null check (value_sar > 0),
  quantity      int not null check (quantity between 1 and 5000),
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references public.coupon_batches(id) on delete cascade,
  code          text unique not null default 'DSM-' || public.gen_code(6),
  member_id     uuid references public.profiles(id) on delete set null,
  status        text not null default 'available'
                check (status in ('available', 'assigned', 'redeemed', 'void')),
  assigned_at   timestamptz,
  redeemed_at   timestamptz
);
create index coupons_batch_idx on public.coupons (batch_id, status);
create index coupons_member_idx on public.coupons (member_id, status);

create table public.redemptions (
  id            uuid primary key default gen_random_uuid(),
  coupon_id     uuid not null references public.coupons(id) on delete cascade,
  partner_id    uuid not null references public.partners(id),
  member_id     uuid references public.profiles(id) on delete set null,
  redeemed_at   timestamptz not null default now(),
  voided_at     timestamptz,
  voided_by     uuid references public.profiles(id) on delete set null
);
create index redemptions_partner_idx on public.redemptions (partner_id, redeemed_at desc);
create index redemptions_coupon_idx on public.redemptions (coupon_id);
create index redemptions_member_idx on public.redemptions (member_id);

-- Sender details and editable automatic-email templates (admin settings page).
create table public.app_settings (
  id            int primary key default 1 check (id = 1),
  sender_name   text not null default 'دسمان',
  sender_email  text not null default 'dasman@the-luxury-club.com',
  reply_to      text not null default 'dasman@the-luxury-club.com',
  site_url      text not null default 'https://dasman.the-luxury-club.com'
);
insert into public.app_settings default values;

create table public.email_templates (
  kind          text primary key,                    -- welcome | coupon | expiry_30 | expired
  label         text not null,
  subject       text not null,
  body_html     text not null,
  updated_at    timestamptz not null default now()
);

create table public.email_campaigns (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null,
  body_html     text not null,
  audience      text not null,
  total         int not null default 0,
  sent          int not null default 0,
  failed        int not null default 0,
  status        text not null default 'queued' check (status in ('queued', 'sending', 'done', 'failed')),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- Outgoing mail. Template kinds leave subject/body null and are rendered from email_templates.
create table public.email_queue (
  id            bigserial primary key,
  campaign_id   uuid references public.email_campaigns(id) on delete cascade,
  member_id     uuid references public.profiles(id) on delete set null,
  kind          text not null default 'campaign',
  to_email      text not null,
  to_name       text,
  subject       text,
  body_html     text,
  vars          jsonb not null default '{}'::jsonb,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error         text,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index email_queue_pending_idx on public.email_queue (status, id) where status = 'pending';
create index email_queue_sent_idx on public.email_queue (sent_at) where sent_at is not null;
create index email_queue_campaign_idx on public.email_queue (campaign_id);
create index email_queue_member_idx on public.email_queue (member_id, kind);

create table public.keep_alive (id int primary key);
insert into public.keep_alive values (1);
