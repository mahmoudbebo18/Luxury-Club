import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LangProvider, useT } from './i18n';
import { AuthProvider, RequireAdmin, RequireAuth, RequireMember } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/Modal';
import { EmptyState } from './components/States';
import { PageLoader } from './components/PageLoader';
import { AppLayout } from './layout/AppLayout';
import { AuthLayout } from './pages/auth/AuthShell';
import { AdminLayout } from './pages/admin/AdminLayout';

const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const Forgot = lazy(() => import('./pages/auth/Forgot'));
const Reset = lazy(() => import('./pages/auth/Reset'));
const Dashboard = lazy(() => import('./pages/account/Dashboard'));
const Profile = lazy(() => import('./pages/account/Profile'));
const ManualEntry = lazy(() => import('./pages/scan/ManualEntry'));
const MemberCheck = lazy(() => import('./pages/scan/MemberCheck'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const Members = lazy(() => import('./pages/admin/Members'));
const MemberDetail = lazy(() => import('./pages/admin/MemberDetail'));
const Partners = lazy(() => import('./pages/admin/Partners'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const Redemptions = lazy(() => import('./pages/admin/Redemptions'));
const Emails = lazy(() => import('./pages/admin/Emails'));
const Settings = lazy(() => import('./pages/admin/Settings'));

function NotFound() {
  const { t, lang } = useT();
  return (
    <div className="container page">
      <EmptyState
        icon="search"
        title={t('common.notFound')}
        action={<a className="btn btn-primary btn-sm" href={lang === 'en' ? '/index-en' : '/'}>{t('common.home')}</a>}
      >
        {t('common.notFoundLead')}
      </EmptyState>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot" element={<Forgot />} />
                    <Route path="/reset" element={<Reset />} />
                  </Route>
                  <Route element={<AppLayout />}>
                    <Route path="/account" element={<RequireMember><Dashboard /></RequireMember>} />
                    <Route path="/account/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                    <Route path="/m" element={<ManualEntry />} />
                    <Route path="/m/:code" element={<MemberCheck />} />
                    <Route path="/app" element={<Navigate to="/account" replace />} />
                    <Route path="/app.html" element={<Navigate to="/account" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                    <Route index element={<Overview />} />
                    <Route path="members" element={<Members />} />
                    <Route path="members/:id" element={<MemberDetail />} />
                    <Route path="partners" element={<Partners />} />
                    <Route path="coupons" element={<Coupons />} />
                    <Route path="redemptions" element={<Redemptions />} />
                    <Route path="emails" element={<Emails />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Routes>
              </Suspense>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
