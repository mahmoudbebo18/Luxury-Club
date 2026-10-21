// Write an email to one member, a selection, or everyone matching a filter; preview, then queue it.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { adminError, memberIdsFor } from './memberFilter';
import type { Target } from './AssignModal';

/** Plain text with blank-line paragraphs → simple HTML; {{name}} is filled per member by the mail worker. */
export function textToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

export function CampaignModal({ open, onClose, target }: { open: boolean; onClose: () => void; target: Target | null }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('أهلًا {{name}}،\n\n');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = subject.trim().length > 0 && body.replace('أهلًا {{name}}،', '').trim().length > 0;

  const send = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const ids = target.ids ?? (await memberIdsFor(target.filter ?? {}));
      const { error } = await supabase.rpc('admin_create_campaign', {
        p_subject: subject.trim(),
        p_body_html: textToHtml(body),
        p_audience: target.label,
        p_member_ids: ids,
      });
      if (error) throw error;
      toast(`أُضيفت ${ids.length} رسالة إلى طابور الإرسال.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setSubject('');
      setBody('أهلًا {{name}}،\n\n');
      setPreview(false);
      onClose();
    } catch (err) {
      setError(adminError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="رسالة بريد جديدة"
      onClose={onClose}
      footer={
        <div className="modal-foot-row">
          <button type="button" className="btn btn-ghost" onClick={() => setPreview((p) => !p)} disabled={!valid}>
            {preview ? 'تعديل' : 'معاينة'}
          </button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={!valid || busy || !preview}>
            {busy ? <Spinner small /> : `إرسال إلى ${target?.count ?? 0} عضو`}
          </button>
        </div>
      }
    >
      <p className="modal-lead">
        المستلمون: <strong>{target?.label}</strong> ({target?.count ?? 0} عضو). الإرسال يتم عبر الطابور في حدود 250 رسالة يوميًا، والباقي يكمل في الأيام التالية.
      </p>
      {preview ? (
        <div className="email-preview">
          <div className="email-preview-subject">{subject}</div>
          <div className="email-preview-body" dangerouslySetInnerHTML={{ __html: textToHtml(body).replace(/\{\{name\}\}/g, 'محمد') }} />
          <p className="field-hint">المعاينة باسم تجريبي، وكل عضو يرى اسمه. اضغط «إرسال» للتأكيد.</p>
        </div>
      ) : (
        <div className="form-stack">
          <div className="field">
            <label htmlFor="cSubject">العنوان</label>
            <input id="cSubject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
          </div>
          <div className="field">
            <label htmlFor="cBody">نص الرسالة</label>
            <textarea id="cBody" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
            <span className="field-hint">اترك سطرًا فارغًا بين الفقرات. اكتب {'{{name}}'} ليظهر اسم العضو.</span>
          </div>
        </div>
      )}
      {error && <div className="form-status is-error">{error}</div>}
    </Modal>
  );
}
