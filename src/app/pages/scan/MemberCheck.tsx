// Page opened by the cashier's camera from the member QR: membership state, coupons and redemption.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { formatDate, formatMoney, formatTime } from '../../lib/format';

type CardCoupon = { id: string; code: string; title: string; value: number; partner: string; expires_at: string | null };
type Card =
  | { ok: false; error: 'invalid' }
  | {
      ok: true;
      status: 'active' | 'expired' | 'suspended';
      name: string;
      member_no: string;
      university: string;
      photo_url: string | null;
      expires_at: string;
      coupons: CardCoupon[];
    };

type RedeemResult =
  | { ok: true; partner: string; value: number; title: string; member: string; at: string; device_token: string | null }
  | { ok: false; error: string; tries_left?: number; until?: string; partner?: string };

// "Remember this device": a 12-hour token tied to one café, kept on the cashier's phone.
const DEVICE_KEY = 'dasman-partner-device';
type Device = { token: string; partner: string; expires: number };

function readDevice(): Device | null {
  try {
    const d = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null') as Device | null;
    return d && d.expires > Date.now() ? d : null;
  } catch {
    return null;
  }
}
function writeDevice(d: Device | null) {
  try {
    if (d) localStorage.setItem(DEVICE_KEY, JSON.stringify(d));
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* storage blocked: the cashier types the PIN each time */
  }
}

