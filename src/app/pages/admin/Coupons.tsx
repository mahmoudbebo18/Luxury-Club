import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { AssignModal, type Target } from './AssignModal';
import { adminError, describeFilter, memberQuery, type MemberFilter } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { Dropdown } from '../../components/Dropdown';
import { TextField } from '../../components/Field';
import { ImageField } from '../../components/ImageField';
import { Badge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { endOfDayRiyadh, formatDate, formatMoney, isoDay } from '../../lib/format';
import { removeImage } from '../../lib/upload';

const EMPTY = { partner: '', title: '', value: '', quantity: '', expires: '' };

export default function Coupons() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  // Errors show as a toast at the top of the screen, seen however far the form is scrolled.
  const setError = (text: string | null) => text && toast(text, 'error');
  const [assign, setAssign] = useState<{ batchId: string; target: Target } | null>(null);
  const [audienceFor, setAudienceFor] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFor, setImageFor] = useState<{ id: string; title: string; url: string | null } | null>(null);

  const batches = useQuery({
    queryKey: ['admin', 'batches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_batches').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const partners = useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_partners').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const startCreate = () => {
    setForm(EMPTY);
    setImage(null);
    setError(null);
    setCreating(true);
  };

  // /admin/coupons?new=1 (from the overview) opens the form directly.
  useEffect(() => {
    if (params.get('new') && partners.data?.length) {
      startCreate();
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, partners.data]);

  const create = async () => {
    const value = Number(form.value);
    const quantity = Number(form.quantity);
    if (!form.partner) return setError('اختر الكافيه.');
    if (!form.title.trim()) return setError('اكتب عنوان الكوبون.');
    if (!(value > 0)) return setError('اكتب قيمة صحيحة.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 5000) return setError('العدد من 1 إلى 5000.');
    if (form.expires && form.expires < isoDay(new Date().toISOString())) return setError('تاريخ الانتهاء في الماضي.');
    setBusy(true);
    setError(null);
    const { data: batchId, error } = await supabase.rpc('admin_create_batch', {
      p_partner_id: form.partner,
      p_title: form.title.trim(),
      p_value: value,
      p_quantity: quantity,
      p_expires_at: form.expires ? endOfDayRiyadh(form.expires) : (null as unknown as string),
    });
    if (!error && image) await supabase.from('coupon_batches').update({ image_url: image }).eq('id', batchId);
    setBusy(false);
    if (error) return setError(adminError(error));
    toast(`تم إنشاء ${quantity} كوبون.`);
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    setCreating(false);
  };

  // Pick who receives coupons from a batch: all active members, or chosen members.
  const chooseAudience = async (batchId: string, filter: MemberFilter) => {
    const { count, error } = await memberQuery('id', filter, 'exact').limit(1);
    if (error) return toast('تعذّر حساب عدد الأعضاء.', 'error');
    setAudienceFor(null);
    setAssign({ batchId, target: { filter, label: describeFilter(filter), count: count ?? 0 } });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const activePartners = partners.data?.filter((p) => p.is_active) ?? [];

  return (
    <>
      <AdminTitle
        title="الكوبونات"
        lead="أنشئ دفعة كوبونات لكافيه، ثم وزّعها على الأعضاء."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={startCreate} disabled={!activePartners.length}>
            <Icon name="plus" />
            دفعة جديدة
          </button>
        }
      />
      {partners.data && activePartners.length === 0 && (
        <Link to="/admin/partners" className="adm-note">
          <Icon name="info" />
          <span>أضف كافيه أولًا من صفحة الكافيهات، ثم أنشئ له دفعة كوبونات.</span>
          <Icon name="arrow" className="icon-flip" />
        </Link>
      )}

      {batches.isLoading ? (
        <Skeleton rows={2} height={160} />
      ) : batches.isError ? (
        <ErrorState message="تعذّر تحميل الدفعات." onRetry={() => batches.refetch()} />
      ) : !batches.data?.length ? (
        <div className="surface">
          <EmptyState icon="ticket" title="لا توجد دفعات بعد" action={activePartners.length ? <button type="button" className="btn btn-primary btn-sm" onClick={startCreate}><Icon name="plus" />دفعة جديدة</button> : undefined}>
            الدفعة = مجموعة كوبونات لكافيه واحد، بقيمة وعدد وتاريخ انتهاء.
          </EmptyState>
        </div>
      ) : (
        <div className="cards cards--wide">
          {batches.data.map((b, i) => {
            const expired = !!b.expires_at && new Date(b.expires_at) <= new Date();
            const q = b.quantity ?? 0;
            const pct = (v: number | null) => (q ? ((v ?? 0) / q) * 100 : 0);
            return (
              <motion.article key={b.id} className={expired ? 'bcard is-off' : 'bcard'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                {b.image_url && <img className="bcard-img" src={b.image_url} alt="" loading="lazy" />}
                <div className="bcard-head">
                  <span className="bcard-value">{formatMoney(b.value_sar ?? 0)}<small>ريال</small></span>
                  <div>
                    <h3>{b.title}</h3>
                    <small><Icon name="store" />{b.partner_name}</small>
                  </div>
                </div>
                <div className="bcard-bar" aria-hidden="true">
                  <span className="is-redeemed" style={{ width: `${pct(b.redeemed)}%` }} />
                  <span className="is-assigned" style={{ width: `${pct(b.assigned)}%` }} />
                </div>
                <dl className="bcard-nums">
                  <div><dt><i className="is-redeemed" />مصروف</dt><dd>{b.redeemed}</dd></div>
                  <div><dt><i className="is-assigned" />عند الأعضاء</dt><dd>{b.assigned}</dd></div>
                  <div><dt><i />متبقي</dt><dd>{b.remaining}</dd></div>
                  <div><dt>الإجمالي</dt><dd>{q}</dd></div>
                </dl>
                <div className="bcard-foot">
                  <span className="muted">
                    <Icon name="clock" />
                    {b.expires_at ? `حتى ${formatDate(b.expires_at)}` : 'بدون تاريخ انتهاء'}
                    {expired && <Badge tone="expired">منتهية</Badge>}
                  </span>
                  <button type="button" className="btn btn-ghost btn-xs bcard-img-btn" onClick={() => setImageFor({ id: b.id!, title: b.title!, url: b.image_url })}>
                    <Icon name="edit" />الصورة
                  </button>
                  <button type="button" className="btn btn-gold btn-xs" disabled={!b.remaining || expired} onClick={() => setAudienceFor(b.id!)}>
                    <Icon name="users" />توزيع
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <Modal open={!!audienceFor} title="توزيع على من؟" icon="users" onClose={() => setAudienceFor(null)}>
        <div className="choice-list">
          <button type="button" className="choice" onClick={() => chooseAudience(audienceFor!, { status: 'active' })}>
            <span className="choice-icon"><Icon name="users" /></span>
            <span><strong>كل الأعضاء الساريين</strong><small>كل عضو عضويته سارية يحصل على كوبون.</small></span>
            <Icon name="arrow" className="icon-flip" />
          </button>
          <Link className="choice" to="/admin/members?status=active">
            <span className="choice-icon"><Icon name="check-circle" /></span>
            <span><strong>أعضاء أختارهم</strong><small>حدّدهم من صفحة الأعضاء ثم «توزيع كوبون».</small></span>
            <Icon name="arrow" className="icon-flip" />
          </Link>
        </div>
      </Modal>

      {assign && <AssignModal open onClose={() => setAssign(null)} target={assign.target} batchId={assign.batchId} />}

      <Modal
        open={creating}
        title="دفعة كوبونات جديدة"
        icon="ticket"
        onClose={() => setCreating(false)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>إلغاء</button>
            <button type="button" className="btn btn-primary" onClick={create} disabled={busy || uploading}>
              {busy ? <Spinner small /> : <><Icon name="check" />إنشاء {form.quantity ? `${form.quantity} كوبون` : 'الكوبونات'}</>}
            </button>
          </div>
        }
      >
        <div className="ui-grid">
          <div className="ui-field ui-field--full">
            <span className="ui-label">الكافيه</span>
            <Dropdown block icon="store" placeholder="اختر الكافيه" value={form.partner} onChange={(v) => setForm((f) => ({ ...f, partner: v }))} options={activePartners.map((p) => ({ value: p.id!, label: p.name! }))} />
          </div>
          <TextField label="عنوان الكوبون" icon="ticket" full placeholder="مثال: خصم 50 ريال على أي طلب" value={form.title} onChange={set('title')} maxLength={100} />
          <TextField label="القيمة (ريال)" icon="wallet" type="number" min="1" step="0.5" dir="ltr" inputMode="decimal" value={form.value} onChange={set('value')} />
          <TextField label="عدد الكوبونات" icon="hash" type="number" min="1" max="5000" dir="ltr" inputMode="numeric" value={form.quantity} onChange={set('quantity')} />
          <ImageField label="صورة الكوبون" folder="coupons" value={image} onChange={setImage} onBusy={setUploading} hint="اختيارية: شعار الكافيه أو صورة العرض، تظهر للعضو مع الكوبون." />
          <TextField label="تاريخ الانتهاء" optional="(اختياري)" icon="calendar" full type="date" dir="ltr" value={form.expires} onChange={set('expires')} min={isoDay(new Date().toISOString())} />
        </div>
      </Modal>
      {imageFor && <BatchImage batch={imageFor} onClose={() => setImageFor(null)} />}
    </>
  );
}

/** Change the image of an existing batch (shown on the member's coupons). */
function BatchImage({ batch, onClose }: { batch: { id: string; title: string; url: string | null }; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState(batch.url);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('coupon_batches').update({ image_url: url }).eq('id', batch.id);
    setBusy(false);
    if (error) return toast('تعذّر حفظ الصورة.', 'error');
    if (batch.url && batch.url !== url) removeImage(batch.url);
    toast('تم حفظ صورة الكوبون.');
    queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
    onClose();
  };

  return (
    <Modal
      open
      title={`صورة «${batch.title}»`}
      icon="ticket"
      onClose={onClose}
      footer={
        <div className="ui-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading || url === batch.url}>
            {busy ? <Spinner small /> : <><Icon name="check" />حفظ</>}
          </button>
        </div>
      }
    >
      <ImageField label="صورة الكوبون" folder="coupons" value={url} onChange={setUrl} onBusy={setUploading} hint="تظهر للأعضاء مع الكوبون في حساباتهم." />
    </Modal>
  );
}
