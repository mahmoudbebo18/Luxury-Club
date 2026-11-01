-- Member services in the portal (/account/services): the content of the services page, managed
-- from the admin panel, plus how each one is requested: an email to the provider (sent from the
-- member's own mailbox), a WhatsApp chat with a ready message, or a page inside the platform.
--
-- Contacts are only returned to members whose membership is active (trial included). Each click
-- on a request button is logged so the admin can see which services are used.

create table public.services (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique check (slug ~ '^[a-z0-9-]{2,40}$'),   -- anchor (#legal); the marketing page links to it
  sort_order     int not null default 0,
  icon           text not null default 'sparkle'
                 check (icon in ('legal', 'logistics', 'gift', 'concierge', 'flask', 'car', 'trophy', 'hotel',
                                 'dining', 'bag', 'shield', 'cap', 'calendar', 'users', 'sparkle', 'phone')),
  title_ar       text not null check (length(trim(title_ar)) between 2 and 80),
  title_en       text not null default '' check (length(title_en) <= 80),
  summary_ar     text not null default '' check (length(summary_ar) <= 600),
  summary_en     text not null default '' check (length(summary_en) <= 600),
  features_ar    text[] not null default '{}' check (cardinality(features_ar) <= 12),
  features_en    text[] not null default '{}' check (cardinality(features_en) <= 12),
  how_ar         text not null default '' check (length(how_ar) <= 600),    -- "how to request" shown above the buttons
  how_en         text not null default '' check (length(how_en) <= 600),
  message_ar     text not null default '' check (length(message_ar) <= 500), -- lines the member fills in the message
  message_en     text not null default '' check (length(message_en) <= 500),
  image_url      text,
  email          text check (email ~* '^[^\s@]+@[^\s@]+\.[a-z]{2,}$'),
  whatsapp       text check (whatsapp ~ '^[1-9][0-9]{9,14}$'),               -- international, digits only (wa.me format)
  ask_location   boolean not null default false,                             -- offer to attach the member's location (WhatsApp)
  page           text check (page in ('activities', 'coupons')),             -- a page inside the platform
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index services_sort_idx on public.services (sort_order, created_at);

create table public.service_requests (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  member_id   uuid not null references public.profiles(id) on delete cascade,
  channel     text not null check (channel in ('email', 'whatsapp')),
  created_at  timestamptz not null default now()
);
create index service_requests_service_idx on public.service_requests (service_id, created_at desc);
create index service_requests_member_idx on public.service_requests (member_id, created_at desc);

create or replace function public.services_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.email := nullif(lower(trim(new.email)), '');
  new.whatsapp := nullif(new.whatsapp, '');
  return new;
end;
$$;
create trigger services_touch before insert or update on public.services
  for each row execute function public.services_touch();

alter table public.services         enable row level security;
alter table public.service_requests enable row level security;
create policy "admin: all" on public.services         for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin: all" on public.service_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Member ----------
create or replace function public.member_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'member'
                   and p.is_active and p.expires_at > now());
$$;

create or replace function public.list_services()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
           'id', s.id, 'slug', s.slug, 'icon', s.icon,
           'title_ar', s.title_ar, 'title_en', s.title_en, 'summary_ar', s.summary_ar, 'summary_en', s.summary_en,
           'features_ar', s.features_ar, 'features_en', s.features_en, 'how_ar', s.how_ar, 'how_en', s.how_en,
           'message_ar', s.message_ar, 'message_en', s.message_en, 'image_url', s.image_url,
           'ask_location', s.ask_location, 'page', s.page,
           -- Contacts only for an active membership; the others see the content and a renew note.
           'email', case when act.ok then s.email end,
           'whatsapp', case when act.ok then s.whatsapp end,
           'has_contact', s.email is not null or s.whatsapp is not null
         ) order by s.sort_order, s.created_at), '[]'::json)
    from public.services s
    cross join (select public.member_is_active() as ok) act
   where s.is_published
     and exists (select 1 from public.profiles where id = auth.uid() and role = 'member');
$$;

