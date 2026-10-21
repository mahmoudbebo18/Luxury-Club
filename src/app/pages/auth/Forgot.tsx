import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Field, FormStatus } from '../../components/Field';
import { Spinner } from '../../components/PageLoader';
import { AuthShell } from './AuthShell';

export default function Forgot() {
  const { t } = useT();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const schema = z.object({ email: z.string().trim().email(t('common.invalidEmail')) });
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: Values) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset` });
    // Same message whether or not the address exists, so the form can't be used to probe accounts.
    if (error?.status === 429) setStatus({ tone: 'error', text: t('auth.rateLimited') });
    else setStatus({ tone: 'success', text: t('auth.forgotSent') });
  };

  return (
    <AuthShell title={t('auth.forgotTitle')} lead={t('auth.forgotLead')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="form-stack">
        <Field label={t('common.email')} htmlFor="email" error={formState.errors.email?.message} full>
          <input id="email" type="email" dir="ltr" autoComplete="email" {...register('email')} />
        </Field>
        <button className="btn btn-primary btn-block" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : t('auth.forgotBtn')}
        </button>
        {status && <FormStatus tone={status.tone}>{status.text}</FormStatus>}
      </form>
      <p className="form-alt">
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </p>
    </AuthShell>
  );
}
