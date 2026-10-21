import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { MembershipCard } from '../../components/MembershipCard';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState } from '../../components/States';
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

export default function Dashboard() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
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
    } finally {
      setSaving(false);
    }
  };

  const list = (coupons.data ?? []).filter((c) => c.state === tab);
  const count = (s: Tab) => (coupons.data ?? []).filter((c) => c.state === s).length;
  const emptyText: Record<Tab, string> = {
    available: t('coupons.emptyAvailable'),
    used: t('coupons.emptyUsed'),
    expired: t('coupons.emptyExpired'),
  };

  return (
    <div className="container account-page">
      <div className="page-title">
        <span className="eyebrow">{memberLabel(profile.member_no)}</span>
        <h1>
          {t('account.hello')} {profile.full_name.split(' ')[0]}
        </h1>
        <p>{t('account.lead')}</p>
      </div>

      <div className="account-grid">
        <div className="card-column">
          <MembershipCard profile={profile} ref={cardRef} />
          <div className="card-actions">
            <button type="button" className="btn btn-primary" onClick={saveImage} disabled={saving}>
              {saving ? <Spinner small /> : <Icon name="download" />}
              {saving ? t('account.saving') : t('account.saveImage')}
            </button>
            <Link className="btn btn-ghost" to="/account/profile">
              <Icon name="edit" />
              {t('account.editProfile')}
            </Link>
          </div>
        </div>

        <aside className="status-panel">
          <div className="status-row">
            <span>{t('account.status')}</span>
            <span className={`badge badge--${status}`}>{t(`status.${status}`)}</span>
          </div>
          <div className="status-row">
            <span>{t('account.expires')}</span>
            <strong>{formatDate(profile.expires_at, lang)}</strong>
          </div>
          {status === 'active' && (
            <div className="status-days">
              <strong>{daysLeft(profile.expires_at)}</strong>
              <span>{t('account.daysLeft')}</span>
            </div>
          )}
          {status === 'expired' && <p className="status-note">{t('account.expiredNote')}</p>}
          {status === 'suspended' && <p className="status-note">{t('account.suspendedNote')}</p>}
        </aside>
      </div>

      <section className="panel coupons-panel" aria-labelledby="couponsTitle">
        <div className="panel-head">
          <h2 id="couponsTitle">{t('coupons.title')}</h2>
          <div className="tabs" role="tablist">
            {(['available', 'used', 'expired'] as Tab[]).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={tab === s} className={tab === s ? 'tab is-active' : 'tab'} onClick={() => setTab(s)}>
                {t(`coupons.${s}`)}
                <span className="tab-count">{count(s)}</span>
              </button>
            ))}
          </div>
        </div>

        {coupons.isLoading ? (
          <PageLoader />
        ) : coupons.isError ? (
          <ErrorState message={t('common.error')} onRetry={() => coupons.refetch()} retryLabel={t('common.retry')} />
        ) : list.length === 0 ? (
          <EmptyState>{emptyText[tab]}</EmptyState>
        ) : (
          <ul className="coupon-list">
            {list.map((c) => (
              <li key={c.id} className={`coupon coupon--${c.state}`}>
                <div className="coupon-value">
                  <strong>{formatMoney(c.value)}</strong>
                  <span>{t('common.sar')}</span>
                </div>
                <div className="coupon-info">
                  <strong>{c.title}</strong>
                  <span>
                    {t('coupons.at')} {c.partner}
                  </span>
                  <small>
                    {c.state === 'used'
                      ? `${t('coupons.usedOn')} ${formatDate(c.redeemed_at, lang)}`
                      : c.state === 'expired'
                        ? `${t('coupons.expiredOn')} ${formatDate(c.expires_at, lang)}`
                        : c.expires_at
                          ? `${t('coupons.validUntil')} ${formatDate(c.expires_at, lang)}`
                          : t('coupons.noExpiry')}
                  </small>
                </div>
                <span className="coupon-code" dir="ltr">{c.code}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
