// Give one coupon from a batch to each target member (and queue the "new coupon" email).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { Modal } from '../../components/Modal';
import { Alert } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { adminError, memberIdsFor, type MemberFilter } from './memberFilter';
import { formatDate, formatMoney } from '../../lib/format';

export type Target = { ids?: string[]; filter?: MemberFilter; label: string; count: number };

type Props = { open: boolean; onClose: () => void; target: Target | null; batchId?: string; onDone?: () => void };

export function AssignModal({ open, onClose, target, batchId, onDone }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [batch, setBatch] = useState(batchId ?? '');
  const [busy, setBusy] = useState(false);
  // Errors show as a toast at the top of the screen, seen however far the form is scrolled.
  const setError = (text: string | null) => text && toast(text, 'error');

  useEffect(() => {
    if (open) {
      setError(null);
      setBatch(batchId ?? '');
    }
  }, [open, batchId]);

  const batches = useQuery({
    queryKey: ['admin', 'batches', 'open'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_batches').select('*').gt('remaining', 0).order('created_at', { ascending: false });
      if (error) throw error;
      return data.filter((b) => !b.expires_at || new Date(b.expires_at) > new Date());
    },
  });

  const chosen = batches.data?.find((b) => b.id === batch);
  const short = chosen && target ? (chosen.remaining ?? 0) < target.count : false;

  const submit = async () => {
    if (!target || !chosen) return;
    setBusy(true);
    setError(null);
    try {
      const ids = target.ids ?? (await memberIdsFor(target.filter ?? {}));
      const { data, error } = await supabase.rpc('admin_assign_coupons', { p_batch_id: chosen.id!, p_member_ids: ids });
      if (error) throw error;
      toast(`تم توزيع ${data} كوبون، وستصل رسائل «كوبون جديد» للأعضاء.`);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone?.();
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
      icon="ticket"
      lead={<>المستلمون: <b>{target?.label}</b> · كل عضو يحصل على كوبون واحد.</>}
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-primary btn-block" disabled={!chosen || short || busy} onClick={submit}>
          {busy ? <Spinner small /> : <><Icon name="check" />توزيع على {target?.count.toLocaleString('en-US') ?? 0} عضو</>}
        </button>
      }
    >
      <div className="ui-form">
        <div className="ui-field">
          <span className="ui-label">اختر الدفعة</span>
          {batches.isLoading ? (
            <Spinner />
          ) : !batches.data?.length ? (
            <Alert tone="info">
              لا توجد دفعات بها كوبونات متبقية. <Link className="link-button" to="/admin/coupons?new=1" onClick={onClose}>أنشئ دفعة جديدة</Link>
            </Alert>
          ) : (
            <div className="pick-list" role="radiogroup">
              {batches.data.map((b) => (
                <label key={b.id} className={b.id === batch ? 'pick is-picked' : 'pick'}>
                  <input type="radio" name="batch" checked={b.id === batch} disabled={!!batchId && b.id !== batchId} onChange={() => setBatch(b.id!)} />
                  <span className="pick-value">{formatMoney(b.value_sar ?? 0)}<small>ريال</small></span>
                  <span className="pick-body">
                    <strong>{b.title}</strong>
                    <small>{b.partner_name} · متبقي {b.remaining}{b.expires_at ? ` · حتى ${formatDate(b.expires_at)}` : ''}</small>
                  </span>
                  <span className="pick-dot"><Icon name="check" /></span>
                </label>
              ))}
            </div>
          )}
        </div>
        <AnimatePresence>
          {short && (
            <Alert tone="error">
              المتبقي في هذه الدفعة {chosen?.remaining} فقط، وهو أقل من عدد الأعضاء المختارين ({target?.count}).
            </Alert>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
