// Sender details and the automatic email templates. Templates use a list + editor layout
// (pick one on the side, edit with a live preview) instead of one long page.
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { Icon } from '../../components/Icon';
import { Tabs } from '../../components/Tabs';
import { TextField } from '../../components/Field';
import { ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/Modal';
import type { Tables } from '../../types/database';

type Template = Tables<'email_templates'>;

const ORDER = [
  'welcome', 'coupon', 'expiry_30', 'expired',
  'activity_registered', 'activity_team_added', 'activity_reminder', 'registration_cancelled', 'activity_cancelled',
  'ambassador_approved', 'ambassador_rejected', 'admin_activity_registration', 'ambassador_request',
];
const META: Record<string, { icon: string; when: string }> = {
  welcome: { icon: 'sparkle', when: 'بعد تأكيد العضو لبريده' },
  coupon: { icon: 'ticket', when: 'عند توزيع كوبون على العضو' },
  expiry_30: { icon: 'clock', when: 'قبل انتهاء العضوية بـ 30 يومًا' },
  expired: { icon: 'alert', when: 'يوم انتهاء العضوية' },
  activity_registered: { icon: 'trophy', when: 'للعضو أو قائد الفريق بعد التسجيل' },
  activity_team_added: { icon: 'users', when: 'لكل عضو يضيفه القائد لفريقه' },
  activity_reminder: { icon: 'bell', when: 'قبل النشاط بيوم، 8 صباحًا' },
  registration_cancelled: { icon: 'x-circle', when: 'عند إلغاء تسجيل أو حذف عضو من فريق' },
  activity_cancelled: { icon: 'alert', when: 'لكل المسجلين عند إلغاء النشاط' },
  ambassador_approved: { icon: 'sparkle', when: 'عند قبول العضو سفيرًا' },
  ambassador_rejected: { icon: 'mail', when: 'عند رفض طلب السفير' },
  admin_activity_registration: { icon: 'bell', when: 'للإدارة مع كل تسجيل في نشاط' },
  ambassador_request: { icon: 'bell', when: 'للإدارة مع كل طلب سفير' },
};

const ACTIVITY_KINDS = ['activity_registered', 'activity_team_added', 'activity_reminder', 'registration_cancelled', 'activity_cancelled', 'admin_activity_registration'];
const ADMIN_KINDS = ['admin_activity_registration', 'ambassador_request'];

const VARS: { key: string; label: string; sample: string; only?: string[] }[] = [
  { key: 'name', label: 'اسم العضو', sample: 'محمد العتيبي' },
  { key: 'member_no', label: 'رقم العضوية', sample: 'DSM-0042' },
  { key: 'expires_at', label: 'تاريخ الانتهاء', sample: '21 أكتوبر 2027' },
  { key: 'account_url', label: 'رابط الحساب', sample: 'https://dasman.the-luxury-club.com/account' },
  { key: 'coupon_title', label: 'عنوان الكوبون', sample: 'خصم 50 ريال على أي طلب', only: ['coupon'] },
  { key: 'coupon_value', label: 'قيمة الكوبون', sample: '50', only: ['coupon'] },
  { key: 'partner', label: 'الكافيه', sample: 'كافيه الورد', only: ['coupon'] },
  { key: 'coupon_expires', label: 'انتهاء الكوبون', sample: '30 نوفمبر 2026', only: ['coupon'] },
  { key: 'activity_title', label: 'اسم النشاط', sample: 'بطولة دسمان للبادل', only: ACTIVITY_KINDS },
  { key: 'activity_date', label: 'موعد النشاط', sample: 'الخميس، 12 نوفمبر 2026، 8:00 م', only: ACTIVITY_KINDS },
  { key: 'activity_location', label: 'مكان النشاط', sample: 'ملاعب الياسمين', only: ACTIVITY_KINDS },
  { key: 'activities_url', label: 'رابط الأنشطة', sample: 'https://dasman.the-luxury-club.com/account/activities', only: ACTIVITY_KINDS },
  { key: 'team_name', label: 'اسم الفريق', sample: 'صقور الملقا', only: ACTIVITY_KINDS },
  { key: 'team_line', label: 'سطر الفريق', sample: 'الفريق: صقور الملقا · عدد الأعضاء: 5', only: ['activity_registered'] },
  { key: 'captain_name', label: 'اسم القائد', sample: 'عبدالله السبيعي', only: ['activity_team_added'] },
  { key: 'team_size', label: 'عدد أعضاء الفريق', sample: '5', only: ['admin_activity_registration'] },
  { key: 'seats_taken', label: 'المحجوز', sample: '12', only: ['admin_activity_registration'] },
  { key: 'seats_total', label: 'العدد الكلي', sample: '16', only: ['admin_activity_registration'] },
  { key: 'seats_left', label: 'المتبقي', sample: '4', only: ['admin_activity_registration'] },
  { key: 'member_name', label: 'اسم العضو', sample: 'محمد العتيبي', only: ADMIN_KINDS },
  { key: 'university', label: 'الجامعة', sample: 'جامعة الملك سعود', only: ['ambassador_request'] },
  { key: 'motivation', label: 'سبب التقديم', sample: 'أحب تنظيم الفعاليات وعندي شبكة واسعة في الجامعة…', only: ['ambassador_request'] },
  { key: 'admin_url', label: 'رابط لوحة الإدارة', sample: 'https://dasman.the-luxury-club.com/admin', only: ADMIN_KINDS },
  { key: 'referral_url', label: 'رابط الدعوة', sample: 'https://dasman.the-luxury-club.com/register?ref=K7Q2MX', only: ['ambassador_approved'] },
  { key: 'referral_code', label: 'كود الدعوة', sample: 'K7Q2MX', only: ['ambassador_approved'] },
  { key: 'ambassador_url', label: 'رابط صفحة السفير', sample: 'https://dasman.the-luxury-club.com/account/ambassador', only: ['ambassador_approved'] },
  { key: 'admin_note', label: 'رسالة الإدارة', sample: 'نتمنى أن تقدّم في الفصل القادم.', only: ['ambassador_rejected'] },
];

const fillSample = (html: string) => VARS.reduce((s, v) => s.replaceAll(`{{${v.key}}}`, v.sample), html);

export default function Settings() {
  const [tab, setTab] = useState<'membership' | 'templates' | 'sender'>('membership');
  const data = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const [settings, tpl] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 1).single(),
        supabase.from('email_templates').select('*').order('kind'),
      ]);
      if (settings.error) throw settings.error;
      if (tpl.error) throw tpl.error;
      return { settings: settings.data, templates: [...tpl.data].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)) };
    },
  });

  return (
    <>
      <AdminTitle title="الإعدادات" lead="مدة العضوية، وقوالب الرسائل التلقائية، وبيانات المرسل." />
      <div className="settings-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'membership', label: 'العضوية', icon: 'calendar' },
            { value: 'templates', label: 'قوالب الرسائل', icon: 'file' },
            { value: 'sender', label: 'المرسل', icon: 'mail' },
          ]}
        />
      </div>
      {data.isLoading ? (
        <Skeleton rows={3} height={90} />
      ) : data.isError || !data.data ? (
        <ErrorState message="تعذّر تحميل الإعدادات." onRetry={() => data.refetch()} />
      ) : tab === 'membership' ? (
        <Membership settings={data.data.settings} />
      ) : tab === 'templates' ? (
        <Templates initial={data.data.templates} />
      ) : (
        <Sender settings={data.data.settings} />
      )}
    </>
  );
}

