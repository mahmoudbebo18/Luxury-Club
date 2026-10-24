// Admin: the services members see in their account, in order, and how each one is requested
// (WhatsApp number, provider email, or a platform page). Also the log of request clicks.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { Dropdown } from '../../components/Dropdown';
import { Tabs } from '../../components/Tabs';
import { TextArea, TextField } from '../../components/Field';
import { ImageField } from '../../components/ImageField';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, memberLabel } from '../../lib/format';
import { removeImage } from '../../lib/upload';
import {
  EMAIL_RE,
  PAGE_AR,
  SERVICE_ICONS,
  emailParts,
  formatWhatsapp,
  normalizeWhatsapp,
  type ServiceIcon,
  type ServicePage,
} from '../../lib/services';
import type { Tables } from '../../types/database';

export type AdminService = Tables<'admin_services'>;

export default function Services() {
  const [tab, setTab] = useState<'services' | 'log'>('services');
  const [editing, setEditing] = useState<AdminService | 'new' | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_services').select('*').order('sort_order').order('created_at');
      if (error) throw error;
      return data;
    },
  });
  const all = list.data ?? [];

  return (
    <>
      <AdminTitle
        title="الخدمات"
        lead="الخدمات التي تظهر للأعضاء في حساباتهم، وطريقة طلب كل خدمة: واتساب أو بريد المختص أو صفحة داخل المنصة."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" />
            خدمة جديدة
          </button>
        }
      />
      <div className="settings-tabs">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'services', label: 'الخدمات', count: all.length }, { value: 'log', label: 'سجل الطلبات' }]} />
      </div>

      {tab === 'log' ? (
        <RequestLog />
      ) : list.isLoading ? (
        <Skeleton rows={3} height={200} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الخدمات." onRetry={() => list.refetch()} />
      ) : !all.length ? (
        <div className="surface">
          <EmptyState icon="concierge" title="لا توجد خدمات" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" />خدمة جديدة</button>}>
            أضف خدمة لتظهر للأعضاء في صفحة «خدماتي» مع زر طلبها.
          </EmptyState>
        </div>
      ) : (
        <div className="cards cards--wide">
          {all.map((s, i) => <ServiceAdminCard key={s.id} s={s} i={i} all={all} onEdit={() => setEditing(s)} />)}
        </div>
      )}

      {editing && <ServiceForm service={editing === 'new' ? null : editing} nextOrder={all.length ? Math.max(...all.map((s) => s.sort_order ?? 0)) + 1 : 1} onClose={() => setEditing(null)} />}
    </>
  );
}

