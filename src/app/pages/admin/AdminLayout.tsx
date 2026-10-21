// Admin panel shell: Arabic only, site header + side navigation.
import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PageLoader } from '../../components/PageLoader';
import { LangProvider } from '../../i18n';
import { Header } from '../../layout/Header';
import { Icon } from '../../components/Icon';

const links = [
  { to: '/admin', label: 'الرئيسية', icon: 'chart', end: true },
  { to: '/admin/members', label: 'الأعضاء', icon: 'users' },
  { to: '/admin/partners', label: 'الكافيهات', icon: 'store' },
  { to: '/admin/coupons', label: 'الكوبونات', icon: 'ticket' },
  { to: '/admin/redemptions', label: 'سجل الصرف', icon: 'list' },
  { to: '/admin/emails', label: 'المراسلات', icon: 'mail' },
  { to: '/admin/settings', label: 'الإعدادات', icon: 'settings' },
];

export function AdminLayout() {
  return (
    <LangProvider forced="ar">
      <Header showLang={false} />
      <div className="admin-shell container">
        <nav className="admin-nav" aria-label="لوحة الإدارة">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              <Icon name={l.icon} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <main id="main" className="admin-main">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </LangProvider>
  );
}

export function AdminTitle({ title, lead, actions }: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <div className="admin-title">
      <div>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </div>
      {actions && <div className="admin-actions">{actions}</div>}
    </div>
  );
}
