// "Become an ambassador": the application (or its status) for members, and for approved
// ambassadors their invite link, the members who signed up through it and activity check-in.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/ar';
import { useAuth } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';
import { Alert, TextArea, TextField } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { formatDate, formatDateTime, statusOf } from '../../lib/format';
import type { RpcResult } from '../../lib/activities';

type MyAmbassador = {
  is_ambassador: boolean;
  since: string | null;
  referral_code: string | null;
  application: { status: 'pending' | 'approved' | 'rejected'; created_at: string; reviewed_at: string | null; admin_note: string | null } | null;
  stats: { total: number; active: number; month: number } | null;
  referrals: { name: string; university: string; joined_at: string; status: 'active' | 'expired' | 'suspended'; is_trial: boolean }[] | null;
};

export type CheckinActivity = {
  id: string;
  title: string;
  image_url: string | null;
  location: string;
  starts_at: string;
  ends_at: string | null;
  mode: 'individual' | 'team';
  checkin_open: boolean;
  participants: number;
  checked_in: number;
};

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const },
});

export default function Ambassador() {
  const { t } = useT();
  const me = useQuery({
    queryKey: ['my-ambassador'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_ambassador');
      if (error) throw error;
      return data as unknown as MyAmbassador;
    },
  });

  if (me.isLoading) return <PageLoader />;
  if (me.isError || !me.data) {
    return (
      <div className="container page">
        <ErrorState message={t('common.error')} onRetry={() => me.refetch()} retryLabel={t('common.retry')} />
      </div>
    );
  }
  return <div className="container page">{me.data.is_ambassador ? <AmbassadorHome data={me.data} /> : <Apply data={me.data} />}</div>;
}

function Apply({ data }: { data: MyAmbassador }) {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ motivation: '', experience: '', social: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const pending = data.application?.status === 'pending';
  const rejected = data.application?.status === 'rejected';
  const active = !!profile && statusOf(profile) === 'active';
  const short = form.motivation.trim().length < 20;

  const submit = async () => {
    setTouched(true);
    if (short) return;
    setBusy(true);
    setError(null);
    const { data: res, error: rpcError } = await supabase.rpc('apply_ambassador', {
      p_motivation: form.motivation.trim(),
      p_experience: form.experience.trim(),
      p_social: form.social.trim(),
    });
    setBusy(false);
    const r = res as unknown as RpcResult | null;
    if (rpcError || !r) return setError(t('common.error'));
    if (!r.ok) {
      const key = `amb.err.${r.error}` as StringKey;
      return setError(t(key) === key ? t('common.error') : t(key));
    }
    toast(t('amb.sent'));
    queryClient.invalidateQueries({ queryKey: ['my-ambassador'] });
  };

  return (
    <div className="amb">
      <motion.section className="amb-hero" {...rise(0)}>
        <span className="amb-hero-icon"><Icon name="sparkle" /></span>
        <h1>{t('amb.title')}</h1>
        <p>{t('amb.lead')}</p>
        <ul className="amb-perks">
          {(['amb.perk1', 'amb.perk2', 'amb.perk3'] as const).map((k, i) => (
            <motion.li key={k} {...rise(i + 1)}><Icon name={['send', 'qr', 'users'][i]} />{t(k)}</motion.li>
          ))}
        </ul>
      </motion.section>

      <motion.section className="surface amb-form" {...rise(2)}>
        {pending ? (
          <EmptyState icon="clock" title={t('amb.pendingTitle')}>
            {t('amb.pendingLead', { date: formatDate(data.application!.created_at, lang) })}
          </EmptyState>
        ) : (
          <>
            <h2 className="surface-title"><Icon name="edit" />{t('amb.formTitle')}</h2>
            {rejected && (
              <Alert tone="info">
                <strong>{t('amb.rejectedTitle')}</strong>
                <div>{data.application?.admin_note || t('amb.rejectedLead')}</div>
              </Alert>
            )}
            <form className="ui-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <TextArea
                label={t('amb.motivation')}
                rows={4}
                maxLength={1500}
                placeholder={t('amb.motivationPh')}
                value={form.motivation}
                onChange={(e) => setForm({ ...form, motivation: e.target.value })}
                onBlur={() => setTouched(true)}
                error={touched && short ? t('amb.motivationShort') : undefined}
              />
              <TextArea label={t('amb.experience')} optional={t('common.optional')} rows={2} maxLength={1500} placeholder={t('amb.experiencePh')} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
              <TextField label={t('amb.social')} optional={t('common.optional')} icon="instagram" dir="ltr" maxLength={200} placeholder={t('amb.socialPh')} value={form.social} onChange={(e) => setForm({ ...form, social: e.target.value })} />
              <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
              {!active && <p className="ui-hint">{t('amb.err.membership_inactive')}</p>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy || !active}>
                {busy ? <Spinner small /> : <><Icon name="send" />{t('amb.submit')}</>}
              </button>
            </form>
          </>
        )}
      </motion.section>
    </div>
  );
}

