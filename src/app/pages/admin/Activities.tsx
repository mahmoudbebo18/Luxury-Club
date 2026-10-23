import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Dropdown } from '../../components/Dropdown';
import { Tabs } from '../../components/Tabs';
import { Alert, TextArea, TextField } from '../../components/Field';
import { ImageField } from '../../components/ImageField';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, fromLocalInput, toLocalInput } from '../../lib/format';
import { removeImage } from '../../lib/upload';
import { CATEGORIES, CATEGORY_AR, CATEGORY_ICON, STATE_AR, STATE_TONE, type ActivityState, type Category } from '../../lib/activities';
import type { Tables } from '../../types/database';

export type AdminActivity = Tables<'admin_activities'>;

export default function Activities() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'current' | 'past'>('current');
  const [editing, setEditing] = useState<AdminActivity | 'new' | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'activities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_activities').select('*').order('starts_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // /admin/activities?new=1 (from the overview) opens the form directly.
  useEffect(() => {
    if (params.get('new')) {
      setEditing('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const isPast = (a: AdminActivity) => a.state === 'ended' || a.state === 'cancelled';
  const all = list.data ?? [];
  const current = all.filter((a) => !isPast(a));
  const past = all.filter(isPast).reverse();
  const shown = tab === 'current' ? current : past;

  return (
    <>
      <AdminTitle
        title="الأنشطة"
        lead="البطولات والفعاليات: أنشئ النشاط وحدد عدد المقاعد، وتابع المسجلين والحضور."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
            <Icon name="plus" />
            نشاط جديد
          </button>
        }
      />
      <div className="settings-tabs">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'current', label: 'الحالية والقادمة', count: current.length }, { value: 'past', label: 'السابقة والملغاة', count: past.length }]} />
      </div>

      {list.isLoading ? (
        <Skeleton rows={2} height={220} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الأنشطة." onRetry={() => list.refetch()} />
      ) : !shown.length ? (
        <div className="surface">
          <EmptyState icon="trophy" title={tab === 'current' ? 'لا توجد أنشطة قادمة' : 'لا توجد أنشطة سابقة'} action={tab === 'current' ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" />نشاط جديد</button> : undefined}>
            {tab === 'current' ? 'أضف بطولة أو فعالية، وتظهر للأعضاء في صفحة الأنشطة ليسجلوا فيها.' : undefined}
          </EmptyState>
        </div>
      ) : (
        <div className="cards cards--wide">
          {shown.map((a, i) => <ActivityAdminCard key={a.id} a={a} i={i} onEdit={() => setEditing(a)} />)}
        </div>
      )}

      {editing && <ActivityForm activity={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function ActivityAdminCard({ a, i, onEdit }: { a: AdminActivity; i: number; onEdit: () => void }) {
  const state = (a.state ?? 'open') as ActivityState;
  const cap = a.capacity ?? 0;
  const taken = a.taken ?? 0;
  const pct = cap ? Math.min(100, (taken / cap) * 100) : 0;
  return (
    <motion.article className={state === 'cancelled' || state === 'ended' ? 'acard acard--admin is-off' : 'acard acard--admin'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
      <Link to={`/admin/activities/${a.id}`} className="acard-media">
        {a.image_url ? <img className="acard-img" src={a.image_url} alt="" loading="lazy" /> : <span className="acard-img acard-img--blank"><Icon name={CATEGORY_ICON[a.category as Category] ?? 'calendar'} /></span>}
        <span className="acard-cat"><Icon name={CATEGORY_ICON[a.category as Category] ?? 'calendar'} />{CATEGORY_AR[a.category as Category]}</span>
      </Link>
      <div className="acard-body">
        <div className="acard-tags">
          <Badge tone={STATE_TONE[state]}>{STATE_AR[state]}</Badge>
          <Badge>{a.mode !== 'team' ? 'فردي' : a.team_min === a.team_max ? `فرق من ${a.team_max}` : `فرق ${a.team_min}–${a.team_max}`}</Badge>
        </div>
        <h3><Link to={`/admin/activities/${a.id}`}>{a.title}</Link></h3>
        <span className="acard-line"><Icon name="calendar" />{formatDateTime(a.starts_at)}</span>
        {a.location && <span className="acard-line"><Icon name="pin" />{a.location}</span>}
        <div className="acard-seats">
          <div className="acard-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} className={taken >= cap ? 'is-full' : undefined} /></div>
          <small>
            <b>{taken}</b> من {cap} {a.mode === 'team' ? 'فريق' : 'مقعد'} · {a.participants} شخص
            {!!a.checked_in && ` · حضر ${a.checked_in}`}
          </small>
        </div>
        <div className="pcard-actions">
          <button type="button" className="btn btn-ghost btn-xs" onClick={onEdit}><Icon name="edit" />تعديل</button>
          <Link className="btn btn-soft btn-xs" to={`/admin/activities/${a.id}`}><Icon name="users" />المسجلون</Link>
        </div>
      </div>
    </motion.article>
  );
}

type Form = {
  title: string;
  category: Category;
  description: string;
  image_url: string | null;
  location: string;
  starts_at: string;
  ends_at: string;
  closes_at: string;
  mode: 'individual' | 'team';
  capacity: string;
  team_min: string;
  team_max: string;
  status: 'draft' | 'published' | 'closed';
};

const toForm = (a: AdminActivity | null): Form => ({
  title: a?.title ?? '',
  category: (a?.category as Category) ?? 'sport',
  description: a?.description ?? '',
  image_url: a?.image_url ?? null,
  location: a?.location ?? '',
  starts_at: toLocalInput(a?.starts_at),
  ends_at: toLocalInput(a?.ends_at),
  closes_at: toLocalInput(a?.registration_closes_at),
  mode: (a?.mode as Form['mode']) ?? 'individual',
  capacity: a?.capacity ? String(a.capacity) : '',
  team_min: a?.team_min ? String(a.team_min) : '5',
  team_max: a?.team_max ? String(a.team_max) : '7',
  status: a?.status === 'draft' || a?.status === 'closed' ? a.status : 'published',
});

/** Create / edit dialog, also used from the activity page. */
export function ActivityForm({ activity, onClose }: { activity: AdminActivity | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(activity));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = activity?.taken ?? 0;
  const cancelled = activity?.status === 'cancelled';

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const capacity = Number(form.capacity);
    const min = Number(form.team_min);
    const max = Number(form.team_max);
    const starts = fromLocalInput(form.starts_at);
    const ends = fromLocalInput(form.ends_at);
    const closes = fromLocalInput(form.closes_at);
    if (form.title.trim().length < 2) return setError('اكتب عنوان النشاط.');
    if (!starts) return setError('حدد موعد بداية النشاط.');
    if (ends && ends <= starts) return setError('موعد النهاية يجب أن يكون بعد البداية.');
    if (closes && closes > starts) return setError('آخر موعد للتسجيل يجب أن يكون قبل بداية النشاط.');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 5000) return setError('عدد المقاعد من 1 إلى 5000.');
    if (capacity < taken) return setError(`العدد لا يمكن أن يكون أقل من المسجلين حاليًا (${taken}).`);
    if (form.mode === 'team' && !(Number.isInteger(min) && Number.isInteger(max) && min >= 1 && max >= min && max <= 30)) return setError('حجم الفريق: الأدنى من 1 والأقصى حتى 30، والأقصى لا يقل عن الأدنى.');
    setBusy(true);
    setError(null);
    const row = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      image_url: form.image_url,
      location: form.location.trim(),
      starts_at: starts,
      ends_at: ends,
      registration_closes_at: closes,
      mode: form.mode,
      capacity,
      team_min: form.mode === 'team' ? min : null,
      team_max: form.mode === 'team' ? max : null,
      ...(cancelled ? {} : { status: form.status }),
    };
    const { error } = activity
      ? await supabase.from('activities').update(row).eq('id', activity.id!)
      : await supabase.from('activities').insert(row);
    setBusy(false);
    if (error) return setError(adminError(error));
    if (activity?.image_url && activity.image_url !== form.image_url) removeImage(activity.image_url);
    toast(activity ? 'تم حفظ التعديلات.' : form.status === 'draft' ? 'حُفظ النشاط كمسودة.' : 'تم نشر النشاط للأعضاء.');
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    onClose();
  };

  return (
    <Modal
      open
      wide
      icon="trophy"
      title={activity ? 'تعديل النشاط' : 'نشاط جديد'}
      onClose={onClose}
      footer={
        <div className="ui-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading}>
            {busy ? <Spinner small /> : <><Icon name="check" />{activity ? 'حفظ' : form.status === 'draft' ? 'حفظ كمسودة' : 'نشر النشاط'}</>}
          </button>
        </div>
      }
    >
      <div className="ui-grid">
        <TextField label="عنوان النشاط" icon="trophy" full placeholder="مثال: بطولة دسمان للبادل" value={form.title} onChange={set('title')} maxLength={120} />
        <div className="ui-field ui-field--full">
          <span className="ui-label">النوع</span>
          <div className="presets" role="radiogroup" aria-label="النوع">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={form.category === c} className={form.category === c ? 'preset is-on' : 'preset'} onClick={() => setForm((f) => ({ ...f, category: c }))}>
                <Icon name={CATEGORY_ICON[c]} />{CATEGORY_AR[c]}
              </button>
            ))}
          </div>
        </div>
        <ImageField label="صورة النشاط" folder="activities" value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} onBusy={setUploading} hint="تظهر في كارت النشاط عند الأعضاء. يفضل صورة عرضية (16:9)." />
        <TextArea label="الوصف" full rows={4} maxLength={3000} placeholder="تفاصيل النشاط، والشروط، وما يحتاج العضو إحضاره…" value={form.description} onChange={set('description')} />
        <TextField label="المكان" icon="pin" full placeholder="مثال: ملاعب بادل الياسمين، الرياض" value={form.location} onChange={set('location')} maxLength={160} />
        <TextField label="يبدأ" icon="calendar" type="datetime-local" dir="ltr" value={form.starts_at} onChange={set('starts_at')} />
        <TextField label="ينتهي" optional="(اختياري)" icon="clock" type="datetime-local" dir="ltr" value={form.ends_at} onChange={set('ends_at')} min={form.starts_at || undefined} />
        <TextField label="آخر موعد للتسجيل" optional="(اختياري)" icon="lock" full type="datetime-local" dir="ltr" value={form.closes_at} onChange={set('closes_at')} max={form.starts_at || undefined} hint="بدونه يبقى التسجيل مفتوحًا حتى بداية النشاط أو اكتمال العدد. الأوقات بتوقيت الرياض." />

        <div className="ui-field ui-field--full">
          <span className="ui-label">طريقة التسجيل</span>
          <div className="choice-row">
            {([['individual', 'user', 'فردي', 'كل عضو يحجز مقعدًا لنفسه'], ['team', 'users', 'فرق', 'القائد يسجّل فريقه بأرقام عضوية زملائه']] as const).map(([v, icon, label, sub]) => (
              <button key={v} type="button" className={form.mode === v ? 'choice is-on' : 'choice'} onClick={() => setForm((f) => ({ ...f, mode: v }))} disabled={!!activity && taken > 0 && activity.mode !== v}>
                <span className="choice-icon"><Icon name={icon} /></span>
                <span><strong>{label}</strong><small>{sub}</small></span>
              </button>
            ))}
          </div>
          {!!activity && taken > 0 && <p className="ui-hint">لا يمكن تغيير طريقة التسجيل بعد وجود مسجلين.</p>}
        </div>

        <TextField label={form.mode === 'team' ? 'عدد الفرق' : 'عدد المقاعد'} icon="hash" type="number" min={Math.max(1, taken)} max={5000} dir="ltr" inputMode="numeric" value={form.capacity} onChange={set('capacity')} full={form.mode !== 'team'} hint={taken ? `المسجلون حاليًا: ${taken}` : 'يقفل التسجيل تلقائيًا عند اكتمال العدد.'} />
        {form.mode === 'team' && (
          <div className="ui-field team-size">
            <span className="ui-label">حجم الفريق (مع القائد)</span>
            <div className="team-size-inputs">
              <input className="ui-input" type="number" min={1} max={30} dir="ltr" inputMode="numeric" value={form.team_min} onChange={set('team_min')} aria-label="الحد الأدنى" />
              <span>إلى</span>
              <input className="ui-input" type="number" min={1} max={30} dir="ltr" inputMode="numeric" value={form.team_max} onChange={set('team_max')} aria-label="الحد الأقصى" />
            </div>
          </div>
        )}

        {cancelled ? (
          <div className="ui-field--full adm-note"><Icon name="info" /><span>النشاط ملغي ولا يظهر في الأنشطة المتاحة.</span></div>
        ) : (
          <div className="ui-field ui-field--full">
            <span className="ui-label">الحالة</span>
            <Dropdown
              block
              icon="eye"
              placeholder="الحالة"
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v as Form['status'] }))}
              options={[
                { value: 'published', label: 'منشور: يظهر للأعضاء والتسجيل متاح', hint: 'يقفل تلقائيًا عند اكتمال العدد' },
                { value: 'closed', label: 'منشور والتسجيل مغلق يدويًا', hint: 'يظهر للأعضاء بدون زر تسجيل' },
                { value: 'draft', label: 'مسودة: لا يظهر للأعضاء', hint: 'للتجهيز قبل الإعلان' },
              ]}
            />
          </div>
        )}
        <AnimatePresence>{error && <div className="ui-field--full"><Alert tone="error">{error}</Alert></div>}</AnimatePresence>
      </div>
    </Modal>
  );
}
