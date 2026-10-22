import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { AssignModal } from './AssignModal';
import { CampaignModal } from './CampaignModal';
import { adminError, type AdminMember } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { Alert, SelectField, TextArea, TextField } from '../../components/Field';
import { Badge, StatusBadge, type Tone } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { STUDY_YEARS } from '../../lib/options';
import { daysLeft, formatDate, formatDateTime, formatMoney, type MembershipStatus } from '../../lib/format';

const COUPON_STATUS: Record<string, { label: string; tone: Tone }> = {
  assigned: { label: 'متاح', tone: 'active' },
  redeemed: { label: 'مستخدم', tone: 'neutral' },
  void: { label: 'ملغي', tone: 'suspended' },
};

type EditForm = Pick<AdminMember, 'full_name' | 'university' | 'study_year' | 'district' | 'phone' | 'notes' | 'email'>;

export default function MemberDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'assign' | 'email' | 'edit' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const member = useQuery({
    queryKey: ['admin', 'member', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_members').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const coupons = useQuery({
    queryKey: ['admin', 'member', id, 'coupons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, status, assigned_at, redeemed_at, coupon_batches(title, value_sar, expires_at, partners(name))')
        .eq('member_id', id)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (member.isLoading) return <PageLoader />;
  if (member.isError) return <ErrorState message="تعذّر تحميل العضو." onRetry={() => member.refetch()} />;
  const m = member.data;
  if (!m) return <EmptyState icon="user" title="العضو غير موجود" />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const run = async (key: string, fn: () => Promise<{ error: unknown }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast(ok);
    refresh();
  };

  const renew = async () => {
    if (!(await confirm({ title: 'تجديد العضوية', message: m.is_trial ? `تتحول عضوية ${m.full_name} من تجريبية إلى عضوية كاملة، وتُضاف سنة.` : `تُضاف سنة كاملة إلى عضوية ${m.full_name}.`, confirm: 'تجديد سنة', icon: 'refresh' }))) return;
    run('renew', async () => supabase.rpc('admin_renew_membership', { p_member_id: m.id! }), 'تم تجديد العضوية سنة إضافية.');
  };
  const setActive = async (active: boolean) => {
    if (!active && !(await confirm({ title: 'إيقاف العضوية؟', message: 'لن تظهر كوبونات العضو عند المسح، ولن يستطيع الصرف حتى تعيد تفعيله.', confirm: 'إيقاف العضوية', danger: true }))) return;
    run('active', async () => supabase.rpc('admin_set_active', { p_member_id: m.id!, p_active: active }), active ? 'تمت إعادة تفعيل العضوية.' : 'تم إيقاف العضوية.');
  };
  const sendReset = async () => {
    if (!(await confirm({ title: 'إرسال رابط كلمة المرور', message: <>سيصل رابط تعيين كلمة مرور جديدة إلى <b dir="ltr">{m.email}</b>.</>, confirm: 'إرسال الرابط', icon: 'key' }))) return;
    run('reset', async () => supabase.auth.resetPasswordForEmail(m.email!, { redirectTo: `${location.origin}/reset` }), 'أُرسل رابط تعيين كلمة المرور إلى العضو.');
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(m.member_code ?? '');
      toast('تم نسخ كود العضو.');
    } catch {
      /* clipboard blocked */
    }
  };

  const openEdit = () => {
    setForm({ full_name: m.full_name, university: m.university, study_year: m.study_year, district: m.district, phone: m.phone, notes: m.notes, email: m.email });
    setFormError(null);
    setModal('edit');
  };

  const saveEdit = async () => {
    if (!form) return;
    if (!form.full_name?.trim()) return setFormError('اكتب اسم العضو.');
    setBusy('edit');
    setFormError(null);
    try {
      const email = form.email?.trim().toLowerCase();
      if (email && email !== m.email) {
        // Auth email changes need the service role: done by the admin-users Edge Function.
        const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'update_email', user_id: m.id, email } });
        if (error || data?.error) throw new Error(data?.error === 'email_exists' ? 'هذا البريد مستخدم لعضو آخر.' : data?.error === 'invalid_email' ? 'البريد غير صحيح.' : 'تعذّر تغيير البريد.');
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name?.trim(),
          university: form.university?.trim(),
          study_year: form.study_year ?? '',
          district: form.district?.trim(),
          phone: form.phone?.trim(),
          notes: form.notes?.trim() || null,
        })
        .eq('id', m.id!);
      if (error) throw new Error('تعذّر حفظ البيانات.');
      toast('تم حفظ بيانات العضو.');
      setModal(null);
      refresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const status = m.status as MembershipStatus;
  const set = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  const joined = new Date(m.joined_at!).getTime();
  const expires = new Date(m.expires_at!).getTime();
  const progress = Math.min(100, Math.max(0, ((Date.now() - joined) / (expires - joined)) * 100));
  const left = daysLeft(m.expires_at!);

  return (
    <>
      <AdminTitle
        back={{ to: '/admin/members', label: 'الأعضاء' }}
        title={m.full_name || '—'}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openEdit}><Icon name="edit" />تعديل</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('email')}><Icon name="send" />إرسال بريد</button>
          </>
        }
      />

      <motion.section className="member-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="avatar avatar--xl">{(m.full_name || '؟').trim().charAt(0)}</span>
        <div className="member-hero-main">
          <div className="member-hero-tags">
            <StatusBadge status={status} />
            {m.is_trial && status === 'active' && <Badge tone="gold">تجريبية</Badge>}
            {m.role === 'admin' && <Badge tone="gold">أدمن</Badge>}
            <span className="tag mono" dir="ltr">{m.member_label}</span>
          </div>
          <p>{[m.university, m.study_year].filter(Boolean).join(' · ') || '—'}</p>
          <div className="member-hero-bar">
            <div className="bar"><motion.span initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, delay: 0.2 }} className={`is-${status}`} /></div>
            <div className="member-hero-dates">
              <span>من {formatDate(m.joined_at)}</span>
              <b>{status === 'expired' ? 'منتهية' : `${left} يوم متبقٍ`}</b>
              <span>إلى {formatDate(m.expires_at)}</span>
            </div>
          </div>
        </div>
      </motion.section>

      <div className="adm-grid-2 adm-grid-2--detail">
        <section className="surface">
          <h2 className="surface-title"><Icon name="user" />البيانات</h2>
          <dl className="facts">
            <div><dt><Icon name="mail" />البريد</dt><dd dir="ltr">{m.email}</dd></div>
            <div><dt><Icon name="phone" />الجوال</dt><dd dir="ltr">{m.phone ? <a href={`https://wa.me/${m.phone.replace(/^0/, '966').replace(/^\+/, '')}`} target="_blank" rel="noopener">{m.phone}</a> : '—'}</dd></div>
            <div><dt><Icon name="cap" />الجامعة</dt><dd>{m.university || '—'}</dd></div>
            <div><dt><Icon name="calendar" />السنة</dt><dd>{m.study_year || '—'}</dd></div>
            <div><dt><Icon name="pin" />الحي</dt><dd>{m.district || '—'}</dd></div>
            <div>
              <dt><Icon name="qr" />كود العضو</dt>
              <dd>
                <button type="button" className="code-copy mono" dir="ltr" onClick={copyCode} title="نسخ">
                  {m.member_code}
                  <Icon name="copy" />
                </button>
              </dd>
            </div>
            {m.notes && <div className="facts-full"><dt><Icon name="file" />ملاحظات</dt><dd>{m.notes}</dd></div>}
          </dl>
        </section>

        <section className="surface">
          <h2 className="surface-title"><Icon name="settings" />الإجراءات</h2>
          <div className="actions-list">
            <button type="button" onClick={renew} disabled={!!busy}>
              <span className="al-icon al-icon--green">{busy === 'renew' ? <Spinner small /> : <Icon name="refresh" />}</span>
              <span><strong>{m.is_trial ? 'تفعيل سنة كاملة' : 'تجديد سنة'}</strong><small>{m.is_trial ? 'تنتهي التجربة وتُضاف سنة كاملة' : 'تمديد الانتهاء سنة كاملة'}</small></span>
            </button>
            <button type="button" onClick={() => setModal('assign')} disabled={!!busy}>
              <span className="al-icon al-icon--gold"><Icon name="ticket" /></span>
              <span><strong>إعطاء كوبون</strong><small>من دفعة بها كوبونات متبقية</small></span>
            </button>
            <button type="button" onClick={sendReset} disabled={!!busy}>
              <span className="al-icon">{busy === 'reset' ? <Spinner small /> : <Icon name="key" />}</span>
              <span><strong>رابط تعيين كلمة المرور</strong><small>يصل إلى بريد العضو</small></span>
            </button>
            <a href={`/m/${m.member_code}`} target="_blank" rel="noopener">
              <span className="al-icon"><Icon name="qr" /></span>
              <span><strong>صفحة المسح</strong><small>كما يراها الكاشير</small></span>
            </a>
            {m.is_active ? (
              <button type="button" className="is-danger" onClick={() => setActive(false)} disabled={!!busy}>
                <span className="al-icon al-icon--red">{busy === 'active' ? <Spinner small /> : <Icon name="lock" />}</span>
                <span><strong>إيقاف العضوية</strong><small>تتوقف الكوبونات والصرف</small></span>
              </button>
            ) : (
              <button type="button" onClick={() => setActive(true)} disabled={!!busy}>
                <span className="al-icon al-icon--green">{busy === 'active' ? <Spinner small /> : <Icon name="check" />}</span>
                <span><strong>إعادة التفعيل</strong><small>تعود العضوية سارية</small></span>
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="ticket" />الكوبونات</h2>
          <span className="muted">{coupons.data?.length ?? 0} كوبون</span>
        </div>
        {coupons.isLoading ? (
          <Skeleton rows={3} height={48} />
        ) : !coupons.data?.length ? (
          <EmptyState action={<button type="button" className="btn btn-gold btn-sm" onClick={() => setModal('assign')}><Icon name="ticket" />إعطاء كوبون</button>}>
            لا توجد كوبونات لهذا العضو.
          </EmptyState>
        ) : (
          <div className="table-card table-card--flat">
            <table className="dtable">
              <thead><tr><th>الكوبون</th><th>الكافيه</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {coupons.data.map((c) => {
                  const b = c.coupon_batches;
                  const expired = c.status === 'assigned' && b?.expires_at && new Date(b.expires_at) <= new Date();
                  const st = expired ? { label: 'منتهي', tone: 'expired' as const } : COUPON_STATUS[c.status];
                  return (
                    <tr key={c.id}>
                      <td className="cell-title"><span className="cell-strong">{b?.title}</span><small className="cell-sub mono" dir="ltr">{c.code}</small></td>
                      <td data-label="الكافيه">{b?.partners?.name}</td>
                      <td data-label="القيمة">{formatMoney(b?.value_sar ?? 0)} ريال</td>
                      <td data-label="الحالة"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td data-label="التاريخ">{c.status === 'redeemed' ? formatDateTime(c.redeemed_at) : formatDate(c.assigned_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} target={{ ids: [m.id!], label: m.full_name ?? '', count: 1 }} />
      <CampaignModal open={modal === 'email'} onClose={() => setModal(null)} target={{ ids: [m.id!], label: m.full_name ?? '', count: 1 }} />

      <Modal
        open={modal === 'edit'}
        wide
        icon="edit"
        title="تعديل بيانات العضو"
        onClose={() => setModal(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={busy === 'edit'}>
              {busy === 'edit' ? <Spinner small /> : <><Icon name="check" />حفظ</>}
            </button>
          </div>
        }
      >
        {form && (
          <div className="ui-grid">
            <TextField label="الاسم" icon="user" full value={form.full_name ?? ''} onChange={set('full_name')} />
            <TextField label="البريد الإلكتروني" icon="mail" full type="email" dir="ltr" value={form.email ?? ''} onChange={set('email')} hint="تغيير البريد يغيّر بريد الدخول أيضًا." />
            <TextField label="الجامعة" icon="cap" value={form.university ?? ''} onChange={set('university')} />
            <SelectField label="السنة الدراسية" icon="calendar" value={form.study_year ?? ''} onChange={set('study_year')}>
              <option value="">—</option>
              {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.value}</option>)}
            </SelectField>
            <TextField label="الحي" icon="pin" value={form.district ?? ''} onChange={set('district')} />
            <TextField label="الجوال" icon="phone" dir="ltr" type="tel" value={form.phone ?? ''} onChange={set('phone')} />
            <TextArea label="ملاحظات" full rows={3} value={form.notes ?? ''} onChange={set('notes')} />
            <AnimatePresence>{formError && <div className="ui-field--full"><Alert tone="error">{formError}</Alert></div>}</AnimatePresence>
          </div>
        )}
      </Modal>
    </>
  );
}
