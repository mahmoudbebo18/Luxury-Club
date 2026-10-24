// Same markup and classes as the marketing pages' header and drawer, driven by React.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useT } from '../i18n';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';

const order = (i: number) => ({ '--i': i }) as CSSProperties;
const active = ({ isActive }: { isActive: boolean }) => (isActive ? 'is-active' : undefined);

export function Header({ showLang = true }: { showLang?: boolean }) {
  const { t, lang, setLang } = useT();
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const home = lang === 'en' ? '/index-en' : '/';
  const services = lang === 'en' ? '/services-en' : '/services';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus({ preventScroll: true });
  };

  const logout = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };

  const switchLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  return (
    <>
      <header className={scrolled ? 'site-header is-scrolled' : 'site-header'}>
        <div className="container header-inner">
          <a className="brand" href={home} aria-label="دسمان">
            <img className="brand-logo--dark" src="/imgs/dasman-logo.png" alt="دسمان" width="84" height="46" />
          </a>
          <nav className="main-nav" aria-label={t('nav.menu')}>
            <a href={home}>{t('common.home')}</a>
            {session && !isAdmin ? (
              <NavLink to="/account/services" className={active}>{t('nav.myServices')}</NavLink>
            ) : (
              <a href={services}>{t('nav.services')}</a>
            )}
            {session ? (
              <>
                {isAdmin ? (
                  <NavLink to="/admin" className={active}>{t('nav.admin')}</NavLink>
                ) : (
                  <>
                    <NavLink to="/account" end className={active}>{t('nav.account')}</NavLink>
                    <NavLink to="/account/activities" className={active}>{t('nav.activities')}</NavLink>
                  </>
                )}
                <NavLink to="/account/profile" className={active}>{t('nav.profile')}</NavLink>
              </>
            ) : (
              <>
                <a href={`${home}#privileges`}>{t('nav.privileges')}</a>
                <a href={`${home}#join`}>{t('nav.join')}</a>
              </>
            )}
          </nav>
          <div className="header-actions">
            {showLang && (
              <button type="button" className="lang-switch" onClick={switchLang} lang={lang === 'ar' ? 'en' : 'ar'}>
                <Icon name="globe" />
                {t('nav.lang')}
              </button>
            )}
            {session ? (
              <button type="button" className="lang-switch auth-link auth-link--compact" onClick={logout} aria-label={t('nav.logout')}>
                <Icon name="logout" flip />
                <span>{t('nav.logout')}</span>
              </button>
            ) : (
              <Link className="lang-switch auth-link" to="/login">
                <Icon name="user" />
                <span>{t('nav.login')}</span>
              </Link>
            )}
            <button
              ref={toggleRef}
              className="menu-toggle"
              type="button"
              aria-controls="drawer"
              aria-expanded={open}
              aria-label={t('nav.menu')}
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div className={open ? 'drawer-backdrop is-open' : 'drawer-backdrop'} onClick={close} />
      <aside className={open ? 'drawer is-open' : 'drawer'} id="drawer" aria-label={t('nav.menu')} aria-hidden={!open}>
        <div className="drawer-head">
          <a className="drawer-brand" href={home} aria-label="دسمان">
            <img src="/imgs/dasman-logo.png" alt="دسمان" width="77" height="42" />
          </a>
          <button ref={closeRef} className="drawer-close" type="button" onClick={close} aria-label={t('nav.close')}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="drawer-nav" aria-label={t('nav.menu')} onClick={() => setOpen(false)}>
          <a href={home} style={order(1)}>
            <span className="num">01</span>{t('common.home')}<Icon name="arrow" flip />
          </a>
          {session ? (
            <>
              {isAdmin ? (
                <Link to="/admin" style={order(2)}>
                  <span className="num">02</span>{t('nav.admin')}<Icon name="arrow" flip />
                </Link>
              ) : (
                <>
                  <NavLink to="/account" end className={active} style={order(2)}>
                    <span className="num">02</span>{t('nav.account')}<Icon name="arrow" flip />
                  </NavLink>
                  <NavLink to="/account/services" className={active} style={order(3)}>
                    <span className="num">03</span>{t('nav.myServices')}<Icon name="arrow" flip />
                  </NavLink>
                  <NavLink to="/account/activities" className={active} style={order(4)}>
                    <span className="num">04</span>{t('nav.activities')}<Icon name="arrow" flip />
                  </NavLink>
                  <NavLink to="/account/ambassador" className={active} style={order(5)}>
                    <span className="num">05</span>{t('nav.ambassador')}<Icon name="arrow" flip />
                  </NavLink>
                </>
              )}
              <NavLink to="/account/profile" className={active} style={order(6)}>
                <span className="num">{isAdmin ? '03' : '06'}</span>{t('nav.profile')}<Icon name="arrow" flip />
              </NavLink>
            </>
          ) : (
            <>
              <a href={services} style={order(2)}>
                <span className="num">02</span>{t('nav.services')}<Icon name="arrow" flip />
              </a>
              <a href={`${home}#join`} style={order(3)}>
                <span className="num">03</span>{t('nav.join')}<Icon name="arrow" flip />
              </a>
            </>
          )}
        </nav>
        {session ? (
          <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
            <Icon name="logout" flip />
            {t('nav.logout')}
          </button>
        ) : (
          <Link className="btn btn-primary btn-block" to="/login" onClick={() => setOpen(false)}>
            {t('nav.login')}
          </Link>
        )}
        <div className="drawer-contact">
          <a href="tel:+966558103228">
            <Icon name="phone" />
            <span dir="ltr">+966 55 810 3228</span>
          </a>
          <a href="mailto:Dasman_sa@hotmail.com">
            <Icon name="mail" />
            Dasman_sa@hotmail.com
          </a>
          {showLang && (
            <button type="button" className="drawer-lang" onClick={switchLang}>
              <Icon name="globe" />
              {lang === 'ar' ? 'English' : 'عربي'}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
