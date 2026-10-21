import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { endOfDayRiyadh, formatDateTime, formatMoney, isoDay, startOfDayRiyadh } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

export default function Redemptions() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [partner, setPartner] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_partners').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const query = (columns = '*', count?: 'exact') => {
    let q = supabase.from('admin_redemptions').select(columns, count ? { count } : undefined);
    if (partner) q = q.eq('partner_id', partner);
    if (from) q = q.gte('redeemed_at', startOfDayRiyadh(from));
    if (to) q = q.lte('redeemed_at', endOfDayRiyadh(to));
    return q.order('redeemed_at', { ascending: false });
  };

  const list = useQuery({
    queryKey: ['admin', 'redemptions', partner, from, to, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await query('*', 'exact').range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data as unknown as RedemptionRow[], count: count ?? 0 };
    },
  });

  const voidOne = async (id: string) => {
    if (!confirm('إلغاء عملية الصرف؟ سيعود الكوبون متاحًا للعضو.')) return;
    setBusy(id);
    const { error } = await supabase.rpc('admin_void_redemption', { p_redemption_id: id });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast('أُلغيت عملية الصرف وعاد الكوبون للعضو.');
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const exportAll = async () => {
    setBusy('export');
    try {
      const rows: RedemptionRow[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await query().range(start, start + 999);
        if (error) throw error;
        rows.push(...(data as unknown as RedemptionRow[]));
        if (data.length < 1000) break;
      }
      const partnerName = partners.data?.find((p) => p.id === partner)?.name;
      await exportExcel(
        `dasman-redemptions${partnerName ? '-' + partnerName : ''}-${isoDay(new Date().toISOString())}`,
        'سجل الصرف',
        rows.map((r) => ({
          'التاريخ والوقت': formatDateTime(r.redeemed_at),
          الكافيه: r.partner_name,
          'رقم العضوية': r.member_label ?? '',
          العضو: r.member_name ?? '',
          الكوبون: r.coupon_title,
          'كود الكوبون': r.coupon_code,
          'القيمة (ريال)': Number(r.value_sar),
          الحالة: r.voided_at ? `ملغاة (${formatDateTime(r.voided_at)})` : 'مصروف',
        })),
      );
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const pages = Math.ceil(total / PAGE);

  return (
    <>
      <AdminTitle
        title="سجل الصرف"
        lead="كل عملية صرف تمت من صفحة المسح. الكافيه يحاسب دسمان على هذا السجل فقط."
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll} disabled={busy === 'export' || !total}>
            {busy === 'export' ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        }
      />
      <div className="filters">
        <select value={partner} onChange={(e) => { setPartner(e.target.value); setPage(0); }} aria-label="الكافيه">
          <option value="">كل الكافيهات</option>
          {partners.data?.map((p) => <option key={p.id} value={p.id!}>{p.name}</option>)}
        </select>
        <label className="date-filter">من <input type="date" dir="ltr" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} /></label>
        <label className="date-filter">إلى <input type="date" dir="ltr" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} /></label>
      </div>

      {list.isLoading ? (
        <PageLoader />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل السجل." onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="list">لا توجد عمليات صرف مطابقة.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>الوقت</th><th>الكافيه</th><th>العضو</th><th>الكوبون</th><th>القيمة</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.voided_at ? 'is-voided' : undefined}>
                  <td>{formatDateTime(r.redeemed_at)}</td>
                  <td>{r.partner_name}</td>
                  <td>
                    {r.member_id ? <Link to={`/admin/members/${r.member_id}`}>{r.member_name}</Link> : '—'}
                    <small className="cell-sub" dir="ltr">{r.member_label}</small>
                  </td>
                  <td>{r.coupon_title}<small className="cell-sub" dir="ltr">{r.coupon_code}</small></td>
                  <td>{formatMoney(r.value_sar)} ريال</td>
                  <td>{r.voided_at ? <Badge tone="suspended">ملغاة</Badge> : <Badge tone="active">مصروف</Badge>}</td>
                  <td className="cell-actions">
                    {!r.voided_at && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => voidOne(r.id)} disabled={busy === r.id}>
                        {busy === r.id ? <Spinner small /> : <Icon name="undo" />}
                        إلغاء
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="pager">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button>
          <span>صفحة {page + 1} من {pages}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>التالي</button>
        </div>
      )}
    </>
  );
}

type RedemptionRow = {
  id: string;
  redeemed_at: string;
  voided_at: string | null;
  partner_id: string;
  member_id: string | null;
  partner_name: string;
  coupon_code: string;
  coupon_title: string;
  value_sar: number;
  member_name: string | null;
  member_label: string | null;
};
