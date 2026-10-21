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
    <div className={`member-card member-card--${status}`} ref={ref}>
      <div className="member-card-main">
        <div className="member-card-top">
          <img src="/imgs/dasman-logo-light.png" alt="دسمان" width="92" height="50" />
          <span className={`badge badge--${status} badge--on-dark`}>{t(`status.${status}`)}</span>
        </div>
        <div className="member-card-name">
          <span className="member-card-label">{t('card.member')}</span>
          <strong>{profile.full_name}</strong>
          <span className="member-card-uni">{profile.university}</span>
        </div>
        <dl className="member-card-meta">
          <div>
            <dt>{t('card.memberNo')}</dt>
            <dd dir="ltr">{memberLabel(profile.member_no)}</dd>
          </div>
          <div>
            <dt>{t('card.joined')}</dt>
            <dd>{formatDate(profile.joined_at, lang)}</dd>
          </div>
          <div>
            <dt>{t('card.expires')}</dt>
            <dd>{formatDate(profile.expires_at, lang)}</dd>
          </div>
        </dl>
      </div>
      <div className="member-card-qr">
        <div className="qr-box">
          <QRCodeSVG value={scanUrl(profile.member_code)} size={256} level="M" marginSize={0} fgColor="#1b1e12" title={t('card.code')} />
        </div>
        <span className="qr-code" dir="ltr">{profile.member_code}</span>
      </div>
    </div>
  );
});
