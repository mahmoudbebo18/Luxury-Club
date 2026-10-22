import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { MembershipCard, scanUrl } from '../../components/MembershipCard';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Tabs } from '../../components/Tabs';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { daysLeft, formatDate, formatMoney, memberLabel, statusOf } from '../../lib/format';

type MyCoupon = {
  id: string;
  code: string;
  title: string;
  value: number;
  partner: string;
  expires_at: string | null;
  assigned_at: string | null;
  redeemed_at: string | null;
  state: 'available' | 'used' | 'expired';
};

type Tab = MyCoupon['state'];

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.06 * i, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const },
});

export default function Dashboard() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const toast = useToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('available');

  const coupons = useQuery({
    queryKey: ['my-coupons'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_coupons');
      if (error) throw error;
      return (data ?? []) as unknown as MyCoupon[];
    },
  });

  if (!profile) return <PageLoader />;
  const status = statusOf(profile);
  const left = daysLeft(profile.expires_at);
  const firstName = profile.full_name.split(' ')[0];

  const saveImage = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const a = document.createElement('a');
      a.href = url;
      a.download = `dasman-${memberLabel(profile.member_no)}.png`;
      a.click();
    } catch {
      toast(t('common.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const all = coupons.data ?? [];
  const list = all.filter((c) => c.state === tab);
  const count = (s: Tab) => all.filter((c) => c.state === s).length;
  const empty: Record<Tab, { title?: string; text: string }> = {
    available: { title: t('coupons.emptyAvailableTitle'), text: t('coupons.emptyAvailable') },
    used: { text: t('coupons.emptyUsed') },
    expired: { text: t('coupons.emptyExpired') },
  };
  const trial = profile.is_trial && status === 'active';
  // Share of the current period left (a 14-day trial fills the ring the same way a year does).
  const span = Math.max(1, Math.round((new Date(profile.expires_at).getTime() - new Date(profile.joined_at).getTime()) / 86_400_000));
  const ring = Math.min(1, left / span);

  return (
    <div className="container page">
      <motion.header className="dash-hello" {...rise(0)}>
        <div>
          <span className="dash-chip" dir="ltr">{memberLabel(profile.member_no)}</span>
          <h1>{t('account.hello', { name: firstName })}</h1>
          <p>{t('account.lead')}</p>
        </div>
      </motion.header>

      <div className="dash-grid">
        <motion.section className="dash-card" {...rise(1)}>
          <MembershipCard profile={profile} ref={cardRef} />
          <div className="dash-card-actions">
            <button type="button" className="btn btn-primary" onClick={() => setQrOpen(true)} disabled={status !== 'active'}>
              <Icon name="qr" />
              {t('account.showQr')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={saveImage} disabled={saving}>
              {saving ? <Spinner small /> : <Icon name="download" />}
              {saving ? t('account.saving') : t('account.saveImage')}
            </button>
          </div>
        </motion.section>

        <div className="dash-side">
          {status === 'active' ? (
            <motion.div className={trial ? 'dash-stat dash-stat--ring dash-stat--trial' : 'dash-stat dash-stat--ring'} {...rise(2)}>
              <div className="ring-wrap">
                <svg viewBox="0 0 64 64" className="ring" aria-hidden="true">
                  <circle cx="32" cy="32" r="27" className="ring-track" />
                  <motion.circle
                    cx="32"
                    cy="32"
                    r="27"
                    className="ring-value"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: ring }}
                    transition={{ duration: 1.2, delay: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </svg>
                {trial && <Icon name="clock" className="ring-icon" />}
              </div>
              <div>
                {trial && <em className="trial-tag"><Icon name="sparkle" />{t('account.trialTitle')}</em>}
                <strong>{left}</strong>
                <span>{trial ? t('account.trialLeft') : t('account.daysLeft')}</span>
                <small>
                  {trial ? t('account.trialEnds') : t('account.expires')} {formatDate(profile.expires_at, lang)}
                </small>
              </div>
            </motion.div>
          ) : (
            <motion.div className={`dash-alert dash-alert--${status}`} {...rise(2)}>
              <Icon name="alert" />
              <div>
                <strong>{t(`status.${status}`)}</strong>
                <p>{status === 'expired' ? t('account.expiredNote') : t('account.suspendedNote')}</p>
                <a className="btn btn-sm btn-ghost" href="https://wa.me/966558103228" target="_blank" rel="noopener">
                  <Icon name="whatsapp" />
                  {t('account.contact')}
                </a>
              </div>
            </motion.div>
          )}

          <div className="dash-mini">
            <motion.div className="dash-stat" {...rise(3)}>
              <span className="dash-stat-icon"><Icon name="ticket" /></span>
              <strong>{coupons.isLoading ? '–' : count('available')}</strong>
              <span>{t('account.couponsAvailable')}</span>
            </motion.div>
            <motion.div className="dash-stat" {...rise(4)}>
              <span className="dash-stat-icon"><Icon name="calendar" /></span>
              <strong className="dash-stat-date">{formatDate(profile.joined_at, lang)}</strong>
              <span>{t('account.memberSince')}</span>
            </motion.div>
          </div>

          <motion.div className="dash-how" {...rise(5)}>
            <h2>{t('account.howTitle')}</h2>
            <ol>
              <li><span>1</span>{t('account.how1')}</li>
              <li><span>2</span>{t('account.how2')}</li>
              <li><span>3</span>{t('account.how3')}</li>
            </ol>
          </motion.div>

          <motion.div {...rise(6)}>
            <Link className="dash-link" to="/account/profile">
              <span className="dash-stat-icon"><Icon name="user" /></span>
              <span>{t('account.editProfile')}</span>
              <Icon name="arrow" className="icon-flip dash-link-arrow" />
            </Link>
          </motion.div>
        </div>
      </div>

      <motion.section className="surface coupons" aria-labelledby="couponsTitle" {...rise(4)}>
        <div className="surface-head">
          <h2 id="couponsTitle">
            <Icon name="ticket" />
            {t('coupons.title')}
          </h2>
          <Tabs
            label={t('coupons.title')}
            value={tab}
            onChange={setTab}
            tabs={(['available', 'used', 'expired'] as Tab[]).map((s) => ({ value: s, label: t(`coupons.${s}`), count: coupons.isLoading ? undefined : count(s) }))}
          />
        </div>

        {coupons.isLoading ? (
          <Skeleton rows={2} height={104} />
        ) : coupons.isError ? (
          <ErrorState message={t('common.error')} onRetry={() => coupons.refetch()} retryLabel={t('common.retry')} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {list.length === 0 ? (
                <EmptyState icon={tab === 'available' ? 'gift' : 'ticket'} title={empty[tab].title}>
                  {empty[tab].text}
                </EmptyState>
              ) : (
                <ul className="tickets">
                  {list.map((c, i) => (
                    <motion.li
                      key={c.id}
                      className={`ticket ticket--${c.state}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="ticket-value">
                        <strong>{formatMoney(c.value)}</strong>
                        <span>{t('common.sar')}</span>
                      </div>
                      <div className="ticket-body">
                        <strong>{c.title}</strong>
                        <span className="ticket-line">
                          <Icon name="store" />
                          {c.partner}
                        </span>
                        <span className="ticket-line">
                          <Icon name="clock" />
                          {c.state === 'used'
                            ? `${t('coupons.usedOn')} ${formatDate(c.redeemed_at, lang)}`
                            : c.state === 'expired'
                              ? `${t('coupons.expiredOn')} ${formatDate(c.expires_at, lang)}`
                              : c.expires_at
                                ? `${t('coupons.validUntil')} ${formatDate(c.expires_at, lang)}`
                                : t('coupons.noExpiry')}
                        </span>
                      </div>
                      <span className="ticket-code mono" dir="ltr">{c.code}</span>
                      {c.state !== 'available' && <span className="ticket-stamp">{t(`coupons.${c.state}`)}</span>}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.section>

      <Modal open={qrOpen} title={t('account.showQr')} lead={t('account.qrHint')} icon="qr" onClose={() => setQrOpen(false)} closeLabel={t('common.cancel')}>
        <div className="qr-full">
          <div className="qr-full-box">
            <QRCodeSVG value={scanUrl(profile.member_code)} size={260} level="M" marginSize={0} fgColor="#1b1e12" />
          </div>
          <strong>{profile.full_name}</strong>
          <span dir="ltr" className="mono">{memberLabel(profile.member_no)} · {profile.member_code}</span>
        </div>
      </Modal>
    </div>
  );
}
