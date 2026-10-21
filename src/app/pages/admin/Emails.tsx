import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { CampaignModal } from './CampaignModal';
import type { Target } from './AssignModal';
import { describeFilter, memberQuery, universities, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, startOfDayRiyadh, isoDay } from '../../lib/format';
import { STUDY_YEARS } from '../../lib/options';

const CAMPAIGN_STATUS = {
  queued: { label: 'في الطابور', tone: 'gold' },
  sending: { label: 'جارٍ الإرسال', tone: 'gold' },
  done: { label: 'اكتمل', tone: 'active' },
  failed: { label: 'فشل', tone: 'suspended' },
} as const;

const KIND_LABELS: Record<string, string> = {
  welcome: 'ترحيب',
  coupon: 'كوبون جديد',
  expiry_30: 'قبل الانتهاء',
  expired: 'انتهاء العضوية',
  campaign: 'حملة',
};

export default function Emails() {
  const toast = useToast();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [filter, setFilter] = useState<MemberFilter>({ status: 'active' });
  const [counting, setCounting] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const unis = useQuery({ queryKey: ['admin', 'universities'], queryFn: universities, enabled: audienceOpen });
  const campaigns = useQuery({
    queryKey: ['admin', 'campaigns'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const queue = useQuery({
    queryKey: ['admin', 'queue'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = startOfDayRiyadh(isoDay(new Date().toISOString()));
      const [pending, sentToday, failed, recent] = await Promise.all([
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', today),
        supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('email_queue').select('id, kind, to_email, to_name, status, error, created_at, sent_at').neq('kind', 'campaign').order('id', { ascending: false }).limit(15),
      ]);
      return { pending: pending.count ?? 0, sentToday: sentToday.count ?? 0, failed: failed.count ?? 0, recent: recent.data ?? [] };
    },
  });

  const continueToCompose = async () => {
    setCounting(true);
    const { count, error } = await memberQuery('id', filter, 'exact').limit(1);
    setCounting(false);
    if (error) return toast('تعذّر حساب عدد الأعضاء.', 'error');
    if (!count) return toast('لا يوجد أعضاء مطابقون.', 'error');
    setAudienceOpen(false);
    setTarget({ filter, label: describeFilter(filter), count });
  };

  return (
    <>
      <AdminTitle
        title="المراسلات"
        lead="رسائل للأعضاء من بريد دسمان. الإرسال يتم تلقائيًا كل ساعة، بحد 250 رسالة يوميًا للحملات والرسائل التلقائية."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAudienceOpen(true)}>
            <Icon name="plus" />
            رسالة جديدة
          </button>
        }
      />

      {queue.data && (
        <div className="stat-grid stat-grid--3">
          <div className="stat-tile"><span className="stat-label">في الطابور</span><strong className="stat-value">{queue.data.pending}</strong></div>
          <div className="stat-tile stat-tile--active"><span className="stat-label">أُرسل اليوم</span><strong className="stat-value">{queue.data.sentToday}</strong></div>
          <div className="stat-tile stat-tile--suspended"><span className="stat-label">فشل الإرسال</span><strong className="stat-value">{queue.data.failed}</strong></div>
        </div>
      )}

      <section className="panel">
        <div className="panel-head"><h2>الحملات</h2></div>
        {campaigns.isLoading ? (
          <PageLoader />
        ) : campaigns.isError ? (
          <ErrorState message="تعذّر تحميل الحملات." onRetry={() => campaigns.refetch()} />
        ) : !campaigns.data?.length ? (
          <EmptyState icon="mail">لم تُرسل أي حملة بعد.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>العنوان</th><th>المستلمون</th><th>التقدم</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                {campaigns.data.map((c) => {
                  const st = CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS];
                  const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 100;
                  return (
                    <tr key={c.id}>
                      <td className="cell-strong">{c.subject}</td>
                      <td>{c.audience}</td>
                      <td>
                        <div className="progress" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} /></div>
                        <small className="cell-sub">{c.sent} من {c.total}{c.failed ? ` · فشل ${c.failed}` : ''}</small>
                      </td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td>{formatDateTime(c.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2>آخر الرسائل التلقائية</h2></div>
        {!queue.data?.recent.length ? (
          <EmptyState icon="mail">لا توجد رسائل تلقائية بعد.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>النوع</th><th>إلى</th><th>الحالة</th><th>الوقت</th></tr></thead>
              <tbody>
                {queue.data.recent.map((q) => (
                  <tr key={q.id}>
                    <td>{KIND_LABELS[q.kind] ?? q.kind}</td>
                    <td>{q.to_name}<small className="cell-sub" dir="ltr">{q.to_email}</small></td>
                    <td>
                      {q.status === 'sent' ? <Badge tone="active">أُرسلت</Badge> : q.status === 'failed' ? <Badge tone="suspended">فشلت</Badge> : <Badge tone="gold">في الطابور</Badge>}
                      {q.error && <small className="cell-sub">{q.error}</small>}
                    </td>
                    <td>{formatDateTime(q.sent_at ?? q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={audienceOpen}
        title="لمن الرسالة؟"
        onClose={() => setAudienceOpen(false)}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={continueToCompose} disabled={counting}>
            {counting ? <Spinner small /> : 'متابعة'}
          </button>
        }
      >
        <div className="form-stack">
          <p className="modal-lead">لرسالة لعضو واحد افتح ملفه، ولأعضاء محددين اخترهم من صفحة الأعضاء.</p>
          <div className="field">
            <label htmlFor="aStatus">الحالة</label>
            <select id="aStatus" value={filter.status ?? ''} onChange={(e) => setFilter({ ...filter, status: e.target.value as MemberFilter['status'] })}>
              <option value="">كل الأعضاء</option>
              <option value="active">الساريون</option>
              <option value="expired">المنتهية عضويتهم</option>
              <option value="suspended">الموقوفون</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="aUni">الجامعة</label>
            <select id="aUni" value={filter.university ?? ''} onChange={(e) => setFilter({ ...filter, university: e.target.value })}>
              <option value="">كل الجامعات</option>
              {unis.data?.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aYear">السنة الدراسية</label>
            <select id="aYear" value={filter.year ?? ''} onChange={(e) => setFilter({ ...filter, year: e.target.value })}>
              <option value="">كل السنوات</option>
              {STUDY_YEARS.map((y) => <option key={y.value} value={y.value}>{y.value}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      <CampaignModal open={!!target} onClose={() => setTarget(null)} target={target} />
    </>
  );
}
