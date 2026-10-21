import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { AssignModal } from './AssignModal';
import { CampaignModal } from './CampaignModal';
import { adminError, type AdminMember } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { STUDY_YEARS, UNIVERSITIES } from '../../lib/options';
import { formatDate, formatDateTime, formatMoney, type MembershipStatus } from '../../lib/format';

const COUPON_STATUS: Record<string, { label: string; tone: 'active' | 'expired' | 'suspended' | 'neutral' }> = {
  assigned: { label: 'متاح', tone: 'active' },
  redeemed: { label: 'مستخدم', tone: 'neutral' },
  void: { label: 'ملغي', tone: 'suspended' },
};

type EditForm = Pick<AdminMember, 'full_name' | 'university' | 'study_year' | 'district' | 'phone' | 'notes' | 'email'>;

export default function MemberDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
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
  if (!m) return <EmptyState icon="user">العضو غير موجود.</EmptyState>;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const run = async (key: string, fn: () => Promise<{ error: unknown }>, ok: string) => {
    setBusy(key);
    const { error } = await fn();
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast(ok);
    refresh();
  };

  const renew = () =>
    run('renew', async () => supabase.rpc('admin_renew_membership', { p_member_id: m.id! }), 'تم تجديد العضوية سنة إضافية.');
  const setActive = (active: boolean) =>
    run('active', async () => supabase.rpc('admin_set_active', { p_member_id: m.id!, p_active: active }), active ? 'تمت إعادة تفعيل العضوية.' : 'تم إيقاف العضوية.');
  const sendReset = () =>
    run('reset', async () => supabase.auth.resetPasswordForEmail(m.email!, { redirectTo: `${location.origin}/reset` }), 'أُرسل رابط تعيين كلمة المرور إلى العضو.');

  const openEdit = () => {
    setForm({ full_name: m.full_name, university: m.university, study_year: m.study_year, district: m.district, phone: m.phone, notes: m.notes, email: m.email });
    setFormError(null);
    setModal('edit');
  };

  const saveEdit = async () => {
    if (!form) return;
    setBusy('edit');
    setFormError(null);
    try {
      const email = form.email?.trim().toLowerCase();
      if (email && email !== m.email) {
        // Auth email changes need the service role: done by the admin-users Edge Function.
        const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'update_email', user_id: m.id, email } });
        if (error || data?.error) throw new Error(data?.error === 'email_exists' ? 'هذا البريد مستخدم لعضو آخر.' : 'تعذّر تغيير البريد.');
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

  return (
    <>
      <Link className="back-link" to="/admin/members">
        <Icon name="arrow" className="icon-back" />
        الأعضاء
      </Link>
      <AdminTitle
        title={m.full_name || '—'}
        lead={`${m.member_label} · ${m.role === 'admin' ? 'أدمن' : 'عضو'}`}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openEdit}><Icon name="edit" />تعديل</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('email')}><Icon name="mail" />إرسال بريد</button>
          </>
        }
      />

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head"><h2>البيانات</h2><StatusBadge status={status} /></div>
          <dl className="detail-list">
            <div><dt>البريد الإلكتروني</dt><dd dir="ltr">{m.email}</dd></div>
            <div><dt>الهاتف</dt><dd dir="ltr">{m.phone || '—'}</dd></div>
            <div><dt>الجامعة</dt><dd>{m.university || '—'}</dd></div>
            <div><dt>السنة الدراسية</dt><dd>{m.study_year || '—'}</dd></div>
            <div><dt>الحي</dt><dd>{m.district || '—'}</dd></div>
            <div><dt>تاريخ التسجيل</dt><dd>{formatDate(m.joined_at)}</dd></div>
            <div><dt>تاريخ الانتهاء</dt><dd>{formatDate(m.expires_at)}</dd></div>
            <div><dt>كود العضو</dt><dd dir="ltr" className="cell-mono">{m.member_code}</dd></div>
            {m.notes && <div className="detail-full"><dt>ملاحظات</dt><dd>{m.notes}</dd></div>}
          </dl>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>العضوية</h2></div>
          <div className="action-list">
            <button type="button" className="btn btn-primary btn-block" onClick={renew} disabled={!!busy}>
              {busy === 'renew' ? <Spinner small /> : <Icon name="refresh" />}
              تجديد سنة
            </button>
            {m.is_active ? (
              <button type="button" className="btn btn-ghost btn-block btn-danger" onClick={() => confirm('إيقاف عضوية هذا العضو؟ لن تظهر كوبوناته عند المسح.') && setActive(false)} disabled={!!busy}>
                {busy === 'active' ? <Spinner small /> : <Icon name="lock" />}
                إيقاف العضوية
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setActive(true)} disabled={!!busy}>
                {busy === 'active' ? <Spinner small /> : <Icon name="check" />}
                إعادة التفعيل
              </button>
            )}
            <button type="button" className="btn btn-gold btn-block" onClick={() => setModal('assign')} disabled={!!busy}>
              <Icon name="ticket" />
              إعطاء كوبون
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={sendReset} disabled={!!busy}>
              {busy === 'reset' ? <Spinner small /> : <Icon name="lock" />}
              إرسال رابط تعيين كلمة المرور
            </button>
            <a className="btn btn-ghost btn-block" href={`/m/${m.member_code}`} target="_blank" rel="noopener">
              <Icon name="qr" />
              فتح صفحة المسح
            </a>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>الكوبونات</h2></div>
        {coupons.isLoading ? (
          <PageLoader />
        ) : !coupons.data?.length ? (
          <EmptyState>لا توجد كوبونات لهذا العضو.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>الكود</th><th>الكوبون</th><th>الكافيه</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {coupons.data.map((c) => {
                  const b = c.coupon_batches;
                  const expired = c.status === 'assigned' && b?.expires_at && new Date(b.expires_at) <= new Date();
                  const st = expired ? { label: 'منتهي', tone: 'expired' as const } : COUPON_STATUS[c.status];
                  return (
                    <tr key={c.id}>
                      <td dir="ltr" className="cell-mono">{c.code}</td>
                      <td>{b?.title}</td>
                      <td>{b?.partners?.name}</td>
                      <td>{formatMoney(b?.value_sar ?? 0)} ريال</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td>{c.status === 'redeemed' ? formatDateTime(c.redeemed_at) : formatDate(c.assigned_at)}</td>
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
        title="تعديل بيانات العضو"
        onClose={() => setModal(null)}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={saveEdit} disabled={busy === 'edit'}>
            {busy === 'edit' ? <Spinner small /> : 'حفظ'}
          </button>
        }
      >
        {form && (
          <div className="form-grid">
            <div className="field field--full"><label htmlFor="eName">الاسم</label><input id="eName" value={form.full_name ?? ''} onChange={set('full_name')} /></div>
            <div className="field field--full">
              <label htmlFor="eEmail">البريد الإلكتروني</label>
              <input id="eEmail" type="email" dir="ltr" value={form.email ?? ''} onChange={set('email')} />
              <span className="field-hint">تغيير البريد يغيّر بريد الدخول أيضًا.</span>
            </div>
            <div className="field">
              <label htmlFor="eUni">الجامعة</label>
              <input id="eUni" list="eUniList" value={form.university ?? ''} onChange={set('university')} />
              <datalist id="eUniList">{UNIVERSITIES.map((u) => <option key={u} value={u} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="eYear">السنة الدراسية</label>
              <select id="eYear" value={form.study_year ?? ''} onChange={set('study_year')}>
                <option value="">—</option>
                {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.value}</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="eDistrict">الحي</label><input id="eDistrict" value={form.district ?? ''} onChange={set('district')} /></div>
            <div className="field"><label htmlFor="ePhone">الهاتف</label><input id="ePhone" dir="ltr" value={form.phone ?? ''} onChange={set('phone')} /></div>
            <div className="field field--full"><label htmlFor="eNotes">ملاحظات</label><textarea id="eNotes" rows={3} value={form.notes ?? ''} onChange={set('notes')} /></div>
            {formError && <div className="form-status is-error field--full">{formError}</div>}
          </div>
        )}
      </Modal>
    </>
  );
}
