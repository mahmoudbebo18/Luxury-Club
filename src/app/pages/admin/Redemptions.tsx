import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, Pager, StatCard } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { useConfirm } from '../../components/Modal';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { endOfDayRiyadh, formatDateTime, formatMoney, isoDay, startOfDayRiyadh } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

export default function Redemptions() {
  const toast = useToast();
  const confirm = useConfirm();
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

  // Totals for the current filter (what the café bills Dasman for).
  const totals = useQuery({
    queryKey: ['admin', 'redemptions', 'totals', partner, from, to],
    queryFn: async () => {
      const { data, error } = await query('value_sar, voided_at').range(0, 9999);
      if (error) throw error;
      const rows = data as unknown as { value_sar: number; voided_at: string | null }[];
      const valid = rows.filter((r) => !r.voided_at);
      return { count: valid.length, sum: valid.reduce((s, r) => s + Number(r.value_sar), 0), voided: rows.length - valid.length };
    },
  });

  const voidOne = async (r: RedemptionRow) => {
    const ok = await confirm({
      title: 'إلغاء عملية الصرف؟',
      message: <>سيعود كوبون «{r.coupon_title}» متاحًا لـ <b>{r.member_name}</b>، ويُسجَّل الإلغاء في السجل.</>,
      confirm: 'إلغاء الصرف',
      cancel: 'تراجع',
      danger: true,
    });
    if (!ok) return;
    setBusy(r.id);
    const { error } = await supabase.rpc('admin_void_redemption', { p_redemption_id: r.id });
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
  const filtered = !!(partner || from || to);
  const reset = () => {
    setPartner('');
    setFrom('');
    setTo('');
    setPage(0);
  };

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

      <div className="toolbar">
        <Dropdown
          label="الكافيه"
          icon="store"
          placeholder="كل الكافيهات"
          value={partner}
          onChange={(v) => { setPartner(v); setPage(0); }}
          options={[{ value: '', label: 'كل الكافيهات' }, ...(partners.data ?? []).map((p) => ({ value: p.id!, label: p.name! }))]}
        />
        <label className="date-pill">
          <span>من</span>
          <input type="date" dir="ltr" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </label>
        <label className="date-pill">
          <span>إلى</span>
          <input type="date" dir="ltr" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </label>
        {filtered && (
          <button type="button" className="btn btn-xs btn-soft" onClick={reset}>
            <Icon name="close" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {totals.data && (
        <div className="stats stats--3">
          <StatCard icon="check-circle" tone="green" label="عمليات صرف" value={totals.data.count.toLocaleString('en-US')} />
          <StatCard icon="wallet" tone="gold" label="إجمالي الخصومات" value={<>{formatMoney(totals.data.sum)} <small>ريال</small></>} />
          <StatCard icon="undo" tone="red" label="ملغاة" value={totals.data.voided.toLocaleString('en-US')} />
        </div>
      )}

      {list.isLoading ? (
        <Skeleton rows={5} height={56} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل السجل." onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState icon="history" title="لا توجد عمليات صرف" action={filtered ? <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>مسح الفلاتر</button> : undefined}>
            {filtered ? 'لا شيء مطابق لهذه الفلاتر.' : 'تظهر هنا كل عملية صرف يقوم بها الكاشير.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-card">
          <table className="dtable">
            <thead><tr><th>العضو</th><th>الكوبون</th><th>الكافيه</th><th>الوقت</th><th>القيمة</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.voided_at ? 'is-voided' : undefined}>
                  <td className="cell-title">
                    {r.member_id ? <Link className="cell-strong" to={`/admin/members/${r.member_id}`}>{r.member_name}</Link> : '—'}
                    <small className="cell-sub mono" dir="ltr">{r.member_label}</small>
                  </td>
                  <td data-label="الكوبون">{r.coupon_title}<small className="cell-sub mono" dir="ltr">{r.coupon_code}</small></td>
                  <td data-label="الكافيه">{r.partner_name}</td>
                  <td data-label="الوقت">{formatDateTime(r.redeemed_at)}</td>
                  <td data-label="القيمة"><b>{formatMoney(r.value_sar)}</b> ريال</td>
                  <td data-label="الحالة">{r.voided_at ? <Badge tone="suspended">ملغاة</Badge> : <Badge tone="active">مصروف</Badge>}</td>
                  <td className="cell-actions">
                    {!r.voided_at && (
                      <button type="button" className="btn btn-ghost btn-xs btn-danger-text" onClick={() => voidOne(r)} disabled={busy === r.id}>
                        {busy === r.id ? <Spinner small /> : <Icon name="undo" />}
                        إلغاء
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
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
