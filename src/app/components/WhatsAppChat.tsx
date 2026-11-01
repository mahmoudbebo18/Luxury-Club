// Floating WhatsApp chat, the same widget (markup and classes) as the marketing pages, on the
// platform's member-facing pages. A signed-in member's message starts with their name and number.
// Not shown in the admin panel or on the cashier's scan pages (it would cover the redeem button).
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './Icon';
import { memberLabel } from '../lib/format';
import { CLUB_WHATSAPP } from '../lib/services';

export function WhatsAppChat() {
  const { t } = useT();
  const { profile, isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    link.current?.focus({ preventScroll: true });
    // pointerdown, not click: a click listener added while the opening click is still bubbling
    // would close the panel straight away.
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (isAdmin || pathname.startsWith('/admin') || pathname === '/m' || pathname.startsWith('/m/')) return null;

  const message = profile?.role === 'member'
    ? t('wa.messageMember', { name: profile.full_name, no: memberLabel(profile.member_no) })
    : t('wa.message');

  return (
    <div className={open ? 'wa-chat is-open' : 'wa-chat'} ref={root}>
      <span className="wa-label" aria-hidden="true">{t('wa.label')}</span>
      <div className="wa-panel" id="waPanel" role="dialog" aria-label={t('wa.open')} aria-hidden={!open}>
        <div className="wa-panel-head">
          <img src="/imgs/dasman.jpeg" alt="" width="46" height="46" loading="lazy" />
          <div>
            <strong>{t('wa.name')}</strong>
            <span className="wa-status"><span className="wa-dot" />{t('wa.status')}</span>
          </div>
          <button
            className="wa-close"
            type="button"
            aria-label={t('wa.close')}
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="wa-panel-body">
          <p className="wa-bubble">{t('wa.hello')}<br />{t('wa.help')}</p>
          <a
            ref={link}
            className="wa-start"
            href={`https://wa.me/${CLUB_WHATSAPP}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener"
            tabIndex={open ? 0 : -1}
            onClick={() => setTimeout(() => setOpen(false), 0)}
          >
            <Icon name="whatsapp" />
            {t('wa.start')}
          </a>
        </div>
      </div>
      <button ref={button} className="wa-button" type="button" aria-controls="waPanel" aria-expanded={open} aria-label={t('wa.open')} onClick={() => setOpen((v) => !v)}>
        <Icon name="whatsapp" className="wa-icon-open" />
        <Icon name="close" className="wa-icon-close" />
      </button>
    </div>
  );
}
