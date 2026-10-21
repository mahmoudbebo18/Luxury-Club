import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Field, FormStatus } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { STUDY_YEARS, UNIVERSITIES } from '../../lib/options';

export default function Profile() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const req = z.string().trim().min(1, t('common.required'));
  const schema = z.object({
    full_name: req,
    university: req,
    study_year: req,
    district: req,
    phone: z.string().trim().regex(/^[0-9+\s-]{9,16}$/, t('profile.phoneInvalid')),
    notes: z.string().trim().optional(),
  });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    values: profile
      ? {
          full_name: profile.full_name,
          university: profile.university,
          study_year: profile.study_year,
          district: profile.district,
          phone: profile.phone,
          notes: profile.notes ?? '',
        }
      : undefined,
  });

  if (!profile) return <PageLoader />;

  const onSubmit = async (values: Values) => {
    setStatus(null);
    const { error } = await supabase
      .from('profiles')
      .update({ ...values, notes: values.notes || null })
      .eq('id', profile.id);
    if (error) return setStatus({ tone: 'error', text: t('common.error') });
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    setStatus({ tone: 'success', text: t('profile.saved') });
  };

  const e = formState.errors;
  return (
    <div className="container account-page account-page--narrow">
      <Link className="back-link" to="/account">
        <Icon name="arrow" className="icon-back" />
        {t('common.back')}
      </Link>
      <div className="page-title">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.lead')}</p>
      </div>
      <form className="join-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="form-grid">
          <Field label={t('profile.name')} htmlFor="full_name" error={e.full_name?.message} full>
            <input id="full_name" autoComplete="name" {...register('full_name')} />
          </Field>
          <Field label={t('profile.university')} htmlFor="university" error={e.university?.message}>
            <input id="university" list="uniList" {...register('university')} />
            <datalist id="uniList">
              {UNIVERSITIES.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
          <Field label={t('profile.year')} htmlFor="study_year" error={e.study_year?.message}>
            <select id="study_year" {...register('study_year')}>
              {STUDY_YEARS.map((y) => (
                <option key={y.value} value={y.value}>
                  {lang === 'ar' ? y.value : y.en}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('profile.district')} htmlFor="district" error={e.district?.message}>
            <input id="district" {...register('district')} />
          </Field>
          <Field label={t('profile.phone')} htmlFor="phone" error={e.phone?.message}>
            <input id="phone" type="tel" dir="ltr" inputMode="tel" autoComplete="tel" {...register('phone')} />
          </Field>
          <Field label={t('common.email')} htmlFor="email" full>
            <input id="email" type="email" dir="ltr" value={profile.email} disabled readOnly />
          </Field>
          <Field label={t('profile.notes')} htmlFor="notes" full>
            <textarea id="notes" rows={3} {...register('notes')} />
          </Field>
        </div>
        <button className="btn btn-primary btn-block join-submit" type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? <Spinner small /> : t('common.save')}
        </button>
        {status && <FormStatus tone={status.tone}>{status.text}</FormStatus>}
        <p className="form-alt">
          <Link to="/reset">{t('profile.changePassword')}</Link>
        </p>
      </form>
    </div>
  );
}
