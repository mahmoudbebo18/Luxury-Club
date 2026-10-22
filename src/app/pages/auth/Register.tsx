// Sign-up in two short steps (account, then student details). The profile row is created from the
// sign-up metadata by a database trigger; the account works after the emailed confirmation link.
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, Checkbox, PasswordField, TextArea, TextField, FieldMessage } from '../../components/Field';
import { Combobox } from '../../components/Combobox';
import { Icon } from '../../components/Icon';
import { PasswordStrength } from '../../components/PasswordStrength';
import { Spinner } from '../../components/PageLoader';
import { PHONE_RE, STUDY_YEARS, UNIVERSITIES, cleanPhone, passwordChecks } from '../../lib/options';
import { AuthHead, AuthSwitch } from './AuthShell';
import { CheckEmail } from './CheckEmail';

const STEP1 = ['full_name', 'email', 'password', 'confirm'] as const;

export default function Register() {
  const { t, lang } = useT();
  const { session } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [dir, setDir] = useState(1);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; exists?: boolean } | null>(null);

  const req = z.string().trim().min(1, t('common.required'));
  const schema = z
    .object({
      full_name: req.refine((v) => v.split(/\s+/).length >= 2, t('reg.nameShort')),
      email: req.email(t('common.invalidEmail')),
      password: z.string().refine((p) => Object.values(passwordChecks(p)).every(Boolean), t('auth.passwordMin')),
      confirm: z.string().min(1, t('common.required')),
      university: req,
      study_year: z.string().min(1, t('reg.yearPh')),
      district: req,
      phone: req.refine((v) => PHONE_RE.test(cleanPhone(v)), t('reg.phoneInvalid')),
      notes: z.string().trim().max(500).optional(),
      consent: z.boolean().refine((v) => v, t('reg.consentRequired')),
    })
    .refine((v) => v.password === v.confirm, { message: t('auth.passwordMismatch'), path: ['confirm'] });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, trigger, control, watch, formState, setFocus } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { full_name: '', email: '', password: '', confirm: '', university: '', study_year: '', district: '', phone: '', notes: '', consent: false },
  });
  const password = watch('password');

  if (session && !doneEmail) return <Navigate to="/account" replace />;
  if (doneEmail) return <CheckEmail email={doneEmail} kind="signup" />;

  const goNext = async () => {
    if (!(await trigger([...STEP1], { shouldFocus: true }))) return;
    setDir(1);
    setStep(2);
    setTimeout(() => setFocus('university'), 320);
  };

  const goBack = () => {
    setDir(-1);
    setStep(1);
  };

  const onSubmit = async (v: Values) => {
    setStatus(null);
    const email = v.email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: v.password,
      options: {
        emailRedirectTo: `${location.origin}/account`,
        data: {
          full_name: v.full_name.trim().replace(/\s+/g, ' '),
          university: v.university.trim(),
          study_year: v.study_year,
          district: v.district.trim(),
          phone: cleanPhone(v.phone),
          notes: v.notes?.trim() ?? '',
          lang,
        },
      },
    });
    if (error) {
      const code = error.code;
      if (code === 'user_already_exists' || code === 'email_exists') return setStatus({ text: t('reg.exists'), exists: true });
      if (code === 'weak_password') return setStatus({ text: t('auth.passwordMin') });
      if (error.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return setStatus({ text: t('auth.rateLimited') });
      if (error.name === 'AuthRetryableFetchError') return setStatus({ text: t('common.network') });
      return setStatus({ text: t('common.error') });
    }
    // With email confirmation on, an already-registered address comes back without identities.
    if (data.user && data.user.identities?.length === 0) return setStatus({ text: t('reg.exists'), exists: true });
    setDoneEmail(email);
  };

  // A step-2 error on a step-1 field (e.g. server said the email exists) sends the user back.
  const onInvalid = (errs: Partial<Record<keyof Values, unknown>>) => {
    if (STEP1.some((k) => errs[k])) goBack();
  };

  const e = formState.errors;
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: 40 * d * (lang === 'ar' ? -1 : 1) }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: -40 * d * (lang === 'ar' ? -1 : 1) }),
  };

  return (
    <>
      <AuthHead title={t('reg.title')} lead={t('reg.lead')} />

      <ol className="steps" aria-label={t('reg.stepOf', { n: step })}>
        {[1, 2].map((n) => (
          <li key={n} className={n === step ? 'is-current' : n < step ? 'is-done' : undefined} aria-current={n === step ? 'step' : undefined}>
            <span className="steps-dot">{n < step ? <Icon name="check" /> : n}</span>
            <span className="steps-label">{t(n === 1 ? 'reg.step1' : 'reg.step2')}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="ui-form">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          {step === 1 ? (
            <motion.div key="s1" className="ui-form" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <TextField label={t('reg.name')} icon="user" autoComplete="name" placeholder={t('reg.namePh')} error={e.full_name?.message} {...register('full_name')} />
              <TextField
                label={t('common.email')}
                icon="mail"
                type="email"
                dir="ltr"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('auth.emailPh')}
                error={e.email?.message}
                {...register('email')}
              />
              <div className="ui-field">
                <PasswordField
                  label={t('common.password')}
                  icon="lock"
                  autoComplete="new-password"
                  showLabel={t('common.show')}
                  hideLabel={t('common.hide')}
                  capsLabel={t('common.caps')}
                  error={e.password?.message}
                  {...register('password', { onChange: () => formState.touchedFields.confirm && trigger('confirm') })}
                />
                <PasswordStrength value={password} />
              </div>
              <PasswordField
                label={t('auth.confirmPassword')}
                icon="shield"
                autoComplete="new-password"
                showLabel={t('common.show')}
                hideLabel={t('common.hide')}
                error={e.confirm?.message}
                {...register('confirm')}
              />
              <button type="button" className="btn btn-primary btn-block btn-lg" onClick={goNext}>
                {t('common.next')}
                <Icon name="arrow" className="icon-flip" />
              </button>
            </motion.div>
          ) : (
            <motion.div key="s2" className="ui-form" custom={dir} variants={variants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }}>
              <Controller
                control={control}
                name="university"
                render={({ field }) => (
                  <Combobox
                    ref={field.ref}
                    label={t('reg.university')}
                    icon="cap"
                    placeholder={t('reg.universityPh')}
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                    suggestions={UNIVERSITIES}
                    error={e.university?.message}
                  />
                )}
              />
              <fieldset className="ui-field chips-field">
                <legend className="ui-label">{t('reg.year')}</legend>
                <div className="chips" role="radiogroup">
                  {STUDY_YEARS.map((y) => (
                    <label key={y.value} className="chip-opt">
                      <input type="radio" value={y.value} {...register('study_year')} />
                      <span>{lang === 'ar' ? y.value.replace('السنة ', '') : y.en}</span>
                    </label>
                  ))}
                </div>
                <FieldMessage id="study_year" error={e.study_year?.message} />
              </fieldset>
              <div className="ui-grid">
                <TextField label={t('reg.district')} icon="pin" placeholder={t('reg.districtPh')} autoComplete="address-level3" error={e.district?.message} {...register('district')} />
                <TextField
                  label={t('reg.phone')}
                  icon="phone"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('reg.phonePh')}
                  error={e.phone?.message}
                  {...register('phone')}
                />
              </div>
              <TextArea label={t('reg.notes')} optional={t('common.optional')} rows={2} placeholder={t('reg.notesPh')} maxLength={500} {...register('notes')} />
              <Checkbox error={e.consent?.message} {...register('consent')}>
                {t('reg.consent')}
              </Checkbox>

              <AnimatePresence>
                {status && (
                  <Alert tone="error">
                    {status.text}
                    {status.exists && (
                      <div>
                        <Link className="link-button" to={`/login?email=${encodeURIComponent(watch('email'))}`}>{t('reg.existsAction')}</Link>
                      </div>
                    )}
                  </Alert>
                )}
              </AnimatePresence>

              <div className="step-actions">
                <button type="button" className="btn btn-ghost btn-lg" onClick={goBack}>
                  <Icon name="arrow" className="icon-back" />
                  {t('common.back')}
                </button>
                <button className="btn btn-primary btn-lg" type="submit" disabled={formState.isSubmitting}>
                  {formState.isSubmitting ? <Spinner small /> : (
                    <>
                      <Icon name="sparkle" />
                      {t('reg.submit')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
      <AuthSwitch text={t('auth.haveAccount')} to="/login" label={t('auth.loginLink')} />
    </>
  );
}
