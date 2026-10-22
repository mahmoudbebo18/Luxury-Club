import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Alert, TextField } from '../../components/Field';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDate, formatTime } from '../../lib/format';

type Partner = { id: string; name: string; is_active: boolean; locked_until: string | null; created_at: string };
type Dialog = { kind: 'create' } | { kind: 'edit'; partner: Partner } | { kind: 'pin'; partner: Partner } | null;

export default function Partners() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_partners').select('*').order('created_at');
      if (error) throw error;
      return data as Partner[];
    },
  });

  const open = (d: Dialog) => {
    setDialog(d);
    setError(null);
    setPin('');
    setName(d && d.kind !== 'create' ? d.partner.name : '');
    setActive(d && d.kind === 'edit' ? d.partner.is_active : true);
  };

  const submit = async () => {
    if (!dialog) return;
    if (dialog.kind !== 'pin' && !name.trim()) return setError('اكتب اسم الكافيه.');
    if (dialog.kind !== 'edit' && !/^\d{4,8}$/.test(pin)) return setError('الرقم السري يجب أن يكون من 4 إلى 8 أرقام.');
    if (dialog.kind !== 'edit' && /^(\d)\1+$|^(0123|1234|2345|3456|4567|5678|6789)/.test(pin)) return setError('اختر رقمًا أصعب من التكرار أو التسلسل.');
    setBusy(true);
    setError(null);
    const { error } =
      dialog.kind === 'create'
        ? await supabase.rpc('admin_create_partner', { p_name: name.trim(), p_pin: pin })
        : dialog.kind === 'edit'
          ? await supabase.rpc('admin_update_partner', { p_id: dialog.partner.id, p_name: name.trim(), p_is_active: active })
          : await supabase.rpc('admin_set_partner_pin', { p_id: dialog.partner.id, p_pin: pin });
    setBusy(false);
    if (error) return setError(adminError(error));
    toast(
      dialog.kind === 'create'
        ? 'تمت إضافة الكافيه.'
        : dialog.kind === 'edit'
          ? 'تم حفظ التعديلات.'
          : 'تم تغيير الرقم السري، وأُلغيت كل الأجهزة المحفوظة لهذا الكافيه.',
    );
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    setDialog(null);
  };

  const title = dialog?.kind === 'create' ? 'إضافة كافيه' : dialog?.kind === 'edit' ? 'تعديل الكافيه' : 'تغيير الرقم السري';

  return (
    <>
      <AdminTitle
        title="الكافيهات"
        lead="الكافيهات الشريكة وأرقامها السرية التي يكتبها الكاشير عند الصرف."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open({ kind: 'create' })}>
            <Icon name="plus" />
            إضافة كافيه
          </button>
        }
      />
      {partners.isLoading ? (
        <Skeleton rows={2} height={140} />
      ) : partners.isError ? (
        <ErrorState message="تعذّر تحميل الكافيهات." onRetry={() => partners.refetch()} />
      ) : !partners.data?.length ? (
        <div className="surface">
          <EmptyState icon="store" title="لا توجد كافيهات بعد" action={<button type="button" className="btn btn-primary btn-sm" onClick={() => open({ kind: 'create' })}><Icon name="plus" />أضف أول كافيه</button>}>
            أضف الكافيه الشريك ورقمه السري، ثم أنشئ له دفعة كوبونات.
          </EmptyState>
        </div>
      ) : (
        <div className="cards">
          {partners.data.map((p, i) => {
            const locked = p.locked_until && new Date(p.locked_until) > new Date();
            return (
              <motion.article key={p.id} className={p.is_active ? 'pcard' : 'pcard is-off'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <div className="pcard-head">
                  <span className="pcard-icon"><Icon name="store" /></span>
                  <div>
                    <h3>{p.name}</h3>
                    <small>أُضيف في {formatDate(p.created_at)}</small>
                  </div>
                </div>
                <div className="pcard-tags">
                  {p.is_active ? <Badge tone="active">نشط</Badge> : <Badge tone="suspended">موقوف</Badge>}
                  {locked && <Badge tone="expired">مقفل حتى {formatTime(p.locked_until)}</Badge>}
                </div>
                <div className="pcard-actions">
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => open({ kind: 'edit', partner: p })}>
                    <Icon name="edit" />تعديل
                  </button>
                  <button type="button" className="btn btn-soft btn-xs" onClick={() => open({ kind: 'pin', partner: p })}>
                    <Icon name="key" />الرقم السري
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <Modal
        open={!!dialog}
        title={title}
        icon={dialog?.kind === 'pin' ? 'key' : 'store'}
        onClose={() => setDialog(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setDialog(null)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
            </button>
          </div>
        }
      >
        <form className="ui-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {dialog?.kind !== 'pin' && <TextField label="اسم الكافيه" icon="store" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="مثال: كافيه الورد" />}
          {dialog?.kind !== 'edit' && (
            <TextField
              label={dialog?.kind === 'pin' ? 'الرقم السري الجديد' : 'الرقم السري'}
              icon="lock"
              className="pin-input"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              hint={`من 4 إلى 8 أرقام، أعطه لمسؤول الكافيه فقط.${dialog?.kind === 'pin' ? ' التغيير يلغي كل الأجهزة المحفوظة فورًا.' : ''}`}
            />
          )}
          {dialog?.kind === 'edit' && (
            <label className="ui-switch switch-card">
              <span>
                <strong>الكافيه نشط</strong>
                <small>عند الإيقاف لا تظهر كوبوناته ولا تُصرف.</small>
              </span>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="ui-switch-track" />
            </label>
          )}
          <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
        </form>
      </Modal>
    </>
  );
}
