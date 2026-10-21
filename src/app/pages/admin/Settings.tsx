import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import type { Tables } from '../../types/database';

type Template = Tables<'email_templates'>;

const PLACEHOLDERS = '{{name}} {{member_no}} {{expires_at}} {{account_url}} {{coupon_title}} {{coupon_value}} {{partner}} {{coupon_expires}}';

export default function Settings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sender, setSender] = useState({ sender_name: '', reply_to: '' });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => {
      const [settings, tpl] = await Promise.all([
        supabase.from('app_settings').select('*').eq('id', 1).single(),
        supabase.from('email_templates').select('*').order('kind'),
      ]);
      if (settings.error) throw settings.error;
      if (tpl.error) throw tpl.error;
      return { settings: settings.data, templates: tpl.data };
    },
  });

  useEffect(() => {
    if (!data.data) return;
    setSender({ sender_name: data.data.settings.sender_name, reply_to: data.data.settings.reply_to });
    const order = ['welcome', 'coupon', 'expiry_30', 'expired'];
    setTemplates([...data.data.templates].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)));
  }, [data.data]);

  if (data.isLoading) return <PageLoader />;
  if (data.isError || !data.data) return <ErrorState message="تعذّر تحميل الإعدادات." onRetry={() => data.refetch()} />;

  const saveSender = async () => {
    setBusy('sender');
    const { error } = await supabase.from('app_settings').update({ sender_name: sender.sender_name.trim(), reply_to: sender.reply_to.trim() }).eq('id', 1);
    setBusy(null);
    if (error) return toast('تعذّر الحفظ.', 'error');
    toast('تم حفظ بيانات المرسل.');
    queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
  };

  const saveTemplate = async (tpl: Template) => {
    setBusy(tpl.kind);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject: tpl.subject, body_html: tpl.body_html, updated_at: new Date().toISOString() })
      .eq('kind', tpl.kind);
    setBusy(null);
    if (error) return toast('تعذّر حفظ القالب.', 'error');
    toast(`تم حفظ قالب «${tpl.label}».`);
  };

  const edit = (kind: string, patch: Partial<Template>) => setTemplates((list) => list.map((t) => (t.kind === kind ? { ...t, ...patch } : t)));

  return (
    <>
      <AdminTitle title="الإعدادات" lead="بيانات المرسل وقوالب الرسائل التلقائية." />

      <section className="panel">
        <div className="panel-head"><h2>المرسل</h2></div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="sName">اسم المرسل</label>
            <input id="sName" value={sender.sender_name} onChange={(e) => setSender({ ...sender, sender_name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sReply">الرد على</label>
            <input id="sReply" type="email" dir="ltr" value={sender.reply_to} onChange={(e) => setSender({ ...sender, reply_to: e.target.value })} />
          </div>
          <div className="field field--full">
            <label htmlFor="sFrom">بريد الإرسال</label>
            <input id="sFrom" dir="ltr" value={data.data.settings.sender_email} disabled readOnly />
            <span className="field-hint">موثّق في Brevo على دومين الموقع. تغييره يحتاج توثيق دومين جديد.</span>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={saveSender} disabled={busy === 'sender'}>
          {busy === 'sender' ? <Spinner small /> : 'حفظ'}
        </button>
      </section>

      {templates.map((tpl) => (
        <section className="panel" key={tpl.kind}>
          <div className="panel-head"><h2>قالب: {tpl.label}</h2></div>
          <div className="form-stack">
            <div className="field">
              <label htmlFor={`t-${tpl.kind}-s`}>العنوان</label>
              <input id={`t-${tpl.kind}-s`} value={tpl.subject} onChange={(e) => edit(tpl.kind, { subject: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor={`t-${tpl.kind}-b`}>المحتوى (HTML)</label>
              <textarea id={`t-${tpl.kind}-b`} rows={7} dir="rtl" className="code-area" value={tpl.body_html} onChange={(e) => edit(tpl.kind, { body_html: e.target.value })} />
              <span className="field-hint">المتغيرات المتاحة: <span dir="ltr">{PLACEHOLDERS}</span></span>
            </div>
            <div className="email-preview">
              <div className="email-preview-subject">{tpl.subject}</div>
              <div className="email-preview-body" dangerouslySetInnerHTML={{ __html: tpl.body_html }} />
            </div>
            <div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => saveTemplate(tpl)} disabled={busy === tpl.kind}>
                {busy === tpl.kind ? <Spinner small /> : 'حفظ القالب'}
              </button>
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
