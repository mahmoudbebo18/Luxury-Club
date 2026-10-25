import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { AdminTitle, Pager } from './AdminLayout';
import { AssignModal, type Target } from './AssignModal';
import { CampaignModal } from './CampaignModal';
import { describeFilter, memberQuery, STATUS_LABELS, universities, type AdminMember, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Dropdown } from '../../components/Dropdown';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { STUDY_YEARS } from '../../lib/options';
import { formatDate, isoDay, type MembershipStatus } from '../../lib/format';
import { exportExcel } from '../../lib/excel';

const PAGE = 50;

export default function Members() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const filter: MemberFilter = {
    q: params.get('q') ?? '',
    university: params.get('university') ?? '',
    year: params.get('year') ?? '',
    status: (params.get('status') as MemberFilter['status']) ?? '',
    group: (params.get('group') as MemberFilter['group']) ?? '',
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

  // The top-bar search changes ?q= directly; keep the box in sync.
  useEffect(() => setSearch(filter.q ?? ''), [filter.q]);

  // Debounced search box → URL
  useEffect(() => {
    const timer = setTimeout(() => search.trim() !== (filter.q ?? '') && setParam('q', search.trim()), 350);
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
  const someOnPage = pageIds.some((id) => selected.has(id));
  const filtered = !!(filter.q || filter.status || filter.university || filter.year || filter.group);

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
  const clearSelection = () => {
    setSelected(new Set());
    setAllMatching(false);
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
          تجريبية: m.is_trial ? 'نعم' : 'لا',
          سفير: m.is_ambassador ? 'نعم' : '',
          'سجّلوا عن طريقه': m.is_ambassador ? m.referrals : '',
          'دعاه السفير': m.referred_by_name ?? '',
          'تاريخ التسجيل': isoDay(m.joined_at),
          'تاريخ الانتهاء': isoDay(m.expires_at),
          'كوبونات متاحة': m.coupons_available,
          'كوبونات مصروفة': m.coupons_redeemed,
          ملاحظات: m.notes ?? '',
        })),
      );
      toast(`تم تصدير ${out.length} عضو.`);
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const count = selected.size || (allMatching ? total : 0);

  return (
    <>
      <AdminTitle
        title="الأعضاء"
        lead={list.data ? `${total.toLocaleString('en-US')} عضو${filtered ? ' مطابق للبحث' : ''}` : 'جارٍ التحميل…'}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportAll} disabled={exporting || !total}>
            {exporting ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        }
      />

      <div className="toolbar">
        <label className="toolbar-search">
          <Icon name="search" />
          <input type="search" placeholder="بحث بالاسم أو البريد أو الجوال أو رقم العضوية" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="بحث" />
          {list.isFetching && !list.isLoading && <Spinner small />}
        </label>
        <Dropdown
          label="الحالة"
          icon="filter"
          placeholder="كل الحالات"
          value={filter.status ?? ''}
          onChange={(v) => setParam('status', v)}
          options={[
            { value: '', label: 'كل الحالات' },
            { value: 'active', label: 'سارية' },
            { value: 'expired', label: 'منتهية' },
            { value: 'suspended', label: 'موقوفة' },
          ]}
        />
        <Dropdown
          label="الجامعة"
          icon="cap"
          placeholder="كل الجامعات"
          searchable
          searchPlaceholder="ابحث عن جامعة…"
          value={filter.university ?? ''}
          onChange={(v) => setParam('university', v)}
          options={[{ value: '', label: 'كل الجامعات' }, ...(unis.data ?? []).map((u) => ({ value: u, label: u }))]}
        />
        <Dropdown
          label="السنة الدراسية"
          icon="calendar"
          placeholder="كل السنوات"
          value={filter.year ?? ''}
          onChange={(v) => setParam('year', v)}
          options={[{ value: '', label: 'كل السنوات' }, ...STUDY_YEARS.map((y) => ({ value: y.value, label: y.value }))]}
        />
        <Dropdown
          label="الفئة"
          icon="sparkle"
          placeholder="كل الأعضاء"
          value={filter.group ?? ''}
          onChange={(v) => setParam('group', v)}
          options={[
            { value: '', label: 'كل الأعضاء' },
            { value: 'ambassadors', label: 'السفراء' },
            { value: 'referred', label: 'سجّلوا عن طريق سفير' },
          ]}
        />
        {filtered && (
          <button type="button" className="btn btn-xs btn-soft" onClick={() => setParams({}, { replace: true })}>
            <Icon name="close" />
            مسح الفلاتر
          </button>
        )}
      </div>

      {list.isLoading ? (
        <Skeleton rows={6} height={58} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الأعضاء." onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState icon="users" title="لا يوجد أعضاء مطابقون" action={filtered ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>مسح الفلاتر</button> : undefined}>
            جرّب كلمة بحث أخرى أو غيّر الفلاتر.
          </EmptyState>
        </div>
      ) : (
        <div className="table-card">
          <table className="dtable dtable--members">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    checked={allOnPage || allMatching}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPage && !allOnPage && !allMatching;
                    }}
                    onChange={togglePage}
                    aria-label="تحديد الصفحة"
                  />
                </th>
                <th>العضو</th>
                <th>الجامعة</th>
                <th>الجوال</th>
                <th>الحالة</th>
                <th>الانتهاء</th>
                <th className="num">الكوبونات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const isSel = allMatching || selected.has(m.id!);
                return (
                  <tr key={m.id} className={isSel ? 'is-selected is-link' : 'is-link'} onClick={() => navigate(`/admin/members/${m.id}`)}>
                    <td className="col-check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="ui-checkbox" checked={isSel} onChange={() => toggle(m.id!)} aria-label={`تحديد ${m.full_name}`} />
                    </td>
                    <td>
                      <div className="cell-person">
                        <span className="avatar">{(m.full_name || '؟').trim().charAt(0)}</span>
                        <span>
                          <span className="cell-name">
                            <Link to={`/admin/members/${m.id}`} className="cell-strong" onClick={(e) => e.stopPropagation()}>{m.full_name || '—'}</Link>
                            {m.is_ambassador && <Badge tone="gold">سفير</Badge>}
                          </span>
                          <small dir="ltr">{m.member_label} · {m.email}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="الجامعة">{m.university || '—'}<small className="cell-sub">{m.study_year}</small></td>
                    <td data-label="الجوال" className="cell-phone"><span dir="ltr">{m.phone || '—'}</span></td>
                    <td data-label="الحالة"><span className="cell-badges"><StatusBadge status={m.status as MembershipStatus} />{m.is_trial && m.status === 'active' && <Badge tone="gold">تجريبية</Badge>}</span></td>
                    <td data-label="الانتهاء">{formatDate(m.expires_at)}</td>
                    <td data-label="الكوبونات" className="num">
                      <span className="coupon-pair" title="متاحة / مصروفة">
                        <b>{m.coupons_available}</b> / {m.coupons_redeemed}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE} total={total} onPage={(p) => setParam('page', String(p))} />
        </div>
      )}

      <AnimatePresence>
        {count > 0 && (
          <motion.div className="bulk" initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} role="region" aria-label="إجراءات المحددين">
            <div className="bulk-count">
              <span>{count.toLocaleString('en-US')}</span>
              <div>
                <strong>{allMatching ? 'كل المطابقين محددون' : 'عضو محدد'}</strong>
                {!allMatching && allOnPage && total > pageIds.length && (
                  <button type="button" className="bulk-all" onClick={() => setAllMatching(true)}>
                    تحديد كل المطابقين ({total.toLocaleString('en-US')})
                  </button>
                )}
              </div>
            </div>
            <div className="bulk-actions">
              <button type="button" className="btn btn-gold btn-sm" onClick={() => setModal('assign')}>
                <Icon name="ticket" />
                <span>توزيع كوبون</span>
              </button>
              <button type="button" className="btn btn-sm bulk-btn" onClick={() => setModal('email')}>
                <Icon name="send" />
                <span>إرسال بريد</span>
              </button>
              <button type="button" className="bulk-close" onClick={clearSelection} aria-label="إلغاء التحديد">
                <Icon name="close" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AssignModal open={modal === 'assign'} onClose={() => setModal(null)} target={target} onDone={clearSelection} />
      <CampaignModal open={modal === 'email'} onClose={() => setModal(null)} target={target} onDone={clearSelection} />
    </>
  );
}
