// Admin panel shell (Arabic only): dark side navigation, sticky top bar with quick member search,
// slide-in navigation on phones.
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { PageLoader } from '../../components/PageLoader';
import { LangProvider } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';

const links = [
  { to: '/admin', label: 'الرئيسية', icon: 'chart', end: true },
  { to: '/admin/members', label: 'الأعضاء', icon: 'users' },
  { to: '/admin/partners', label: 'الكافيهات', icon: 'store' },
  { to: '/admin/coupons', label: 'الكوبونات', icon: 'ticket' },
  { to: '/admin/redemptions', label: 'سجل الصرف', icon: 'history' },
  { to: '/admin/services', label: 'الخدمات', icon: 'concierge' },
  { to: '/admin/activities', label: 'الأنشطة', icon: 'trophy' },
  { to: '/admin/ambassadors', label: 'السفراء', icon: 'sparkle', badge: 'applications' as const },
  { to: '/admin/emails', label: 'المراسلات', icon: 'mail', badge: 'queue' as const },
  { to: '/admin/settings', label: 'الإعدادات', icon: 'settings' },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const queue = useQuery({
    queryKey: ['admin', 'queue-count'],
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count } = await supabase.from('email_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return count ?? 0;
    },
  });
  const applications = useQuery({
    queryKey: ['admin', 'applications-count'],
    refetchInterval: 300_000,
    queryFn: async () => {
      const { count } = await supabase.from('ambassador_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return count ?? 0;
    },
  });
  const badges = { queue: queue.data, applications: applications.data };
  return (
    <nav className="adm-nav" aria-label="لوحة الإدارة">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} onClick={onNavigate} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="adm-nav-pill" className="adm-nav-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <Icon name={l.icon} />
              <span>{l.label}</span>
              {l.badge && !!badges[l.badge] && <em className="adm-nav-badge">{badges[l.badge]}</em>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SideFooter() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="adm-side-foot">
      <div className="adm-me">
        <span className="avatar">{profile?.full_name?.trim().charAt(0) ?? 'أ'}</span>
        <span>
          <strong>{profile?.full_name}</strong>
          <small dir="ltr">{profile?.email}</small>
        </span>
      </div>
      <div className="adm-side-links">
        <a href="/" target="_blank" rel="noopener">
          <Icon name="globe" />
          الموقع
        </a>
        <Link to="/account/profile#security">
          <Icon name="key" />
          كلمة المرور
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
        >
          <Icon name="logout" className="icon-flip" />
          خروج
        </button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('no-scroll', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/admin/members?q=${encodeURIComponent(term)}` : '/admin/members');
    setQ('');
  };

  return (
    <LangProvider forced="ar">
      <div className="adm">
        <aside className="adm-side">
          <Link to="/admin" className="adm-logo">
            <img src="/imgs/dasman-logo-light.png" alt="دسمان" width="84" height="46" />
            <span>لوحة الإدارة</span>
          </Link>
          <Nav />
          <SideFooter />
        </aside>

        <AnimatePresence>
          {open && (
            <>
              <motion.div className="adm-drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
              <motion.aside
                className="adm-side adm-side--drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                aria-label="القائمة"
              >
                <div className="adm-drawer-head">
                  <Link to="/admin" className="adm-logo">
                    <img src="/imgs/dasman-logo-light.png" alt="دسمان" width="76" height="42" />
                  </Link>
                  <button type="button" className="ui-icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
                    <Icon name="close" />
                  </button>
                </div>
                <Nav onNavigate={() => setOpen(false)} />
                <SideFooter />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="adm-body">
          <header className="adm-top">
            <button type="button" className="ui-icon-btn adm-menu" onClick={() => setOpen(true)} aria-label="فتح القائمة">
              <Icon name="menu" />
            </button>
            <Link to="/admin" className="adm-top-logo">
              <img src="/imgs/dasman-logo.png" alt="دسمان" width="64" height="35" />
            </Link>
            <form className="adm-search" onSubmit={search} role="search">
              <Icon name="search" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن عضو بالاسم أو البريد أو الجوال أو رقم العضوية…" aria-label="بحث عن عضو" />
              <kbd>Enter</kbd>
            </form>
            <a className="btn btn-ghost btn-xs adm-scan-link" href="/m" target="_blank" rel="noopener">
              <Icon name="qr" />
              <span>صفحة المسح</span>
            </a>
          </header>
          <main id="main" className="adm-main">
            <Suspense fallback={<PageLoader />}>
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
                <Outlet />
              </motion.div>
            </Suspense>
          </main>
        </div>
      </div>
    </LangProvider>
  );
}

export function AdminTitle({ title, lead, actions, back }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <div className="adm-title">
      <div>
        {back && (
          <Link className="adm-crumb" to={back.to}>
            <Icon name="arrow" className="icon-back" />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {actions && <div className="adm-actions">{actions}</div>}
    </div>
  );
}

/** Small KPI card. */
export function StatCard({ label, value, icon, tone, to, foot }: { label: string; value: ReactNode; icon: string; tone?: 'olive' | 'gold' | 'green' | 'amber' | 'red'; to?: string; foot?: ReactNode }) {
  const body = (
    <>
      <span className="stat-icon"><Icon name={icon} /></span>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {foot && <span className="stat-foot">{foot}</span>}
      {to && <Icon name="arrow" className="icon-flip stat-go" />}
    </>
  );
  const cls = `stat stat--${tone ?? 'olive'}`;
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Previous / next pager with "x–y of n". */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  return (
    <div className="pager">
      <span>
        {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} من {total.toLocaleString('en-US')}
      </span>
      <div>
        <button type="button" className="ui-icon-btn" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="السابق">
          <Icon name="arrow" />
        </button>
        <button type="button" className="ui-icon-btn" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} aria-label="التالي">
          <Icon name="arrow" className="icon-flip" />
        </button>
      </div>
    </div>
  );
}
