import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { AssignModal, type Target } from './AssignModal';
import { adminError, describeFilter, memberQuery, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { endOfDayRiyadh, formatDate, formatMoney } from '../../lib/format';

export default function Coupons() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ partner: '', title: '', value: '', quantity: '', expires: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assign, setAssign] = useState<{ batchId: string; target: Target } | null>(null);
  const [audienceFor, setAudienceFor] = useState<string | null>(null);

  const batches = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_batches').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_partners').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    const value = Number(form.value);
    const quantity = Number(form.quantity);
    if (!form.partner || !form.title.trim()) return setError('اختر الكافيه واكتب عنوان الكوبون.');
    if (!(value > 0)) return setError('اكتب قيمة صحيحة.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5000) return setError('العدد من 1 إلى 5000.');
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('admin_create_batch', {
      p_partner_id: form.partner,
      p_title: form.title,
      p_value: value,
      p_quantity: quantity,
      p_expires_at: form.expires ? endOfDayRiyadh(form.expires) : (null as unknown as string),
    });
    setBusy(false);
    if (error) return setError(adminError(error));
    toast(`تم إنشاء ${quantity} كوبون.`);
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    setCreating(false);
    setForm({ partner: '', title: '', value: '', quantity: '', expires: '' });
  };

  // Pick who receives coupons from a batch: all active members, everyone, or a status filter.
  const chooseAudience = async (batchId: string, filter: MemberFilter) => {
    const { count, error } = await memberQuery('id', filter, 'exact').limit(1);
    if (error) return toast('تعذّر حساب عدد الأعضاء.', 'error');
    setAudienceFor(null);
    setAssign({ batchId, target: { filter, label: describeFilter(filter), count: count ?? 0 } });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <AdminTitle
        title="الكوبونات"
        lead="أنشئ دفعة كوبونات لكافيه، ثم وزّعها على الأعضاء. لتوزيع على أعضاء محددين اخترهم من صفحة الأعضاء."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setCreating(true); setError(null); }} disabled={!partners.data?.length}>
            <Icon name="plus" />
            دفعة جديدة
          </button>
        }
      />
      {partners.data && partners.data.length === 0 && <p className="admin-note">أضف كافيه أولًا من صفحة الكافيهات.</p>}

      {batches.isLoading ? (
        <PageLoader />
      ) : batches.isError ? (
        <ErrorState message="تعذّر تحميل الدفعات." onRetry={() => batches.refetch()} />
      ) : !batches.data?.length ? (
        <EmptyState>لا توجد دفعات كوبونات بعد.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>الدفعة</th><th>الكافيه</th><th>القيمة</th><th>العدد</th><th>متبقي</th><th>موزع</th><th>مصروف</th><th>الانتهاء</th><th /></tr>
            </thead>
            <tbody>
              {batches.data.map((b) => {
                const expired = b.expires_at && new Date(b.expires_at) <= new Date();
                return (
                  <tr key={b.id}>
                    <td className="cell-strong">{b.title}</td>
                    <td>{b.partner_name}</td>
                    <td>{formatMoney(b.value_sar ?? 0)} ريال</td>
                    <td>{b.quantity}</td>
                    <td>{b.remaining}</td>
                    <td>{b.assigned}</td>
                    <td>{b.redeemed}</td>
                    <td>{b.expires_at ? formatDate(b.expires_at) : 'بدون'}{expired && <Badge tone="expired">منتهية</Badge>}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-gold btn-sm" disabled={!b.remaining || !!expired} onClick={() => setAudienceFor(b.id!)}>
                        <Icon name="users" />توزيع
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!audienceFor} title="توزيع على" onClose={() => setAudienceFor(null)}>
        <div className="choice-list">
          <button type="button" className="choice" onClick={() => chooseAudience(audienceFor!, { status: 'active' })}>
            <strong>كل الأعضاء الساريين</strong>
            <span>كل عضو عضويته سارية يحصل على كوبون.</span>
          </button>
          <Link className="choice" to="/admin/members?status=active">
            <strong>أعضاء محددون</strong>
            <span>اختر الأعضاء من صفحة الأعضاء ثم «توزيع كوبونات».</span>
          </Link>
        </div>
      </Modal>

      {assign && <AssignModal open onClose={() => setAssign(null)} target={assign.target} batchId={assign.batchId} />}

      <Modal
        open={creating}
        title="دفعة كوبونات جديدة"
        onClose={() => setCreating(false)}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={create} disabled={busy}>
            {busy ? <Spinner small /> : 'إنشاء الكوبونات'}
          </button>
        }
      >
        <div className="form-grid">
          <div className="field field--full">
            <label htmlFor="bPartner">الكافيه</label>
            <select id="bPartner" value={form.partner} onChange={set('partner')}>
              <option value="" disabled>اختر الكافيه</option>
              {partners.data?.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id!}>{p.name}</option>)}
            </select>
          </div>
          <div className="field field--full">
            <label htmlFor="bTitle">عنوان الكوبون</label>
            <input id="bTitle" placeholder="مثال: خصم 50 ريال على أي طلب" value={form.title} onChange={set('title')} maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="bValue">القيمة (ريال)</label>
            <input id="bValue" type="number" min="1" step="0.5" dir="ltr" value={form.value} onChange={set('value')} />
          </div>
          <div className="field">
            <label htmlFor="bQty">عدد الكوبونات</label>
            <input id="bQty" type="number" min="1" max="5000" dir="ltr" value={form.quantity} onChange={set('quantity')} />
          </div>
          <div className="field field--full">
            <label htmlFor="bExp">تاريخ الانتهاء (اختياري)</label>
            <input id="bExp" type="date" dir="ltr" value={form.expires} onChange={set('expires')} />
          </div>
          {error && <div className="form-status is-error field--full">{error}</div>}
        </div>
      </Modal>
    </>
  );
}
