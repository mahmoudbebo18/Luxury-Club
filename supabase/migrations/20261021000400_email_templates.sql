-- Default automatic-email templates (editable from /admin/settings).
-- Placeholders: {{name}} {{member_no}} {{expires_at}} {{account_url}} {{coupon_title}} {{coupon_value}}
--               {{partner}} {{coupon_expires}}
insert into public.email_templates (kind, label, subject, body_html) values
('welcome', 'الترحيب', 'مرحبًا بك في دسمان',
 '<p>أهلًا {{name}}،</p>
<p>يسعدنا انضمامك إلى عضوية دسمان. رقم عضويتك <strong>{{member_no}}</strong>، وعضويتك سارية حتى <strong>{{expires_at}}</strong>.</p>
<p>بطاقتك الرقمية ورمز QR الخاص بك في صفحة حسابك، اعرضها في الكافيهات الشريكة لاستخدام كوبوناتك.</p>
<p><a class="btn" href="{{account_url}}">عرض بطاقتي</a></p>'),
('coupon', 'كوبون جديد', 'لديك كوبون جديد من دسمان',
 '<p>أهلًا {{name}}،</p>
<p>أضفنا إلى حسابك كوبونًا جديدًا: <strong>{{coupon_title}}</strong> بقيمة <strong>{{coupon_value}} ريال</strong> لدى <strong>{{partner}}</strong>.</p>
<p>اعرض رمز QR من صفحة حسابك على الكاشير لاستخدامه.</p>
<p><a class="btn" href="{{account_url}}">عرض كوبوناتي</a></p>'),
('expiry_30', 'قبل انتهاء العضوية بـ 30 يومًا', 'عضويتك في دسمان تنتهي قريبًا',
 '<p>أهلًا {{name}}،</p>
<p>نذكّرك بأن عضويتك رقم <strong>{{member_no}}</strong> تنتهي في <strong>{{expires_at}}</strong>.</p>
<p>للتجديد تواصل معنا بالرد على هذه الرسالة أو عبر واتساب.</p>'),
('expired', 'انتهاء العضوية', 'انتهت عضويتك في دسمان',
 '<p>أهلًا {{name}}،</p>
<p>انتهت عضويتك رقم <strong>{{member_no}}</strong> في <strong>{{expires_at}}</strong>، ولن تظهر كوبوناتك في الكافيهات حتى التجديد.</p>
<p>للتجديد تواصل معنا بالرد على هذه الرسالة أو عبر واتساب.</p>');
