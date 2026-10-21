// Give one coupon from a batch to each target member (and queue the "new coupon" email).
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { adminError, memberIdsFor, type MemberFilter } from './memberFilter';
import { formatDate, formatMoney } from '../../lib/format';

export type Target = { ids?: string[]; filter?: MemberFilter; label: string; count: number };

export function AssignModal({ open, onClose, target, batchId }: { open: boolean; onClose: () => void; target: Target | null; batchId?: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [batch, setBatch] = useState(batchId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const batches = useQuery({
    queryKey: ['admin', 'batches', 'open'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_batches').select('*').gt('remaining', 0).order('created_at', { ascending: false });
      if (error) throw error;
      return data.filter((b) => !b.expires_at || new Date(b.expires_at) > new Date());
    },
  });

  const chosen = batches.data?.find((b) => b.id === (batch || batchId));
  const short = chosen && target ? (chosen.remaining ?? 0) < target.count : false;

  const submit = async () => {
    if (!target || !chosen) return;
    setBusy(true);
    setError(null);
    try {
      const ids = target.ids ?? (await memberIdsFor(target.filter ?? {}));
      const { data, error } = await supabase.rpc('admin_assign_coupons', { p_batch_id: chosen.id!, p_member_ids: ids });
      if (error) throw error;
      toast(`تم توزيع ${data} كوبون، وأُضيفت رسائل «كوبون جديد» إلى طابور البريد.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
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
      title="توزيع كوبونات"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!chosen || short || busy} onClick={submit}>
          {busy ? <Spinner small /> : `توزيع على ${target?.count ?? 0} عضو`}
        </button>
      }
    >
      <div className="form-stack">
        <p className="modal-lead">المستلمون: <strong>{target?.label}</strong> ({target?.count ?? 0} عضو). كل عضو يحصل على كوبون واحد.</p>
        <div className="field">
          <label htmlFor="assignBatch">الدفعة</label>
          <select id="assignBatch" value={batch || batchId || ''} onChange={(e) => setBatch(e.target.value)} disabled={!!batchId}>
            <option value="" disabled>اختر دفعة</option>
            {batches.data?.map((b) => (
              <option key={b.id} value={b.id!}>
                {b.title} · {b.partner_name} · {formatMoney(b.value_sar ?? 0)} ريال · متبقي {b.remaining}
                {b.expires_at ? ` · حتى ${formatDate(b.expires_at)}` : ''}
              </option>
            ))}
          </select>
          {batches.data?.length === 0 && <span className="field-hint">لا توجد دفعات بها كوبونات متبقية. أنشئ دفعة من صفحة الكوبونات.</span>}
        </div>
        {short && (
          <div className="form-status is-error">
            المتبقي في هذه الدفعة {chosen?.remaining} فقط، وهو أقل من عدد الأعضاء المختارين ({target?.count}).
          </div>
        )}
        {error && <div className="form-status is-error">{error}</div>}
      </div>
    </Modal>
  );
}
