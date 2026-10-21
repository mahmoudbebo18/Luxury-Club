import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AdminTitle } from './AdminLayout';
import { AssignModal, type Target } from './AssignModal';
import { CampaignModal } from './CampaignModal';
import { describeFilter, memberQuery, STATUS_LABELS, universities, type AdminMember, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { STUDY_YEARS } from '../../lib/options';
import { formatDate, isoDay, type MembershipStatus } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

export default function Members() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const filter: MemberFilter = {
    q: params.get('q') ?? '',
    university: params.get('university') ?? '',
    year: params.get('year') ?? '',
    status: (params.get('status') as MemberFilter['status']) ?? '',
  };
  const page = Number(params.get('page') ?? 0);
  const [search, setSearch] = useState(filter.q ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [modal, setModal] = useState<'assign' | 'email' | null>(null);
  const [exporting, setExporting] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounced search box → URL
  useEffect(() => {
    const timer = setTimeout(() => search !== (filter.q ?? '') && setParam('q', search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [filterKey]);

  const unis = useQuery({ queryKey: ['admin', 'universities'], queryFn: universities });
  const list = useQuery({
    queryKey: ['admin', 'members', filterKey, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await memberQuery('*', filter, 'exact')
        .order('member_no', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (error) throw error;
      return { rows: data as unknown as AdminMember[], count: count ?? 0 };
    },
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.count ?? 0;
  const pageIds = rows.map((r) => r.id!);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const target: Target | null = useMemo(() => {
    if (allMatching) return { filter, label: describeFilter(filter), count: total };
    if (selected.size) return { ids: [...selected], label: `${selected.size} عضو محدد`, count: selected.size };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatching, selected, filterKey, total]);

  const toggle = (id: string) => {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const togglePage = () => {
    setAllMatching(false);
    setSelected((s) => {
      const n = new Set(s);
      pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id)));
      return n;
    });
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const out: AdminMember[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await memberQuery('*', filter).order('member_no').range(from, from + 999);
        if (error) throw error;
        out.push(...(data as unknown as AdminMember[]));
        if (data.length < 1000) break;
      }
      await exportExcel(
        `dasman-members-${isoDay(new Date().toISOString())}`,
        'الأعضاء',
        out.map((m) => ({
          'رقم العضوية': m.member_label,
          الاسم: m.full_name,
          'البريد الإلكتروني': m.email,
          الهاتف: m.phone,
          الجامعة: m.university,
          'السنة الدراسية': m.study_year,
          الحي: m.district,
          الحالة: STATUS_LABELS[m.status as MembershipStatus],
          'تاريخ التسجيل': isoDay(m.joined_at),
          'تاريخ الانتهاء': isoDay(m.expires_at),
          'كوبونات متاحة': m.coupons_available,
          'كوبونات مصروفة': m.coupons_redeemed,
          ملاحظات: m.notes ?? '',
        })),
      );
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const pages = Math.ceil(total / PAGE);

  return (
    <>
      <AdminTitle
        title="الأعضاء"
        lead={`${total.toLocaleString('en-US')} عضو${filter.q || filter.status || filter.university || filter.year ? ' مطابق للبحث' : ''}`}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exporting || !total}>
            {exporting ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        }
      />

      <div className="filters">
        <div className="search-box">
          <Icon name="search" />
          <input type="search" placeholder="بحث بالاسم أو البريد أو الهاتف أو رقم العضوية" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
        </div>
        <select value={filter.status} onChange={(e) => setParam('status', e.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="active">سارية</option>
          <option value="expired">منتهية</option>
          <option value="suspended">موقوفة</option>
        </select>
        <select value={filter.university} onChange={(e) => setParam('university', e.target.value)} aria-label="الجامعة">
          <option value="">كل الجامعات</option>
          {unis.data?.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={filter.year} onChange={(e) => setParam('year', e.target.value)} aria-label="السنة الدراسية">
          <option value="">كل السنوات</option>
          {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.value}</option>)}
        </select>
      </div>

      {(selected.size > 0 || allMatching) && (
        <div className="bulk-bar">
          <span>
            {allMatching ? `كل المطابقين (${total})` : `${selected.size} محدد`}
            {!allMatching && allOnPage && total > pageIds.length && (
              <button type="button" className="link-button" onClick={() => setAllMatching(true)}>
                تحديد كل المطابقين ({total})
              </button>
            )}
          </span>
          <div className="bulk-actions">
            <button type="button" className="btn btn-gold btn-sm" onClick={() => setModal('assign')}>
              <Icon name="ticket" />
              توزيع كوبونات
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal('email')}>
              <Icon name="mail" />
              إرسال بريد
            </button>
            <button type="button" className="link-button" onClick={() => { setSelected(new Set()); setAllMatching(false); }}>
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {list.isLoading ? (
        <PageLoader />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الأعضاء." onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="users">لا يوجد أعضاء مطابقون.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check"><input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label="تحديد الصفحة" /></th>
                <th>رقم العضوية</th>
                <th>الاسم</th>
                <th>الجامعة</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>الانتهاء</th>
                <th>كوبونات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={selected.has(m.id!) || allMatching ? 'is-selected' : undefined}>
                  <td className="col-check"><input type="checkbox" checked={allMatching || selected.has(m.id!)} onChange={() => toggle(m.id!)} aria-label={`تحديد ${m.full_name}`} /></td>
                  <td dir="ltr" className="cell-mono">{m.member_label}</td>
                  <td>
                    <Link to={`/admin/members/${m.id}`} className="cell-strong">{m.full_name || '—'}</Link>
                    <small className="cell-sub" dir="ltr">{m.email}</small>
                  </td>
                  <td>{m.university}<small className="cell-sub">{m.study_year}</small></td>
                  <td dir="ltr">{m.phone}</td>
                  <td><StatusBadge status={m.status as MembershipStatus} /></td>
                  <td>{formatDate(m.expires_at)}</td>
                  <td>{m.coupons_available} / {m.coupons_redeemed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setParam('page', String(page - 1))}>السابق</button>
          <span>صفحة {page + 1} من {pages}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={page + 1 >= pages} onClick={() => setParam('page', String(page + 1))}>التالي</button>
        </div>
      )}

      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} target={target} />
      <CampaignModal open={modal === 'email'} onClose={() => setModal(null)} target={target} />
    </>
  );
}
