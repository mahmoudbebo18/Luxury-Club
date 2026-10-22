// Digital membership card (bank-card proportions). The QR holds only the scan link, no personal data.
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useT } from '../i18n';
import { formatDate, memberLabel, statusOf } from '../lib/format';
import type { Profile } from '../auth/AuthProvider';

export function scanUrl(code: string) {
  return `${location.origin}/m/${code}`;
}

export const MembershipCard = forwardRef<HTMLDivElement, { profile: Profile }>(function MembershipCard({ profile }, ref) {
  const { t, lang } = useT();
  const status = statusOf(profile);
  return (
    <div className={`mcard mcard--${status}`} ref={ref}>
      <div className="mcard-sheen" aria-hidden="true" />
      <div className="mcard-main">
        <div className="mcard-top">
          <img src="/imgs/dasman-logo-light.png" alt="دسمان" width="74" height="40" />
          {profile.is_trial && status === 'active' ? (
            <span className="mcard-status mcard-status--trial">{t('status.trial')}</span>
          ) : (
            <span className={`mcard-status mcard-status--${status}`}>{t(`status.${status}`)}</span>
          )}
        </div>
        <div className="mcard-name">
          <strong>{profile.full_name}</strong>
          <span>{profile.university}</span>
        </div>
        <dl className="mcard-meta">
          <div>
            <dt>{t('card.memberNo')}</dt>
            <dd dir="ltr">{memberLabel(profile.member_no)}</dd>
          </div>
          <div>
            <dt>{t('card.expires')}</dt>
            <dd>{formatDate(profile.expires_at, lang)}</dd>
          </div>
        </dl>
      </div>
      <div className="mcard-qr">
        <div className="mcard-qr-box">
          <QRCodeSVG value={scanUrl(profile.member_code)} size={160} level="M" marginSize={0} fgColor="#1b1e12" title={t('card.code')} />
        </div>
        <span className="mcard-code" dir="ltr">{profile.member_code}</span>
      </div>
    </div>
  );
});
