import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { ErrorState, EmptyState } from '../../components/States';
import { PageLoader } from '../../components/PageLoader';
import { formatDateTime, formatMoney } from '../../lib/format';

type Stats = {
  members_total: number;
  new_week: number;
  new_month: number;
  active: number;
  expired: number;
  suspended: number;
  coupons_assigned: number;
  coupons_redeemed: number;
  emails_pending: number;
};

export default function Overview() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_stats');
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
  const latest = useQuery({
    queryKey: ['admin', 'redemptions', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_redemptions').select('*').order('redeemed_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (stats.isLoading) return <PageLoader />;
  if (stats.isError || !stats.data) return <ErrorState message="تعذّر تحميل الإحصائيات." onRetry={() => stats.refetch()} />;
  const s = stats.data;

  const tiles: { label: string; value: number; to?: string; tone?: string }[] = [
    { label: 'إجمالي الأعضاء', value: s.members_total, to: '/admin/members' },
    { label: 'جدد هذا الأسبوع', value: s.new_week },
    { label: 'جدد هذا الشهر', value: s.new_month },
    { label: 'عضويات سارية', value: s.active, to: '/admin/members?status=active', tone: 'active' },
    { label: 'منتهية', value: s.expired, to: '/admin/members?status=expired', tone: 'expired' },
    { label: 'موقوفة', value: s.suspended, to: '/admin/members?status=suspended', tone: 'suspended' },
    { label: 'كوبونات موزعة', value: s.coupons_assigned, to: '/admin/coupons' },
    { label: 'كوبونات مصروفة', value: s.coupons_redeemed, to: '/admin/redemptions' },
  ];

  return (
    <>
      <AdminTitle title="الرئيسية" lead="نظرة عامة على العضويات والكوبونات." />
      <div className="stat-grid">
        {tiles.map((tile) => {
          const body = (
            <>
              <span className="stat-label">{tile.label}</span>
              <strong className="stat-value">{tile.value.toLocaleString('en-US')}</strong>
            </>
          );
          const cls = `stat-tile${tile.tone ? ` stat-tile--${tile.tone}` : ''}`;
          return tile.to ? (
            <Link key={tile.label} to={tile.to} className={cls}>{body}</Link>
          ) : (
            <div key={tile.label} className={cls}>{body}</div>
          );
        })}
      </div>
      {s.emails_pending > 0 && (
        <p className="admin-note">
          في طابور البريد {s.emails_pending} رسالة، تُرسل تلقائيًا كل ساعة ضمن الحد اليومي. <Link to="/admin/emails">المراسلات</Link>
        </p>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>آخر عمليات الصرف</h2>
          <Link className="text-link" to="/admin/redemptions">السجل الكامل</Link>
        </div>
        {latest.isLoading ? (
          <PageLoader />
        ) : !latest.data?.length ? (
          <EmptyState icon="list">لا توجد عمليات صرف بعد.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>الوقت</th><th>العضو</th><th>الكافيه</th><th>الكوبون</th><th>القيمة</th></tr>
              </thead>
              <tbody>
                {latest.data.map((r) => (
                  <tr key={r.id} className={r.voided_at ? 'is-voided' : undefined}>
                    <td>{formatDateTime(r.redeemed_at)}</td>
                    <td>{r.member_id ? <Link to={`/admin/members/${r.member_id}`}>{r.member_name}</Link> : '—'}</td>
                    <td>{r.partner_name}</td>
                    <td>{r.coupon_title}</td>
                    <td>{formatMoney(r.value_sar ?? 0)} ريال{r.voided_at && <span className="badge badge--suspended">ملغاة</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
