import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Field, FormStatus } from '../../components/Field';
import { Spinner } from '../../components/PageLoader';
import { AuthShell } from './AuthShell';

export default function Login() {
  const { t, lang } = useT();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/account';
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string; unconfirmed?: boolean } | null>(null);

  const schema = z.object({
    email: z.string().trim().email(t('common.invalidEmail')),
    password: z.string().min(1, t('common.required')),
  });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, getValues, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  if (session) return <Navigate to={next} replace />;

  const onSubmit = async (values: Values) => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (!error) return navigate(next, { replace: true });
    if (error.code === 'email_not_confirmed') setStatus({ tone: 'error', text: t('auth.notConfirmed'), unconfirmed: true });
    else if (error.status === 429) setStatus({ tone: 'error', text: t('auth.rateLimited') });
    else if (error.code === 'invalid_credentials') setStatus({ tone: 'error', text: t('auth.badCredentials') });
    else setStatus({ tone: 'error', text: t('common.error') });
  };

  const resend = async () => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: getValues('email'),
      options: { emailRedirectTo: `${location.origin}/account` },
    });
    setStatus(error ? { tone: 'error', text: t('auth.rateLimited') } : { tone: 'success', text: t('auth.confirmResent') });
  };

  const e = formState.errors;
  return (
    <AuthShell title={t('auth.loginTitle')} lead={t('auth.loginLead')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="form-stack">
        <Field label={t('common.email')} htmlFor="email" error={e.email?.message} full>
          <input id="email" type="email" dir="ltr" autoComplete="email" {...register('email')} />
        </Field>
        <Field label={t('common.password')} htmlFor="password" error={e.password?.message} full>
          <input id="password" type="password" dir="ltr" autoComplete="current-password" {...register('password')} />
        </Field>
        <Link className="form-link" to="/forgot">{t('auth.forgotLink')}</Link>
        <button className="btn btn-primary btn-block" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : t('auth.loginBtn')}
        </button>
        {status && (
          <FormStatus tone={status.tone}>
            {status.text}
            {status.unconfirmed && (
              <button type="button" className="link-button" onClick={resend}>{t('auth.resendConfirm')}</button>
            )}
          </FormStatus>
        )}
      </form>
      <p className="form-alt">
        {t('auth.noAccount')} <a href={lang === 'en' ? '/index-en.html#join' : '/#join'}>{t('auth.register')}</a>
      </p>
    </AuthShell>
  );
}
