import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../auth/AuthProvider';
import { AdminTitle, StatCard } from './AdminLayout';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/StatusBadge';
import { ErrorState, EmptyState, Skeleton } from '../../components/States';
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

const n = (v: number) => v.toLocaleString('en-US');

export default function Overview() {
  const { profile } = useAuth();
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
      const { data, error } = await supabase.from('admin_redemptions').select('*').order('redeemed_at', { ascending: false }).limit(6);
      if (error) throw error;
      return data;
    },
  });

  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Riyadh', hour: 'numeric', hour12: false }).format(new Date()));
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير';

  if (stats.isError) return <ErrorState message="تعذّر تحميل الإحصائيات." onRetry={() => stats.refetch()} />;
  const s = stats.data;
  const total = s ? s.active + s.expired + s.suspended : 0;
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  const usage = s && s.coupons_assigned ? Math.round((s.coupons_redeemed / s.coupons_assigned) * 100) : 0;

  return (
    <>
      <AdminTitle
        title={`${greeting}، ${profile?.full_name?.split(' ')[0] ?? ''}`}
        lead="هذه نظرة سريعة على العضويات والكوبونات اليوم."
        actions={
          <>
            <Link to="/admin/emails?new=1" className="btn btn-ghost btn-sm"><Icon name="send" />رسالة جديدة</Link>
            <Link to="/admin/coupons?new=1" className="btn btn-primary btn-sm"><Icon name="plus" />دفعة كوبونات</Link>
          </>
        }
      />

      {!s ? (
        <Skeleton rows={2} height={120} />
      ) : (
        <>
          <div className="stats">
            <StatCard icon="users" label="إجمالي الأعضاء" value={n(s.members_total)} to="/admin/members" foot={<><b>+{n(s.new_week)}</b> هذا الأسبوع</>} />
            <StatCard icon="sparkle" tone="gold" label="جدد هذا الشهر" value={n(s.new_month)} />
            <StatCard icon="ticket" tone="green" label="كوبونات موزعة" value={n(s.coupons_assigned)} to="/admin/coupons" foot={`${n(s.coupons_assigned - s.coupons_redeemed)} لم تُستخدم بعد`} />
            <StatCard icon="check-circle" tone="amber" label="كوبونات مصروفة" value={n(s.coupons_redeemed)} to="/admin/redemptions" foot={`نسبة الاستخدام ${usage}%`} />
          </div>

          <div className="adm-grid-2">
            <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="surface-head">
                <h2><Icon name="chart" />حالة العضويات</h2>
                <Link className="text-more" to="/admin/members">كل الأعضاء</Link>
              </div>
              <div className="split-bar" role="img" aria-label={`سارية ${s.active}، منتهية ${s.expired}، موقوفة ${s.suspended}`}>
                <motion.span className="is-active" initial={{ width: 0 }} animate={{ width: `${pct(s.active)}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
                <motion.span className="is-expired" initial={{ width: 0 }} animate={{ width: `${pct(s.expired)}%` }} transition={{ duration: 0.8, delay: 0.3 }} />
                <motion.span className="is-suspended" initial={{ width: 0 }} animate={{ width: `${pct(s.suspended)}%` }} transition={{ duration: 0.8, delay: 0.4 }} />
              </div>
              <ul className="legend">
                <li><Link to="/admin/members?status=active"><i className="is-active" />سارية<strong>{n(s.active)}</strong></Link></li>
                <li><Link to="/admin/members?status=expired"><i className="is-expired" />منتهية<strong>{n(s.expired)}</strong></Link></li>
                <li><Link to="/admin/members?status=suspended"><i className="is-suspended" />موقوفة<strong>{n(s.suspended)}</strong></Link></li>
              </ul>
              {s.emails_pending > 0 && (
                <Link to="/admin/emails" className="adm-note">
                  <Icon name="mail" />
                  <span>في طابور البريد <b>{n(s.emails_pending)}</b> رسالة، تُرسل تلقائيًا خلال دقائق ضمن الحد اليومي.</span>
                  <Icon name="arrow" className="icon-flip" />
                </Link>
              )}
            </motion.section>

            <motion.section className="surface" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="surface-head">
                <h2><Icon name="history" />آخر عمليات الصرف</h2>
                <Link className="text-more" to="/admin/redemptions">السجل الكامل</Link>
              </div>
              {latest.isLoading ? (
                <Skeleton rows={4} height={44} />
              ) : !latest.data?.length ? (
                <EmptyState icon="history">لا توجد عمليات صرف بعد.</EmptyState>
              ) : (
                <ul className="feed">
                  {latest.data.map((r) => (
                    <li key={r.id} className={r.voided_at ? 'is-voided' : undefined}>
                      <span className="feed-icon"><Icon name="ticket" /></span>
                      <span className="feed-body">
                        <strong>
                          {r.member_id ? <Link to={`/admin/members/${r.member_id}`}>{r.member_name}</Link> : '—'}
                          {r.voided_at && <Badge tone="suspended">ملغاة</Badge>}
                        </strong>
                        <small>{r.partner_name} · {formatDateTime(r.redeemed_at)}</small>
                      </span>
                      <span className="feed-value">{formatMoney(r.value_sar ?? 0)} <small>ريال</small></span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>
          </div>

          <div className="quick">
            <Link to="/admin/members" className="quick-item"><Icon name="users" /><span><strong>إدارة الأعضاء</strong><small>بحث، تجديد، إيقاف، تصدير</small></span></Link>
            <Link to="/admin/partners" className="quick-item"><Icon name="store" /><span><strong>الكافيهات</strong><small>إضافة كافيه ورقمه السري</small></span></Link>
            <Link to="/admin/settings" className="quick-item"><Icon name="file" /><span><strong>قوالب الرسائل</strong><small>الترحيب والكوبونات والتنبيهات</small></span></Link>
          </div>
        </>
      )}
    </>
  );
}