function ServiceAdminCard({ s, i, all, onEdit }: { s: AdminService; i: number; all: AdminService[]; onEdit: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
  const noChannel = !s.whatsapp && !s.email && !s.page;

  const move = async (dir: -1 | 1) => {
    const order = [...all];
    const [row] = order.splice(i, 1);
    order.splice(i + dir, 0, row);
    setBusy(true);
    const results = await Promise.all(
      order.map((x, n) => (x.sort_order === n + 1 ? null : supabase.from('services').update({ sort_order: n + 1 }).eq('id', x.id!))),
    );
    setBusy(false);
    if (results.some((r) => r?.error)) toast('تعذّر تغيير الترتيب.', 'error');
    refresh();
  };

  const togglePublished = async () => {
    setBusy(true);
    const { error } = await supabase.from('services').update({ is_published: !s.is_published }).eq('id', s.id!);
    setBusy(false);
    if (error) return toast(adminError(error), 'error');
    toast(s.is_published ? 'أُخفيت الخدمة عن الأعضاء.' : 'الخدمة ظاهرة للأعضاء الآن.');
    refresh();
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'حذف الخدمة؟',
      message: <>تختفي «{s.title_ar}» من حسابات الأعضاء ويُحذف سجل طلباتها. لإخفائها مؤقتًا استخدم «إخفاء» بدلًا من الحذف.</>,
      confirm: 'حذف',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('services').delete().eq('id', s.id!);
    if (error) return toast(adminError(error), 'error');
    removeImage(s.image_url);
    toast('حُذفت الخدمة.');
    refresh();
  };

  return (
    <motion.article className={s.is_published ? 'pcard scard' : 'pcard scard is-off'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <div className="pcard-head">
        {s.image_url ? <img className="scard-thumb" src={s.image_url} alt="" loading="lazy" /> : <span className="pcard-icon"><Icon name={s.icon ?? 'sparkle'} /></span>}
        <div>
          <h3>{s.title_ar}</h3>
          <small><Icon name={s.icon ?? 'sparkle'} />{s.title_en || 'بدون عنوان إنجليزي'}</small>
        </div>
        <span className="scard-order">
          <button type="button" className="up" onClick={() => move(-1)} disabled={busy || i === 0} aria-label="تقديم"><Icon name="arrow" /></button>
          <button type="button" className="down" onClick={() => move(1)} disabled={busy || i === all.length - 1} aria-label="تأخير"><Icon name="arrow" /></button>
        </span>
      </div>
      <div className="pcard-tags">
        {s.is_published ? <Badge tone="active">ظاهرة للأعضاء</Badge> : <Badge>مخفية</Badge>}
        {s.ask_location && s.whatsapp && <Badge tone="gold">يرفق الموقع</Badge>}
      </div>
      <ul className="scard-channels">
        {s.whatsapp && <li><Icon name="whatsapp" /><span dir="ltr">{formatWhatsapp(s.whatsapp)}</span></li>}
        {s.email && <li><Icon name="mail" /><span dir="ltr">{s.email}</span></li>}
        {s.page && <li><Icon name="arrow" className="icon-flip" /><span>{PAGE_AR[s.page as ServicePage]}</span></li>}
        {noChannel && <li className="is-missing"><Icon name="alert" /><span>بدون وسيلة طلب: يرى العضو المحتوى فقط</span></li>}
      </ul>
      {(s.whatsapp || s.email) && (
        <span className="scard-stat"><b>{s.requests_30d ?? 0}</b> طلب آخر 30 يومًا · <b>{s.requests_total ?? 0}</b> إجمالًا</span>
      )}
      <div className="pcard-actions">
        <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit}><Icon name="edit" />تعديل</button>
        <button type="button" className="btn btn-soft btn-xs" onClick={togglePublished} disabled={busy}><Icon name={s.is_published ? 'eye-off' : 'eye'} />{s.is_published ? 'إخفاء' : 'إظهار'}</button>
        <button type="button" className="btn btn-ghost btn-xs btn-danger-text" onClick={remove} aria-label="حذف"><Icon name="trash" /></button>
      </div>
    </motion.article>
  );
}

function RequestLog() {
  const log = useQuery({
    queryKey: ['admin', 'service-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_service_requests').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const rows = log.data ?? [];
  if (log.isLoading) return <Skeleton rows={5} height={56} />;
  if (log.isError) return <ErrorState message="تعذّر تحميل السجل." onRetry={() => log.refetch()} />;
  if (!rows.length) {
    return (
      <div className="surface">
        <EmptyState icon="history" title="لا توجد طلبات بعد">
          يظهر هنا كل ضغط من عضو على زر واتساب أو البريد في صفحة خدماته (آخر 200 طلب). الرسالة نفسها تصل للمختص مباشرة ولا تمر بالمنصة.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="table-card">
      <table className="dtable">
        <thead><tr><th>العضو</th><th>الخدمة</th><th>الوسيلة</th><th>الوقت</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="cell-title">
                <Link className="cell-strong" to={`/admin/members/${r.member_id}`}>{r.member_name}</Link>
                <small className="cell-sub mono" dir="ltr">{r.member_no ? memberLabel(r.member_no) : ''}</small>
              </td>
              <td data-label="الخدمة">{r.service_title}</td>
              <td data-label="الوسيلة">{r.channel === 'whatsapp' ? <Badge tone="active">واتساب</Badge> : <Badge tone="gold">بريد</Badge>}</td>
              <td data-label="الوقت">{formatDateTime(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Form = {
  title_ar: string;
  title_en: string;
  icon: ServiceIcon;
  image_url: string | null;
  summary_ar: string;
  summary_en: string;
  features_ar: string;
  features_en: string;
  how_ar: string;
  how_en: string;
  message_ar: string;
  message_en: string;
  whatsapp: string;
  ask_location: boolean;
  email: string;
  page: ServicePage | '';
  is_published: boolean;
};

type Section = 'content' | 'request' | 'en';
type Errors = Partial<Record<keyof Form, string>>;

const toForm = (s: AdminService | null): Form => ({
  title_ar: s?.title_ar ?? '',
  title_en: s?.title_en ?? '',
  icon: (s?.icon as ServiceIcon) ?? 'sparkle',
  image_url: s?.image_url ?? null,
  summary_ar: s?.summary_ar ?? '',
  summary_en: s?.summary_en ?? '',
  features_ar: (s?.features_ar ?? []).join('\n'),
  features_en: (s?.features_en ?? []).join('\n'),
  how_ar: s?.how_ar ?? '',
  how_en: s?.how_en ?? '',
  message_ar: s?.message_ar ?? '',
  message_en: s?.message_en ?? '',
  whatsapp: s?.whatsapp ? formatWhatsapp(s.whatsapp) : '',
  ask_location: s?.ask_location ?? false,
  email: s?.email ?? '',
  page: (s?.page as ServicePage) ?? '',
  is_published: s?.is_published ?? true,
});

const toLines = (v: string) => v.split('\n').map((l) => l.trim()).filter(Boolean);

const SAMPLE = { full_name: 'محمد أحمد', member_no: 'DSM-0012', phone: '+966 5X XXX XXXX', university: 'جامعة الملك سعود' };

function ServiceForm({ service, nextOrder, onClose }: { service: AdminService | null; nextOrder: number; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(service));
  const [section, setSection] = useState<Section>('content');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Errors show as a toast at the top of the screen, seen however far the form is scrolled.
  const setError = (text: string | null) => text && toast(text, 'error');

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const wa = form.whatsapp.trim() ? normalizeWhatsapp(form.whatsapp) : null;
  const email = form.email.trim().toLowerCase();
  const preview = useMemo(() => emailParts(form.title_ar || 'اسم الخدمة', form.message_ar, SAMPLE, 'ar'), [form.title_ar, form.message_ar]);

  const validate = (): [Errors, Section | null] => {
    const e: Errors = {};
    if (form.title_ar.trim().length < 2) e.title_ar = 'اكتب اسم الخدمة.';
    if (toLines(form.features_ar).length > 12) e.features_ar = 'حتى 12 بندًا.';
    if (wa && !wa.ok) e.whatsapp = wa.error;
    if (email && !EMAIL_RE.test(email)) e.email = 'اكتب بريدًا صحيحًا، مثل lawyer@example.com';
    if (toLines(form.features_en).length > 12) e.features_en = 'Up to 12 items.';
    const first: Section | null = e.title_ar || e.features_ar ? 'content' : e.whatsapp || e.email ? 'request' : e.features_en ? 'en' : null;
    return [e, first];
  };

  const save = async () => {
    const [e, first] = validate();
    setErrors(e);
    if (first) {
      setSection(first);
      return setError('راجع الحقول المظللة.');
    }
    setBusy(true);
    setError(null);
    const row = {
      title_ar: form.title_ar.trim(),
      title_en: form.title_en.trim(),
      icon: form.icon,
      image_url: form.image_url,
      summary_ar: form.summary_ar.trim(),
      summary_en: form.summary_en.trim(),
      features_ar: toLines(form.features_ar),
      features_en: toLines(form.features_en),
      how_ar: form.how_ar.trim(),
      how_en: form.how_en.trim(),
      message_ar: form.message_ar.trim(),
      message_en: form.message_en.trim(),
      whatsapp: wa?.ok ? wa.value : null,
      ask_location: !!wa?.ok && form.ask_location,
      email: email || null,
      page: form.page || null,
      is_published: form.is_published,
    };
    const { error } = service
      ? await supabase.from('services').update(row).eq('id', service.id!)
      : await supabase.from('services').insert({ ...row, sort_order: nextOrder });
    setBusy(false);
    if (error) return setError(adminError(error));
    if (service?.image_url && service.image_url !== form.image_url) removeImage(service.image_url);
    toast(service ? 'تم حفظ الخدمة.' : form.is_published ? 'أُضيفت الخدمة وظهرت للأعضاء.' : 'أُضيفت الخدمة (مخفية).');
    queryClient.invalidateQueries({ queryKey: ['admin', 'services'] });
    onClose();
  };

  return (
    <Modal
      open
      wide
      icon="concierge"
      title={service ? 'تعديل الخدمة' : 'خدمة جديدة'}
      onClose={onClose}
      footer={
        <div className="ui-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading}>
            {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
          </button>
        </div>
      }
    >
      <div className="settings-tabs">
        <Tabs
          value={section}
          onChange={setSection}
          tabs={[
            { value: 'content', label: 'المحتوى' },
            { value: 'request', label: 'طريقة الطلب' },
            { value: 'en', label: 'English' },
          ]}
        />
      </div>

      <div className="ui-grid">
        {section === 'content' && (
          <>
            <TextField label="اسم الخدمة" icon="sparkle" full placeholder="مثال: خدمات قانونية" value={form.title_ar} onChange={set('title_ar')} maxLength={80} error={errors.title_ar} />
            <div className="ui-field ui-field--full">
              <span className="ui-label">الأيقونة</span>
              <div className="presets icon-presets" role="radiogroup" aria-label="الأيقونة">
                {SERVICE_ICONS.map((ic) => (
                  <button key={ic} type="button" role="radio" aria-checked={form.icon === ic} aria-label={ic} className={form.icon === ic ? 'preset is-on' : 'preset'} onClick={() => setForm((f) => ({ ...f, icon: ic }))}>
                    <Icon name={ic} />
                  </button>
                ))}
              </div>
            </div>
            <ImageField label="صورة الخدمة" folder="services" value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} onBusy={setUploading} hint="تظهر أعلى كارت الخدمة. يفضل صورة عرضية." />
            <TextArea label="الوصف" full rows={3} maxLength={600} placeholder="ماذا تقدم الخدمة للعضو…" value={form.summary_ar} onChange={set('summary_ar')} />
            <TextArea label="ما تشمله الخدمة" optional="(بند في كل سطر)" full rows={5} placeholder={'تقديم الاستشارات القانونية\nكتابة العقود وتعديلها'} value={form.features_ar} onChange={set('features_ar')} error={errors.features_ar} />
            <label className="ui-switch switch-card ui-field--full">
              <span>
                <strong>ظاهرة للأعضاء</strong>
                <small>عند الإخفاء لا تظهر في صفحة «خدماتي».</small>
              </span>
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} />
              <span className="ui-switch-track" />
            </label>
          </>
        )}

        {section === 'request' && (
          <>
            <TextArea label="كيف يطلب العضو الخدمة" full rows={3} maxLength={600} placeholder="مثال: أرسل استشارتك للمحامي بالبريد، ويرد عليك خلال يوم عمل." value={form.how_ar} onChange={set('how_ar')} hint="يظهر فوق أزرار الطلب." />

            <h3 className="form-section-title ui-field--full"><Icon name="whatsapp" />واتساب</h3>
            <TextField
              label="رقم الواتساب"
              optional="(اختياري)"
              icon="phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              placeholder="+966 55 810 3228"
              value={form.whatsapp}
              onChange={set('whatsapp')}
              onBlur={() => wa && !wa.ok && setErrors((x) => ({ ...x, whatsapp: wa.error }))}
              error={errors.whatsapp}
              hint={wa?.ok ? undefined : 'مع مفتاح الدولة (+966، +965…). الرقم السعودي يمكن كتابته 05XXXXXXXX.'}
              full
            />
            {wa?.ok && (
              <p className="wa-preview ui-field--full">
                <Icon name="check-circle" />
                <span>يفتح محادثة مع <span dir="ltr">{formatWhatsapp(wa.value)}</span> ·</span>
                <a href={`https://wa.me/${wa.value}`} target="_blank" rel="noopener">جرّب الرابط</a>
              </p>
            )}
            {wa?.ok && (
              <label className="ui-switch switch-card ui-field--full">
                <span>
                  <strong>طلب موقع العضو</strong>
                  <small>يُرفق رابط موقعه الحالي على الخريطة في الرسالة (مثل المساعدة على الطريق).</small>
                </span>
                <input type="checkbox" checked={form.ask_location} onChange={(e) => setForm((f) => ({ ...f, ask_location: e.target.checked }))} />
                <span className="ui-switch-track" />
              </label>
            )}

            <h3 className="form-section-title ui-field--full"><Icon name="mail" />البريد</h3>
            <TextField label="بريد المختص" optional="(اختياري)" icon="mail" type="email" dir="ltr" autoComplete="off" placeholder="lawyer@example.com" value={form.email} onChange={set('email')} onBlur={() => email && !EMAIL_RE.test(email) && setErrors((x) => ({ ...x, email: 'اكتب بريدًا صحيحًا، مثل lawyer@example.com' }))} error={errors.email} hint="يرسل العضو من بريده الشخصي مباشرة، فيصلك ردّه على بريده." full />

            <h3 className="form-section-title ui-field--full"><Icon name="arrow" className="icon-flip" />صفحة في المنصة</h3>
            <div className="ui-field ui-field--full">
              <Dropdown
                block
                icon="list"
                placeholder="بدون"
                value={form.page}
                onChange={(v) => setForm((f) => ({ ...f, page: v as Form['page'] }))}
                options={[
                  { value: '', label: 'بدون' },
                  { value: 'activities', label: PAGE_AR.activities, hint: 'للأنشطة والورش والبطولات' },
                  { value: 'coupons', label: PAGE_AR.coupons, hint: 'للعروض والخصومات' },
                ]}
              />
            </div>

            {(wa?.ok || email) && (
              <>
                <h3 className="form-section-title ui-field--full"><Icon name="send" />الرسالة الجاهزة</h3>
                <TextArea label="أسطر يكملها العضو" optional="(اختياري)" full rows={3} maxLength={500} placeholder={'نوع الاستشارة:\nتفاصيل الموضوع:'} value={form.message_ar} onChange={set('message_ar')} hint="تُضاف أسفل بيانات العضو ليكتب طلبه بعدها." />
                <div className="ui-field ui-field--full">
                  <span className="ui-label">معاينة (بعضو تجريبي)</span>
                  <div className="msg-preview">{preview.body.trim()}</div>
                  <p className="ui-hint">عنوان البريد: {preview.subject}. ورسالة واتساب بنفس النص بدون الجوال والجامعة.</p>
                </div>
              </>
            )}
            {!wa?.ok && !email && !form.page && (
              <div className="ui-field--full adm-note"><Icon name="info" /><span>بدون واتساب أو بريد أو صفحة، يرى العضو محتوى الخدمة فقط بدون زر طلب.</span></div>
            )}
          </>
        )}

        {section === 'en' && (
          <div className="ui-grid ui-field--full" dir="ltr" lang="en">
            <TextField label="Service name" full placeholder="Legal Services" value={form.title_en} onChange={set('title_en')} maxLength={80} />
            <TextArea label="Description" full rows={3} maxLength={600} value={form.summary_en} onChange={set('summary_en')} />
            <TextArea label="What it includes (one per line)" full rows={4} value={form.features_en} onChange={set('features_en')} error={errors.features_en} />
            <TextArea label="How to request it" full rows={3} maxLength={600} value={form.how_en} onChange={set('how_en')} />
            {(wa?.ok || email) && <TextArea label="Lines the member fills in" full rows={3} maxLength={500} placeholder={'Type of request:\nDetails:'} value={form.message_en} onChange={set('message_en')} />}
            <p className="ui-hint ui-field--full">Empty fields show the Arabic text to members using English.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