export default function MemberCheck() {
  const { code = '' } = useParams();
  const { t, lang } = useT();
  const queryClient = useQueryClient();
  const [device, setDevice] = useState<Device | null>(readDevice);
  const [selected, setSelected] = useState<CardCoupon | null>(null);
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needPin, setNeedPin] = useState(false);
  const [success, setSuccess] = useState<Extract<RedeemResult, { ok: true }> | null>(null);

  const card = useQuery({
    queryKey: ['member-card', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_member_card', { p_code: code });
      if (error) throw error;
      return data as unknown as Card;
    },
  });

  useEffect(() => {
    if (!selected) return;
    setPin('');
    setNeedPin(!device);
    // A phone remembered for another café can't redeem this coupon (the cashier can forget the device).
    setError(device && device.partner !== selected.partner ? t('scan.err.wrong_partner') : null);
  }, [selected, device, t]);

  const mismatch = !!(selected && device && device.partner !== selected.partner);

  const redeem = async () => {
    if (!selected || mismatch) return;
    if (needPin && !/^\d{4,8}$/.test(pin)) return setError(t('scan.err.pin_required'));
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('redeem_coupon', {
      p_member_code: code,
      p_coupon_id: selected.id,
      p_pin: needPin ? pin : undefined,
      p_device_token: needPin ? undefined : device?.token,
      p_remember: needPin && remember,
    });
    setBusy(false);
    if (rpcError) return setError(t('common.error'));
    const r = data as unknown as RedeemResult;
    if (r.ok) {
      if (r.device_token) {
        const d = { token: r.device_token, partner: r.partner, expires: Date.now() + 12 * 3600_000 };
        writeDevice(d);
        setDevice(d);
      }
      setSelected(null);
      setSuccess(r);
      queryClient.invalidateQueries({ queryKey: ['member-card', code] });
      return;
    }
    switch (r.error) {
      case 'wrong_pin':
        return setError(t('scan.err.wrong_pin', { n: r.tries_left ?? 0 }));
      case 'locked':
        return setError(t('scan.err.locked', { time: formatTime(r.until, lang) }));
      case 'pin_required':
        // Remembered device no longer valid (expired, or the café PIN changed).
        writeDevice(null);
        setDevice(null);
        setNeedPin(true);
        return setError(t('scan.err.pin_required'));
      case 'wrong_partner':
      case 'already_redeemed':
      case 'coupon_expired':
      case 'coupon_unavailable':
      case 'membership_inactive':
      case 'partner_inactive':
      case 'invalid_member':
        if (r.error !== 'wrong_partner') queryClient.invalidateQueries({ queryKey: ['member-card', code] });
        return setError(t(`scan.err.${r.error}`));
      default:
        return setError(t('common.error'));
    }
  };

  const forgetDevice = () => {
    writeDevice(null);
    setDevice(null);
  };

  if (success) {
    return (
      <section className="scan-success" role="status">
        <div className="container scan-container">
          <span className="success-mark"><Icon name="check" /></span>
          <h1>{t('scan.success')}</h1>
          <p className="success-amount">
            {t('scan.successDiscount')} <strong>{formatMoney(success.value)}</strong> {t('common.sar')}
          </p>
          <dl className="success-meta">
            <div><dt>{success.title}</dt><dd>{success.partner}</dd></div>
            <div><dt>{success.member}</dt><dd>{formatTime(success.at, lang)}</dd></div>
          </dl>
          <p className="success-note">{t('scan.successNote')}</p>
          <button type="button" className="btn btn-gold btn-block" onClick={() => setSuccess(null)}>
            {t('scan.done')}
          </button>
        </div>
      </section>
    );
  }

  if (card.isLoading) return <PageLoader />;
  if (card.isError || !card.data) {
    return (
      <section className="scan-page">
        <div className="container scan-container">
          <ErrorState message={t('common.error')} onRetry={() => card.refetch()} retryLabel={t('common.retry')} />
        </div>
      </section>
    );
  }

  const c = card.data;
  return (
    <section className="scan-page">
      <div className="container scan-container">
        {!c.ok ? (
          <div className="scan-result scan-result--invalid">
            <span className="scan-icon"><Icon name="close" /></span>
            <h1>{t('scan.invalid')}</h1>
            <p>{t('scan.invalidLead')}</p>
          </div>
        ) : (
          <>
            <div className={`scan-result scan-result--${c.status}`}>
              <span className="scan-icon"><Icon name={c.status === 'active' ? 'check' : 'lock'} /></span>
              <p className="scan-state">
                {c.status === 'active' ? t('scan.valid') : c.status === 'expired' ? t('scan.expired') : t('scan.suspended')}
              </p>
              {c.photo_url && <img className="scan-photo" src={c.photo_url} alt="" width="96" height="96" />}
              <h1>{c.name}</h1>
              <dl className="scan-meta">
                <div><dt>{t('card.memberNo')}</dt><dd dir="ltr">{c.member_no}</dd></div>
                <div><dt>{t('card.university')}</dt><dd>{c.university}</dd></div>
                <div>
                  <dt>{c.status === 'expired' ? t('scan.expiredOn') : t('scan.validUntil')}</dt>
                  <dd>{formatDate(c.expires_at, lang)}</dd>
                </div>
              </dl>
            </div>

            {c.status === 'active' && (
              <div className="panel scan-coupons">
                <h2>{t('scan.coupons')}</h2>
                {c.coupons.length === 0 ? (
                  <p className="muted">{t('scan.noCoupons')}</p>
                ) : (
                  <ul className="coupon-list">
                    {c.coupons.map((cp) => (
                      <li key={cp.id} className="coupon coupon--available">
                        <div className="coupon-value">
                          <strong>{formatMoney(cp.value)}</strong>
                          <span>{t('common.sar')}</span>
                        </div>
                        <div className="coupon-info">
                          <strong>{cp.title}</strong>
                          <span>{cp.partner}</span>
                          <small>{cp.expires_at ? `${t('coupons.validUntil')} ${formatDate(cp.expires_at, lang)}` : t('coupons.noExpiry')}</small>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelected(cp)}>
                          {t('scan.redeem')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        <div className="scan-footer">
          <Link to="/m" className="btn btn-ghost btn-block">
            <Icon name="qr" />
            {t('scan.anotherMember')}
          </Link>
          {device && (
            <p className="device-note">
              {t('scan.rememberedFor')} <strong>{device.partner}</strong> ·{' '}
              <button type="button" className="link-button" onClick={forgetDevice}>{t('scan.forgetDevice')}</button>
            </p>
          )}
        </div>
      </div>

      <Modal
        open={!!selected}
        title={t('scan.redeemTitle')}
        onClose={() => setSelected(null)}
        closeLabel={t('common.cancel')}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={redeem} disabled={busy || mismatch}>
            {busy ? <Spinner small /> : t('scan.confirm')}
          </button>
        }
      >
        {selected && (
          <div className="redeem-box">
            <div className="redeem-coupon">
              <strong>{formatMoney(selected.value)} {t('common.sar')}</strong>
              <span>{selected.title} · {selected.partner}</span>
            </div>
            {mismatch ? (
              <button type="button" className="link-button" onClick={forgetDevice}>{t('scan.forgetDevice')}</button>
            ) : needPin ? (
              <>
                <div className="field">
                  <label htmlFor="pin">{t('scan.pinLabel')}</label>
                  <input
                    id="pin"
                    className="pin-input"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    dir="ltr"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && redeem()}
                  />
                </div>
                <label className="check">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  {t('scan.remember')}
                </label>
              </>
            ) : (
              <p className="device-note">
                {t('scan.rememberedFor')} <strong>{device?.partner}</strong>
              </p>
            )}
            {error && <div className="form-status is-error" role="alert">{error}</div>}
          </div>
        )}
      </Modal>
    </section>
  );
}
