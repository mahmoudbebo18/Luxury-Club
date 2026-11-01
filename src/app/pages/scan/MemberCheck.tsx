// Page opened by the cashier's camera from the member QR: membership state, coupons and redemption.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, TextField } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { formatDate, formatMoney, formatTime } from '../../lib/format';

type CardCoupon = { id: string; code: string; title: string; value: number; partner: string; expires_at: string | null };
type Card =
  | { ok: false; error: 'invalid' }
  | {
      ok: true;
      status: 'active' | 'expired' | 'suspended';
      is_trial?: boolean;
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

type Checkin = { activity_id: string; member_id: string; title: string; starts_at: string; team_name: string | null; checked_in_at: string | null };

/** Ambassadors and admins who scan a member's QR can check them in at today's activity. */
function ActivityCheckins({ code }: { code: string }) {
  const { t, lang } = useT();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['member-checkins', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_checkins', { p_member_code: code });
      if (error) throw error;
      return (data ?? []) as unknown as Checkin[];
    },
  });
  if (!list.data?.length) return null;

  const mark = async (c: Checkin) => {
    setBusy(c.activity_id);
    setError(null);
    const { data, error } = await supabase.rpc('set_checkin', { p_activity_id: c.activity_id, p_member_id: c.member_id, p_checked: true });
    setBusy(null);
    if (error || !(data as { ok?: boolean } | null)?.ok) return setError(t('checkin.err'));
    queryClient.invalidateQueries({ queryKey: ['member-checkins', code] });
  };

  return (
    <motion.section className="surface scan-checkin" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
      <h2 className="surface-title"><Icon name="trophy" />{t('checkin.forMember')}</h2>
      <ul className="checkin-people">
        {list.data.map((c) => (
          <li key={c.activity_id} className={c.checked_in_at ? 'is-in' : undefined}>
            <span className="checkin-person">
              <strong>{c.title}</strong>
              <small>{formatTime(c.starts_at, lang)}{c.team_name && ` · ${c.team_name}`}</small>
            </span>
            {c.checked_in_at ? (
              <span className="badge badge--active">{t('checkin.done')} {formatTime(c.checked_in_at, lang)}</span>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => mark(c)} disabled={busy === c.activity_id}>
                {busy === c.activity_id ? <Spinner small /> : <><Icon name="check" />{t('checkin.mark')}</>}
              </button>
            )}
          </li>
        ))}
      </ul>
      <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
    </motion.section>
  );
}

