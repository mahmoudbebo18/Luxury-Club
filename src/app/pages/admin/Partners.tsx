import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
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
    setBusy(true);
    setError(null);
    const { error } =
      dialog.kind === 'create'
        ? await supabase.rpc('admin_create_partner', { p_name: name, p_pin: pin })
        : dialog.kind === 'edit'
          ? await supabase.rpc('admin_update_partner', { p_id: dialog.partner.id, p_name: name, p_is_active: active })
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
        <PageLoader />
      ) : partners.isError ? (
        <ErrorState message="تعذّر تحميل الكافيهات." onRetry={() => partners.refetch()} />
      ) : !partners.data?.length ? (
        <EmptyState icon="store">لا توجد كافيهات بعد. أضف أول كافيه شريك.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>الكافيه</th><th>الحالة</th><th>أُضيف في</th><th /></tr></thead>
            <tbody>
              {partners.data.map((p) => {
                const locked = p.locked_until && new Date(p.locked_until) > new Date();
                return (
                  <tr key={p.id}>
                    <td className="cell-strong">{p.name}</td>
                    <td>
                      {p.is_active ? <Badge tone="active">نشط</Badge> : <Badge tone="suspended">موقوف</Badge>}
                      {locked && <Badge tone="expired">مقفل حتى {formatTime(p.locked_until)}</Badge>}
                    </td>
                    <td>{formatDate(p.created_at)}</td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => open({ kind: 'edit', partner: p })}>
                        <Icon name="edit" />تعديل
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => open({ kind: 'pin', partner: p })}>
                        <Icon name="lock" />الرقم السري
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!dialog}
        title={title}
        onClose={() => setDialog(null)}
        footer={
          <button type="button" className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy ? <Spinner small /> : 'حفظ'}
          </button>
        }
      >
        <div className="form-stack">
          {dialog?.kind !== 'pin' && (
            <div className="field">
              <label htmlFor="pName">اسم الكافيه</label>
              <input id="pName" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
          )}
          {dialog?.kind !== 'edit' && (
            <div className="field">
              <label htmlFor="pPin">{dialog?.kind === 'pin' ? 'الرقم السري الجديد' : 'الرقم السري'}</label>
              <input id="pPin" className="pin-input" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
              <span className="field-hint">من 4 إلى 8 أرقام. أعطه لمسؤول الكافيه فقط.{dialog?.kind === 'pin' && ' التغيير يلغي كل الأجهزة المحفوظة فورًا.'}</span>
            </div>
          )}
          {dialog?.kind === 'edit' && (
            <label className="check">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              الكافيه نشط (عند الإيقاف لا تظهر كوبوناته ولا تُصرف)
            </label>
          )}
          {error && <div className="form-status is-error">{error}</div>}
        </div>
      </Modal>
    </>
  );
}
