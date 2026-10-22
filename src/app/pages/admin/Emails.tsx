import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, StatCard } from './AdminLayout';
import { CampaignModal } from './CampaignModal';
import type { Target } from './AssignModal';
import { describeFilter, memberQuery, universities, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Dropdown } from '../../components/Dropdown';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, startOfDayRiyadh, isoDay } from '../../lib/format';
import { STUDY_YEARS } from '../../lib/options';

const CAMPAIGN_STATUS = {
  queued: { label: 'في الطابور', tone: 'gold' },
  sending: { label: 'جارٍ الإرسال', tone: 'gold' },
  done: { label: 'اكتمل', tone: 'active' },
  failed: { label: 'فشل', tone: 'suspended' },
} as const;

const KIND: Record<string, { label: string; icon: string }> = {
  welcome: { label: 'ترحيب', icon: 'sparkle' },
  coupon: { label: 'كوبون جديد', icon: 'ticket' },
  expiry_30: { label: 'قبل الانتهاء', icon: 'clock' },
  expired: { label: 'انتهاء العضوية', icon: 'alert' },
  campaign: { label: 'حملة', icon: 'send' },
};

export default function Emails() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [filter, setFilter] = useState<MemberFilter>({ status: 'active' });
  const [counting, setCounting] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    if (params.get('new')) {
      setAudienceOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const unis = useQuery({ queryKey: ['admin', 'universities'], queryFn: universities, enabled: audienceOpen });
  const audienceCount = useQuery({
    queryKey: ['admin', 'audience-count', JSON.stringify(filter)],
    enabled: audienceOpen,
    queryFn: async () => {
      const { count, error } = await memberQuery('id', filter, 'exact').limit(1);
      if (error) throw error;
      return count ?? 0;
    },
  });
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
        lead="رسائل للأعضاء من بريد دسمان، تُرسل تلقائيًا خلال دقائق بحد 250 رسالة يوميًا."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setAudienceOpen(true)}>
            <Icon name="plus" />
            رسالة جديدة
          </button>
        }
      />

      {queue.data && (
        <div className="stats stats--3">
          <StatCard icon="clock" tone="gold" label="في الطابور" value={queue.data.pending} />
          <StatCard icon="check-circle" tone="green" label="أُرسل اليوم" value={queue.data.sentToday} foot="من 250 رسالة يوميًا" />
          <StatCard icon="alert" tone="red" label="فشل الإرسال" value={queue.data.failed} />
        </div>
      )}

      <section className="surface">
        <div className="surface-head"><h2><Icon name="send" />الحملات</h2></div>
        {campaigns.isLoading ? (
          <Skeleton rows={3} height={64} />
        ) : campaigns.isError ? (
          <ErrorState message="تعذّر تحميل الحملات." onRetry={() => campaigns.refetch()} />
        ) : !campaigns.data?.length ? (
          <EmptyState icon="send" title="لم تُرسل أي حملة بعد" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setAudienceOpen(true)}><Icon name="plus" />رسالة جديدة</button>}>
            اكتب رسالة لكل الأعضاء أو لفئة منهم، وراجعها قبل الإرسال.
          </EmptyState>
        ) : (
          <ul className="campaigns">
            {campaigns.data.map((c, i) => {
              const st = CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS];
              const pct = c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 100;
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <div className="campaign-main">
                    <strong>{c.subject}</strong>
                    <small><Icon name="users" />{c.audience} · {formatDateTime(c.created_at)}</small>
                  </div>
                  <div className="campaign-progress">
                    <div className="bar"><span style={{ width: `${pct}%` }} className={c.status === 'done' ? 'is-active' : 'is-gold'} /></div>
                    <small>{c.sent} من {c.total}{c.failed ? ` · فشل ${c.failed}` : ''}</small>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="surface">
        <div className="surface-head"><h2><Icon name="bell" />آخر الرسائل التلقائية</h2></div>
        {!queue.data ? (
          <Skeleton rows={3} height={48} />
        ) : !queue.data.recent.length ? (
          <EmptyState icon="mail">لا توجد رسائل تلقائية بعد.</EmptyState>
        ) : (
          <ul className="feed">
            {queue.data.recent.map((q) => {
              const k = KIND[q.kind] ?? { label: q.kind, icon: 'mail' };
              return (
                <li key={q.id}>
                  <span className="feed-icon"><Icon name={k.icon} /></span>
                  <span className="feed-body">
                    <strong>{k.label} · {q.to_name}</strong>
                    <small dir="ltr">{q.to_email}</small>
                    {q.error && <small className="feed-error">{q.error}</small>}
                  </span>
                  <span className="feed-side">
                    {q.status === 'sent' ? <Badge tone="active">أُرسلت</Badge> : q.status === 'failed' ? <Badge tone="suspended">فشلت</Badge> : <Badge tone="gold">في الطابور</Badge>}
                    <small>{formatDateTime(q.sent_at ?? q.created_at)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={audienceOpen}
        title="لمن الرسالة؟"
        icon="users"
        lead="لعضو واحد افتح ملفه، ولأعضاء محددين اخترهم من صفحة الأعضاء."
        onClose={() => setAudienceOpen(false)}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={continueToCompose} disabled={counting || !audienceCount.data}>
            {counting ? <Spinner small /> : <>متابعة ({audienceCount.data?.toLocaleString('en-US') ?? '…'} عضو)<Icon name="arrow" className="icon-flip" /></>}
          </button>
        }
      >
        <div className="ui-form">
          <div className="ui-field">
            <span className="ui-label">الحالة</span>
            <Dropdown block icon="filter" placeholder="كل الأعضاء" value={filter.status ?? ''} onChange={(v) => setFilter({ ...filter, status: v as MemberFilter['status'] })}
              options={[{ value: '', label: 'كل الأعضاء' }, { value: 'active', label: 'الساريون' }, { value: 'expired', label: 'المنتهية عضويتهم' }, { value: 'suspended', label: 'الموقوفون' }]} />
          </div>
          <div className="ui-field">
            <span className="ui-label">الجامعة</span>
            <Dropdown block icon="cap" searchable placeholder="كل الجامعات" value={filter.university ?? ''} onChange={(v) => setFilter({ ...filter, university: v })}
              options={[{ value: '', label: 'كل الجامعات' }, ...(unis.data ?? []).map((u) => ({ value: u, label: u }))]} />
          </div>
          <div className="ui-field">
            <span className="ui-label">السنة الدراسية</span>
            <Dropdown block icon="calendar" placeholder="كل السنوات" value={filter.year ?? ''} onChange={(v) => setFilter({ ...filter, year: v })}
              options={[{ value: '', label: 'كل السنوات' }, ...STUDY_YEARS.map((y) => ({ value: y.value, label: y.value }))]} />
          </div>
        </div>
      </Modal>

      <CampaignModal open={!!target} onClose={() => setTarget(null)} target={target} />
    </>
  );
}
