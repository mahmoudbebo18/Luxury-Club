// Landing page of the reset-password email (also used by "set your password" for imported members).
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Field, FormStatus } from '../../components/Field';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { AuthShell } from './AuthShell';

export default function Reset() {
  const { t } = useT();
  const { session, ready } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  // The recovery link signs the user in from the URL; give supabase-js a moment to finish.
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  const schema = z
    .object({
      password: z.string().min(8, t('auth.passwordMin')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { message: t('auth.passwordMismatch'), path: ['confirm'] });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const linkError = new URLSearchParams(location.hash.slice(1)).get('error_description') ?? new URLSearchParams(location.search).get('error_description');

  if (!ready || (!session && !waited && !linkError)) return <PageLoader />;

  if (!session) {
    return (
      <AuthShell title={t('auth.resetTitle')} lead={t('auth.resetInvalid')}>
        <Link className="btn btn-primary btn-block" to="/forgot">{t('auth.forgotBtn')}</Link>
      </AuthShell>
    );
  }

  const onSubmit = async ({ password }: Values) => {
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.code === 'weak_password' ? t('auth.passwordMin') : err.code === 'same_password' ? t('auth.resetDone') : t('common.error'));
      if (err.code !== 'same_password') return;
    }
    toast(t('auth.resetDone'));
    navigate('/account', { replace: true });
  };

  const e = formState.errors;
  return (
    <AuthShell title={t('auth.resetTitle')} lead={t('auth.resetLead')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="form-stack">
        <Field label={t('auth.newPassword')} htmlFor="password" error={e.password?.message} hint={t('auth.passwordMin')} full>
          <input id="password" type="password" dir="ltr" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label={t('auth.confirmPassword')} htmlFor="confirm" error={e.confirm?.message} full>
          <input id="confirm" type="password" dir="ltr" autoComplete="new-password" {...register('confirm')} />
        </Field>
        <button className="btn btn-primary btn-block" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : t('auth.resetBtn')}
        </button>
        {error && <FormStatus tone="error">{error}</FormStatus>}
      </form>
    </AuthShell>
  );
}