function Templates({ initial }: { initial: Template[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [list, setList] = useState(initial);
  const [current, setCurrent] = useState(initial[0]?.kind ?? '');
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setList(initial), [initial]);

  const tpl = list.find((t) => t.kind === current);
  const saved = initial.find((t) => t.kind === current);
  const dirty = (t: Template) => {
    const s = initial.find((x) => x.kind === t.kind);
    return !!s && (s.subject !== t.subject || s.body_html !== t.body_html);
  };

  const edit = (patch: Partial<Template>) => setList((l) => l.map((t) => (t.kind === current ? { ...t, ...patch } : t)));

  const pick = async (kind: string) => {
    if (kind === current) return;
    if (tpl && dirty(tpl) && !(await confirm({ title: 'تغييرات غير محفوظة', message: `لم تحفظ تعديلات «${tpl.label}». هل تريد المتابعة بدون حفظ؟`, confirm: 'متابعة بدون حفظ', cancel: 'البقاء' }))) return;
    if (tpl && dirty(tpl)) setList((l) => l.map((t) => (t.kind === current && saved ? saved : t)));
    setCurrent(kind);
  };

  const insert = (key: string) => {
    const el = area.current;
    if (!el || !tpl) return;
    const token = `{{${key}}}`;
    const start = el.selectionStart ?? tpl.body_html.length;
    const end = el.selectionEnd ?? start;
    edit({ body_html: tpl.body_html.slice(0, start) + token + tpl.body_html.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (!tpl) return;
    setBusy(true);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject: tpl.subject, body_html: tpl.body_html, updated_at: new Date().toISOString() })
      .eq('kind', tpl.kind);
    setBusy(false);
    if (error) return toast('تعذّر حفظ القالب.', 'error');
    toast(`تم حفظ قالب «${tpl.label}».`);
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
  };

  return (
    <div className="tpl">
      <nav className="tpl-list" aria-label="القوالب">
        {list.map((t) => (
          <button key={t.kind} type="button" className={t.kind === current ? 'tpl-item is-active' : 'tpl-item'} onClick={() => pick(t.kind)}>
            <span className="tpl-item-icon"><Icon name={META[t.kind]?.icon ?? 'mail'} /></span>
            <span className="tpl-item-body">
              <strong>{t.label}{dirty(t) && <i className="dot" aria-label="غير محفوظ" />}</strong>
              <small>{META[t.kind]?.when}</small>
            </span>
          </button>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        {tpl && (
          <motion.section key={tpl.kind} className="surface tpl-editor" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
            <div className="surface-head">
              <h2><Icon name={META[tpl.kind]?.icon ?? 'mail'} />{tpl.label}</h2>
              <Tabs value={view} onChange={setView} tabs={[{ value: 'edit', label: 'تعديل', icon: 'edit' }, { value: 'preview', label: 'معاينة', icon: 'eye' }]} />
            </div>

            {view === 'edit' ? (
              <div className="ui-form">
                <TextField label="عنوان الرسالة" icon="file" value={tpl.subject} onChange={(e) => edit({ subject: e.target.value })} />
                <div className="ui-field">
                  <label className="ui-label" htmlFor="tplBody">المحتوى (HTML)</label>
                  <textarea id="tplBody" ref={area} className="ui-input ui-textarea code-area" rows={12} dir="rtl" value={tpl.body_html} onChange={(e) => edit({ body_html: e.target.value })} />
                  <div className="var-chips">
                    <span>إدراج متغير:</span>
                    {VARS.filter((v) => !v.only || v.only.includes(tpl.kind)).map((v) => (
                      <button key={v.key} type="button" className="var-chip" onClick={() => insert(v.key)} title={`{{${v.key}}}`}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mail-preview">
                <div className="mail-preview-head">
                  <span className="avatar">د</span>
                  <span><strong>دسمان</strong><small dir="ltr">dasman@the-luxury-club.com</small></span>
                </div>
                <div className="mail-preview-subject">{fillSample(tpl.subject)}</div>
                <div className="mail-preview-body" dangerouslySetInnerHTML={{ __html: fillSample(tpl.body_html) }} />
                <p className="ui-hint">المعاينة ببيانات تجريبية.</p>
              </div>
            )}

            <div className="tpl-actions">
              {dirty(tpl) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => saved && setList((l) => l.map((t) => (t.kind === current ? saved : t)))}>
                  <Icon name="undo" />
                  تراجع
                </button>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty(tpl)}>
                {busy ? <Spinner small /> : <><Icon name="check" />حفظ القالب</>}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sender({ settings }: { settings: Tables<'app_settings'> }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ sender_name: settings.sender_name, reply_to: settings.reply_to, notify_email: settings.notify_email });
  const [busy, setBusy] = useState(false);
  const changed = form.sender_name !== settings.sender_name || form.reply_to !== settings.reply_to || form.notify_email !== settings.notify_email;
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const save = async () => {
    if (!form.sender_name.trim()) return toast('اكتب اسم المرسل.', 'error');
    if (form.reply_to && !email.test(form.reply_to.trim())) return toast('بريد «الرد على» غير صحيح.', 'error');
    if (form.notify_email.trim() && !email.test(form.notify_email.trim())) return toast('بريد تنبيهات الإدارة غير صحيح.', 'error');
    setBusy(true);
    const { error } = await supabase
      .from('app_settings')
      .update({ sender_name: form.sender_name.trim(), reply_to: form.reply_to.trim(), notify_email: form.notify_email.trim().toLowerCase() })
      .eq('id', 1);
    setBusy(false);
    if (error) return toast('تعذّر الحفظ.', 'error');
    toast('تم حفظ بيانات المرسل.');
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
  };

  return (
    <motion.section className="surface sender" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="surface-title"><Icon name="mail" />المرسل</h2>
      <div className="ui-grid">
        <TextField label="اسم المرسل" icon="user" value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} hint="يظهر للأعضاء في صندوق الوارد." />
        <TextField label="الرد على" icon="send" type="email" dir="ltr" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} hint="عندما يرد العضو تصل الرسالة إلى هذا البريد." />
        <TextField label="بريد الإرسال" icon="lock" full dir="ltr" value={settings.sender_email} disabled readOnly hint="موثّق في Brevo على دومين الموقع، وتغييره يحتاج توثيق دومين جديد." />
        <TextField
          label="بريد تنبيهات الإدارة"
          icon="bell"
          full
          type="email"
          dir="ltr"
          value={form.notify_email}
          onChange={(e) => setForm({ ...form, notify_email: e.target.value })}
          hint="يصله بريد مع كل تسجيل في نشاط وكل طلب سفير. اتركه فارغًا لإيقاف التنبيهات."
        />
      </div>
      <div className="tpl-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !changed}>
          {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
        </button>
      </div>
    </motion.section>
  );
}

const PRESETS = [7, 14, 30, 365];

function Membership({ settings }: { settings: Tables<'app_settings'> }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(String(settings.new_member_days));
  const [remind, setRemind] = useState(String(settings.reminder_days));
  const [busy, setBusy] = useState(false);
  const d = Number(days);
  const r = Number(remind);
  const valid = Number.isInteger(d) && d >= 1 && d <= 3650 && Number.isInteger(r) && r >= 1 && r <= 365;
  const changed = d !== settings.new_member_days || r !== settings.reminder_days;
  const label = (n: number) => (n === 365 ? 'سنة' : n === 30 ? 'شهر' : `${n} يوم`);

  const save = async () => {
    if (!valid) return toast('اكتب أرقامًا صحيحة.', 'error');
    if (r >= d) return toast('التذكير يجب أن يكون أقل من مدة العضوية.', 'error');
    setBusy(true);
    const { error } = await supabase.from('app_settings').update({ new_member_days: d, reminder_days: r }).eq('id', 1);
    setBusy(false);
    if (error) return toast('تعذّر الحفظ.', 'error');
    toast('تم حفظ إعدادات العضوية.');
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
  };

  return (
    <motion.section className="surface sender" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="surface-title"><Icon name="calendar" />مدة العضوية للمسجلين الجدد</h2>
      <p className="surface-lead">تبدأ العضوية يوم التسجيل وتنتهي بعد هذه المدة. التغيير يسري على المسجلين من الآن فقط، ولا تتغير تواريخ الأعضاء الحاليين.</p>
      <div className="presets" role="group" aria-label="مدد سريعة">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={d === p ? 'preset is-on' : 'preset'} onClick={() => setDays(String(p))}>
            {label(p)}
          </button>
        ))}
      </div>
      <div className="ui-grid">
        <TextField label="مدة العضوية (أيام)" icon="calendar" type="number" min={1} max={3650} dir="ltr" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        <TextField
          label="رسالة التذكير قبل الانتهاء بـ (أيام)"
          icon="bell"
          type="number"
          min={1}
          max={365}
          dir="ltr"
          inputMode="numeric"
          value={remind}
          onChange={(e) => setRemind(e.target.value)}
          hint="لا تُرسل لعضوية بدأت داخل مدة التذكير."
        />
      </div>
      {d < 365 && (
        <div className="adm-note">
          <Icon name="info" />
          <span>بعد انتهاء المدة تصبح العضوية «منتهية» وتختفي الكوبونات. إلى أن يُربط الدفع (المرحلة الثانية) يكون التجديد يدويًا من ملف العضو.</span>
        </div>
      )}
      <div className="tpl-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !changed || !valid}>
          {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
        </button>
      </div>
    </motion.section>
  );
}
