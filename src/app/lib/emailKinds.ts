// Every kind of automatic email (email_queue.kind / email_templates.kind), in one place: the settings
// page lists the templates in this order, and the emails page labels its log with it. A new kind
// added in the database needs its line here too.
export type EmailKind = { kind: string; label: string; icon: string; when: string; toAdmin?: boolean };

export const EMAIL_KINDS: EmailKind[] = [
  { kind: 'welcome', label: 'ترحيب', icon: 'sparkle', when: 'بعد تأكيد العضو لبريده' },
  { kind: 'coupon', label: 'كوبون جديد', icon: 'ticket', when: 'عند توزيع كوبون على العضو' },
  { kind: 'expiry_30', label: 'قبل الانتهاء', icon: 'clock', when: 'قبل انتهاء العضوية بعدد أيام التذكير' },
  { kind: 'expired', label: 'انتهاء العضوية', icon: 'alert', when: 'يوم انتهاء العضوية' },
  { kind: 'activity_registered', label: 'تأكيد تسجيل في نشاط', icon: 'trophy', when: 'للعضو أو قائد الفريق بعد التسجيل' },
  { kind: 'activity_team_added', label: 'إضافة لفريق', icon: 'users', when: 'لكل عضو يضيفه القائد لفريقه' },
  { kind: 'activity_reminder', label: 'تذكير بنشاط', icon: 'bell', when: 'قبل النشاط بيوم، 8 صباحًا' },
  { kind: 'registration_cancelled', label: 'إلغاء تسجيل في نشاط', icon: 'x-circle', when: 'عند إلغاء تسجيل أو حذف عضو من فريق' },
  { kind: 'activity_cancelled', label: 'إلغاء نشاط', icon: 'alert', when: 'لكل المسجلين عند إلغاء النشاط' },
  { kind: 'ambassador_approved', label: 'قبول سفير', icon: 'sparkle', when: 'عند قبول العضو سفيرًا' },
  { kind: 'ambassador_rejected', label: 'اعتذار عن طلب سفير', icon: 'mail', when: 'عند رفض طلب السفير' },
  { kind: 'admin_activity_registration', label: 'للإدارة: تسجيل في نشاط', icon: 'bell', when: 'للإدارة مع كل تسجيل في نشاط', toAdmin: true },
  { kind: 'ambassador_request', label: 'للإدارة: طلب سفير', icon: 'bell', when: 'للإدارة مع كل طلب سفير', toAdmin: true },
];

const BY_KIND = new Map(EMAIL_KINDS.map((k) => [k.kind, k]));

export const emailKind = (kind: string): EmailKind =>
  kind === 'campaign' ? { kind, label: 'حملة', icon: 'send', when: '' } : BY_KIND.get(kind) ?? { kind, label: kind, icon: 'mail', when: '' };

/** Sort order for the templates list (unknown kinds go last). */
export const kindOrder = (kind: string) => {
  const i = EMAIL_KINDS.findIndex((k) => k.kind === kind);
  return i < 0 ? EMAIL_KINDS.length : i;
};