export default function MemberCheck() {
  const { code = '' } = useParams();
  const { t, lang } = useT();
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const canCheckIn = isAdmin || !!profile?.is_ambassador;
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
      <motion.section className="scan-success" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="container scan-success-inner">
          <motion.svg className="success-check" viewBox="0 0 96 96" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
            <circle cx="48" cy="48" r="44" />
            <motion.path d="M28 49l13 13 27-28" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
          </motion.svg>
          <h1>{t('scan.success')}</h1>
          <p className="success-amount">
            <span>{t('scan.successDiscount')}</span>
            <strong>{formatMoney(success.value)}</strong>
            <span>{t('common.sar')}</span>
          </p>
          <dl className="success-meta">
            <div><dt>{success.member}</dt><dd>{formatTime(success.at, lang)}</dd></div>
            <div><dt>{success.title}</dt><dd>{success.partner}</dd></div>
          </dl>
          <p className="success-note">
            <Icon name="info" />
            {t('scan.successNote')}
          </p>
          <button type="button" className="btn btn-gold btn-block btn-lg" onClick={() => setSuccess(null)}>
            {t('scan.done')}
          </button>
        </div>
      </motion.section>
    );
  }

  if (card.isLoading) return <PageLoader />;
  if (card.isError || !card.data) {
    return (
      <div className="container page scan">
        <ErrorState message={t('common.error')} onRetry={() => card.refetch()} retryLabel={t('common.retry')} />
      </div>
    );
  }

  const c = card.data;
  const tone = !c.ok ? 'invalid' : c.status;
  return (
    <div className="container page scan">
      <motion.div
        className={`scan-hero scan-hero--${tone}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <span className="scan-hero-icon">
          <Icon name={!c.ok ? 'x-circle' : c.status === 'active' ? 'check-circle' : 'lock'} />
        </span>
        {!c.ok ? (
          <>
            <h1>{t('scan.invalid')}</h1>
            <p>{t('scan.invalidLead')}</p>
          </>
        ) : (
          <>
            <span className="scan-hero-state">
              {c.status === 'active' ? (c.is_trial ? t('scan.validTrial') : t('scan.valid')) : c.status === 'expired' ? t('scan.expired') : t('scan.suspended')}
            </span>
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
          </>
        )}
      </motion.div>

      {c.ok && c.status === 'active' && canCheckIn && <ActivityCheckins code={code} />}

      {c.ok && c.status === 'active' && (
        <motion.section className="surface scan-coupons" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="surface-title"><Icon name="ticket" />{t('scan.coupons')}</h2>
          {c.coupons.length === 0 ? (
            <EmptyState icon="ticket">{t('scan.noCoupons')}</EmptyState>
          ) : (
            <ul className="tickets tickets--single">
              {c.coupons.map((cp, i) => (
                <motion.li key={cp.id} className="ticket ticket--available" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                  <div className="ticket-value">
                    <strong>{formatMoney(cp.value)}</strong>
                    <span>{t('common.sar')}</span>
                  </div>
                  <div className="ticket-body">
                    <strong>{cp.title}</strong>
                    <span className="ticket-line"><Icon name="store" />{cp.partner}</span>
                    <span className="ticket-line">
                      <Icon name="clock" />
                      {cp.expires_at ? `${t('coupons.validUntil')} ${formatDate(cp.expires_at, lang)}` : t('coupons.noExpiry')}
                    </span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm ticket-action" onClick={() => setSelected(cp)}>
                    {t('scan.redeem')}
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>
      )}

      <div className="scan-footer">
        <Link to="/m" className="btn btn-ghost btn-block">
          <Icon name="qr" />
          {t('scan.anotherMember')}
        </Link>
        {device && (
          <p className="device-note">
            <Icon name="shield" />
            <span>
              {t('scan.rememberedFor')} <strong>{device.partner}</strong> ·{' '}
              <button type="button" className="link-button" onClick={forgetDevice}>{t('scan.forgetDevice')}</button>
            </span>
          </p>
        )}
      </div>

      <Modal
        open={!!selected}
        title={t('scan.redeemTitle')}
        icon="ticket"
        onClose={() => setSelected(null)}
        closeLabel={t('common.cancel')}
        footer={
          <button type="button" className="btn btn-primary btn-block btn-lg" onClick={redeem} disabled={busy || mismatch}>
            {busy ? <Spinner small /> : <><Icon name="check" />{t('scan.confirm')}</>}
          </button>
        }
      >
        {selected && (
          <div className="ui-form">
            <div className="redeem-coupon">
              <strong>{formatMoney(selected.value)} <small>{t('common.sar')}</small></strong>
              <span>{selected.title} · {selected.partner}</span>
            </div>
            {mismatch ? (
              <button type="button" className="btn btn-ghost btn-block" onClick={forgetDevice}>
                <Icon name="refresh" />
                {t('scan.forgetDevice')}
              </button>
            ) : needPin ? (
              <>
                <TextField
                  label={t('scan.pinLabel')}
                  icon="lock"
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
                <label className="ui-switch">
                  <span>{t('scan.remember')}</span>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span className="ui-switch-track" />
                </label>
              </>
            ) : (
              <p className="device-note">
                <Icon name="shield" />
                <span>{t('scan.rememberedFor')} <strong>{device?.partner}</strong></span>
              </p>
            )}
            <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
          </div>
        )}
      </Modal>
    </div>
  );
}