function AmbassadorHome({ data }: { data: MyAmbassador }) {
  const { t, lang } = useT();
  const toast = useToast();
  const link = `${location.origin}/register?ref=${data.referral_code}${lang === 'en' ? '&lang=en' : ''}`;
  const stats = data.stats ?? { total: 0, active: 0, month: 0 };
  const referrals = data.referrals ?? [];

  const activities = useQuery({
    queryKey: ['checkin-activities'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('checkin_activities');
      if (error) throw error;
      return (data ?? []) as unknown as CheckinActivity[];
    },
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast(t('common.copied'));
    } catch {
      /* clipboard blocked */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: 'Dasman', text: t('amb.shareText'), url: link });
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      <motion.header className="dash-hello" {...rise(0)}>
        <div>
          <span className="dash-chip"><Icon name="sparkle" />{t('amb.youAre')}</span>
          <h1>{t('account.ambassadorMine')}</h1>
          {data.since && <p>{t('amb.since', { date: formatDate(data.since, lang) })}</p>}
        </div>
      </motion.header>

      <div className="amb-grid">
        <motion.section className="amb-link" {...rise(1)}>
          <h2><Icon name="send" />{t('amb.link')}</h2>
          <p>{t('amb.linkHint')}</p>
          <div className="amb-link-box" dir="ltr">
            <span className="mono">{link.replace(/^https?:\/\//, '')}</span>
          </div>
          <div className="amb-link-actions">
            <button type="button" className="btn btn-gold" onClick={copy}><Icon name="copy" />{t('amb.copy')}</button>
            {'share' in navigator && <button type="button" className="btn btn-ghost-light" onClick={share}><Icon name="send" />{t('amb.share')}</button>}
            <span className="amb-code">{t('amb.code')}: <b dir="ltr" className="mono">{data.referral_code}</b></span>
          </div>
        </motion.section>

        <div className="dash-mini amb-stats">
          {([['users', stats.total, 'amb.statTotal'], ['check-circle', stats.active, 'amb.statActive'], ['calendar', stats.month, 'amb.statMonth']] as const).map(([icon, n, label], i) => (
            <motion.div key={label} className="dash-stat" {...rise(i + 2)}>
              <span className="dash-stat-icon"><Icon name={icon} /></span>
              <strong>{n}</strong>
              <span>{t(label)}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.section className="surface" {...rise(3)}>
        <h2 className="surface-title"><Icon name="qr" />{t('amb.checkin')}</h2>
        <p className="surface-lead">{t('amb.checkinLead')}</p>
        {activities.isLoading ? (
          <Skeleton rows={2} height={72} />
        ) : activities.isError ? (
          <ErrorState message={t('common.error')} onRetry={() => activities.refetch()} retryLabel={t('common.retry')} />
        ) : !activities.data?.length ? (
          <EmptyState icon="calendar">{t('amb.noCheckin')}</EmptyState>
        ) : (
          <ul className="checkin-list">
            {activities.data.map((a) => (
              <li key={a.id}>
                <Link to={`/account/checkin/${a.id}`} className="checkin-item">
                  <span className="checkin-item-icon"><Icon name="trophy" /></span>
                  <span className="checkin-item-body">
                    <strong>{a.title}</strong>
                    <small>{formatDateTime(a.starts_at, lang)}{a.location && ` · ${a.location}`}</small>
                  </span>
                  <span className="checkin-item-meta">
                    <em className={a.checkin_open ? 'badge badge--active' : 'badge'}>{a.checkin_open ? t('amb.checkinOpen') : t('amb.checkinSoon')}</em>
                    <small>{t('amb.present', { n: a.checked_in, total: a.participants })}</small>
                  </span>
                  <Icon name="arrow" className="icon-flip" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      <motion.section className="surface" {...rise(4)}>
        <div className="surface-head">
          <h2><Icon name="users" />{t('amb.referrals')}</h2>
          <span className="muted">{referrals.length}</span>
        </div>
        {referrals.length === 0 ? (
          <EmptyState icon="send">{t('amb.noReferrals')}</EmptyState>
        ) : (
          <ul className="ref-list">
            {referrals.map((r, i) => (
              <li key={i}>
                <span className="avatar">{r.name.trim().charAt(0)}</span>
                <span className="ref-list-body">
                  <strong>{r.name}</strong>
                  <small>{[r.university, formatDate(r.joined_at, lang)].filter(Boolean).join(' · ')}</small>
                </span>
                <span className={`badge badge--${r.status}`}>{r.status === 'active' && r.is_trial ? t('status.trial') : t(`status.${r.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </>
  );
}