-- One row per click; repeated clicks on the same button within 10 minutes count once.
create or replace function public.log_service_request(p_service_id uuid, p_channel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.member_is_active() or p_channel not in ('email', 'whatsapp') then return; end if;
  if not exists (select 1 from public.services where id = p_service_id and is_published) then return; end if;
  if exists (select 1 from public.service_requests
              where member_id = auth.uid() and service_id = p_service_id and channel = p_channel
                and created_at > now() - interval '10 minutes') then return; end if;
  insert into public.service_requests (service_id, member_id, channel) values (p_service_id, auth.uid(), p_channel);
end;
$$;

-- ---------- Admin ----------
create view public.admin_services with (security_invoker = on) as
select s.*,
       (select count(*) from public.service_requests r where r.service_id = s.id)::int as requests_total,
       (select count(*) from public.service_requests r where r.service_id = s.id
           and r.created_at > now() - interval '30 days')::int as requests_30d
from public.services s;

create view public.admin_service_requests with (security_invoker = on) as
select r.id, r.service_id, r.channel, r.created_at, s.title_ar as service_title,
       r.member_id, m.full_name as member_name, m.member_no, m.university
from public.service_requests r
join public.services s on s.id = r.service_id
join public.profiles m on m.id = r.member_id;

revoke all on public.admin_services, public.admin_service_requests from anon;

grant execute on function public.list_services()                  to authenticated;
grant execute on function public.log_service_request(uuid, text)  to authenticated;
grant execute on function public.member_is_active()               to authenticated;
revoke execute on function public.services_touch() from public, anon, authenticated;

-- ---------- Content: the seven services of the services page ----------
-- Contacts default to the club's mailbox and WhatsApp; the admin replaces them with the
-- lawyer's / provider's details.
insert into public.services (slug, sort_order, icon, title_ar, title_en, summary_ar, summary_en, features_ar, features_en,
                             how_ar, how_en, message_ar, message_en, image_url, email, whatsapp, ask_location, page) values
('legal', 1, 'legal', 'خدمات قانونية', 'Legal Services',
 'توفر عضوية دسمان فريقاً يضم نخبة من المحامين والمستشارين القانونيين هدفهم تلبية احتياجات الأعضاء القانونية ومتابعة شؤونهم الخاصة.',
 'DASMAN provides a team of lawyers and legal advisors whose purpose is to address members'' legal needs and follow up on their private affairs.',
 array['تقديم الاستشارات القانونية', 'كتابة العقود وتعديلها', 'متابعة القضايا وصياغة صحف الدعوى', 'التوجيه والإرشاد القانوني'],
 array['Legal consultations', 'Writing and amending contracts', 'Following up on cases and drafting lawsuits', 'Legal guidance'],
 'أرسل استشارتك للمحامي بالبريد من بريدك الشخصي، واشرح الموضوع وأرفق أي مستندات. يرد عليك المحامي على نفس البريد.',
 'Email your question to the lawyer from your own mailbox, explain the matter and attach any documents. The lawyer replies to the same address.',
 E'نوع الخدمة (استشارة / عقد / قضية):\nتفاصيل الموضوع:',
 E'Type of service (consultation / contract / case):\nDetails:',
 '/imgs/pic1.jpeg', 'dasman@the-luxury-club.com', null, false, null),
('logistics', 2, 'logistics', 'خدمات لوجستية', 'Logistics Services',
 'خدمات الشحن والتوصيل ونقل وتسليم الطلبات والمقتنيات، لتصل أغراضك إلى حيث تريد دون عناء.',
 'Shipping, delivery, and pickup and drop-off of orders and belongings, so your things get where they need to go without the hassle.',
 array['خدمات المطار', 'توصيل الأغراض والطلبات', 'الشحن ونقل وتسليم المقتنيات'],
 array['Airport services', 'Item and order delivery', 'Shipping and delivery of belongings'],
 'أرسل طلبك بالبريد مع العنوان والموعد المطلوب، ويتواصل معك الفريق لتأكيد التفاصيل والتكلفة إن وجدت.',
 'Email your request with the address and the time you need, and the team will get back to you to confirm the details and any cost.',
 E'نوع الطلب (مطار / توصيل / شحن):\nمن:\nإلى:\nالموعد المطلوب:\nتفاصيل الأغراض:',
 E'Request type (airport / delivery / shipping):\nFrom:\nTo:\nPreferred time:\nItem details:',
 '/imgs/services/logistics.jpg', 'dasman@the-luxury-club.com', null, false, null),
('offers', 3, 'gift', 'عروض ومكافآت', 'Offers & Rewards',
 'تمنحك عضويتك عروضاً ومكافآت وخصومات قيّمة طوال فترة الاشتراك لدى شركائنا، مع تحديث مستمر لقائمة الشركاء لتغطي احتياجات الأعضاء واهتماماتهم.',
 'Your membership gives you valuable offers, rewards and discounts throughout your subscription with our partners, with the partner list updated regularly to cover members'' needs and interests.',
 array['خصومات وعروض خاصة لدى المتاجر والعلامات التجارية', 'عروض وتجارب حصرية لدى الفنادق والمطاعم', 'خصومات ومكافآت على الفعاليات'],
 array['Special discounts and offers at stores and brands', 'Exclusive offers and experiences at hotels and restaurants', 'Discounts and rewards on events'],
 'كوبوناتك تظهر في حسابك. اعرض بطاقتك (QR) للكاشير عند الشريك ليصرف الكوبون.',
 'Your coupons are in your account. Show your card (QR) to the cashier at the partner to redeem a coupon.',
 '', '', '/imgs/services/offers.jpg', null, null, false, 'coupons'),
('concierge', 4, 'concierge', 'كونسيرج', 'Concierge',
 'فريق كونسيرج يلبي طلبات الأعضاء واحتياجاتهم ويساعدهم في إنجاز مهامهم اليومية.',
 'A concierge team that takes care of members'' requests and needs and helps them with their daily tasks.',
 array['حجوزات المطاعم', 'حجوزات الفعاليات', 'مساعد شخصي لإنجاز المهام اليومية', 'التوجيه والإرشاد إلى الخيارات والخدمات المناسبة'],
 array['Restaurant bookings', 'Event bookings', 'A personal assistant for daily tasks', 'Guidance toward the right options and services'],
 'راسل فريق الكونسيرج على واتساب برسالة جاهزة فيها رقم عضويتك، واكتب طلبك والموعد.',
 'Message the concierge team on WhatsApp with a ready message that includes your membership number, then add your request and the time.',
 E'الطلب:\nالموعد:\nعدد الأشخاص:',
 E'Request:\nDate and time:\nNumber of people:',
 '/imgs/pic2.jpeg', null, '966558103228', false, null),
('workshops', 5, 'flask', 'ورش عمل علمية', 'Scientific Workshops',
 'ورش عمل دورية يقدمها مختصون لتطوير مهارات الأعضاء الأكاديمية والعملية.',
 'Regular workshops led by specialists to build members'' academic and practical skills.',
 array['ورش التصوير الطبي', 'ورش البحث العلمي'],
 array['Medical photography workshops', 'Scientific research workshops'],
 'نعلن الورش في صفحة الأنشطة، والتسجيل منها مباشرة قبل اكتمال المقاعد.',
 'Workshops are announced on the activities page; sign up there before the seats run out.',
 '', '', '/imgs/services/workshops.jpg', null, null, false, 'activities'),
('roadside', 6, 'car', 'مساعدة على الطريق', 'Roadside Assistance',
 'خدمات المساعدة في حالات تعطل المركبات والحالات الطارئة على الطريق.',
 'Help when your vehicle breaks down or you face an emergency on the road.',
 array['سحب السيارة: اختر نوع السطحة المناسب لمركبتك', 'تغيير الإطارات: الإصلاح في الموقع أو النقل لمركز مختص', 'شحن البطارية أو استبدالها ببطارية جديدة', 'تزويد الوقود: بنزين أو ديزل داخل المدينة أو خارجها'],
 array['Towing: choose the right tow truck for your vehicle', 'Tire change: fixed on the spot or taken to a specialized center', 'Battery charging or replacement', 'Fuel delivery: gasoline or diesel inside or outside the city'],
 'اضغط زر واتساب لتصل رسالة طلب المساعدة برقم عضويتك وموقعك الحالي، واكتب نوع العطل ونوع السيارة.',
 'Tap the WhatsApp button to send a help request with your membership number and current location, then add the problem and your car type.',
 E'نوع المساعدة (سحب / إطار / بطارية / وقود):\nنوع السيارة ولونها:',
 E'Help needed (towing / tire / battery / fuel):\nCar make and colour:',
 '/imgs/pic.jpeg', null, '966558103228', true, null),
('activities', 7, 'trophy', 'أنشطة ترفيهية دورية', 'Recreational Activities',
 'أنشطة وفعاليات ترفيهية تُقام بشكل دوري لتجمع أعضاء دسمان.',
 'Fun activities and events held regularly to bring DASMAN members together.',
 array['بطولات البادل', 'بطولات كرة القدم', 'معارض ومؤتمرات', 'مسابقات علمية', 'غبقات رمضانية', 'احتفالات وطنية'],
 array['Padel tournaments', 'Football tournaments', 'Exhibitions and conferences', 'Scientific competitions', 'Ramadan ghabga gatherings', 'National celebrations'],
 'اختر النشاط من صفحة الأنشطة وسجّل وحدك أو مع فريقك، ويصلك التأكيد على بريدك.',
 'Pick an activity on the activities page and sign up alone or with your team; the confirmation comes to your email.',
 '', '', '/imgs/services/activities.jpg', null, null, false, 'activities');
