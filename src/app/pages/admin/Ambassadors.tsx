// Ambassador programme: applications to review, current ambassadors ranked by referrals (with the
// list of who signed up through each), past decisions.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle } from './AdminLayout';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { Tabs } from '../../components/Tabs';
import { Alert, TextArea } from '../../components/Field';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateTime, isoDay, type MembershipStatus } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import { STATUS_LABELS } from './memberFilter';
import type { Tables } from '../../types/database';

type Application = Tables<'admin_ambassador_applications'>;
type Tab = 'pending' | 'ambassadors' | 'history';
type Ambassador = { id: string; full_name: string; referral_code: string | null; referrals: number };

export default function Ambassadors() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Ambassador | null>(null);

  const apps = useQuery({
    queryKey: ['admin', 'ambassador-applications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_ambassador_applications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const ambassadors = useQuery({
    queryKey: ['admin', 'ambassadors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_members')
        .select('id, full_name, member_label, university, ambassador_since, referral_code, referrals, status')
        .eq('is_ambassador', true)
        .order('referrals', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pending = (apps.data ?? []).filter((a) => a.status === 'pending');
  const history = (apps.data ?? []).filter((a) => a.status !== 'pending');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const approve = async (a: Application) => {
    if (!(await confirm({ title: 'قبول السفير', message: <>يصبح <b>{a.full_name}</b> سفيرًا، ويحصل على رابط دعوة خاص وصلاحية تسجيل الحضور في الأنشطة، ويصله بريد بالقبول.</>, confirm: 'قبول', icon: 'sparkle' }))) return;
    setBusy(a.id!);
    const { error } = await supabase.rpc('admin_review_ambassador', { p_application_id: a.id!, p_approve: true });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast(`أصبح ${a.full_name} سفيرًا لدسمان.`);
    refresh();
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusy(rejecting.id!);
    setError(null);
    const { error } = await supabase.rpc('admin_review_ambassador', { p_application_id: rejecting.id!, p_approve: false, p_note: note.trim() });
    setBusy(null);
    if (error) return setError(adminError(error));
    toast('رُفض الطلب وأُبلغ العضو.');
    setRejecting(null);
    refresh();
  };

  const revoke = async (id: string, name: string) => {
    if (!(await confirm({ title: 'إلغاء صفة السفير؟', message: <>يفقد <b>{name}</b> صلاحية تسجيل الحضور، ويتوقف احتساب التسجيلات الجديدة عبر رابطه. تبقى عضويته وسجل من دعاهم.</>, confirm: 'إلغاء الصفة', cancel: 'تراجع', danger: true }))) return;
    setBusy(id);
    const { error } = await supabase.rpc('admin_set_ambassador', { p_member_id: id, p_on: false });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast('أُلغيت صفة السفير.');
    refresh();
  };

  return (
    <>
      <AdminTitle title="السفراء" lead="طلبات «كن سفيرًا لدسمان»، والسفراء الحاليون وعدد من سجّل عن طريق كل منهم. لإضافة سفير مباشرة افتح ملف العضو." />
      <div className="settings-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending', label: 'طلبات جديدة', icon: 'bell', count: pending.length },
            { value: 'ambassadors', label: 'السفراء', icon: 'sparkle', count: ambassadors.data?.length },
            { value: 'history', label: 'السابقة', icon: 'history', count: history.length },
          ]}
        />
      </div>

      {tab === 'ambassadors' ? (
        ambassadors.isLoading ? (
          <Skeleton rows={3} height={56} />
        ) : ambassadors.isError ? (
          <ErrorState message="تعذّر تحميل السفراء." onRetry={() => ambassadors.refetch()} />
        ) : !ambassadors.data?.length ? (
          <div className="surface"><EmptyState icon="sparkle" title="لا يوجد سفراء بعد">اقبل طلبًا من «طلبات جديدة»، أو امنح الصفة من ملف العضو.</EmptyState></div>
        ) : (
          <div className="table-card">
            <table className="dtable">
              <thead><tr><th>السفير</th><th>الجامعة</th><th>منذ</th><th>سجّلوا عن طريقه</th><th>كود الدعوة</th><th /></tr></thead>
              <tbody>
                {ambassadors.data.map((m, i) => (
                  <tr key={m.id}>
                    <td className="cell-title">
                      <Link className="cell-strong" to={`/admin/members/${m.id}`}>{i < 3 && (m.referrals ?? 0) > 0 && <span className="rank">{i + 1}</span>}{m.full_name}</Link>
                      <small className="cell-sub mono" dir="ltr">{m.member_label}</small>
                    </td>
                    <td data-label="الجامعة">{m.university || '—'}</td>
                    <td data-label="منذ">{formatDate(m.ambassador_since)}</td>
                    <td data-label="سجّلوا عن طريقه">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setViewing({ id: m.id!, full_name: m.full_name!, referral_code: m.referral_code, referrals: m.referrals ?? 0 })}
                        disabled={!m.referrals}
                        aria-label={`عرض من سجّلوا عن طريق ${m.full_name}`}
                      >
                        <b>{m.referrals}</b>
                        <Icon name="users" />
                        {m.referrals ? 'عرض' : null}
                      </button>
                    </td>
                    <td data-label="كود الدعوة"><span className="mono" dir="ltr">{m.referral_code}</span></td>
                    <td className="cell-actions">
                      {m.status !== 'active' && <StatusBadge status={m.status as MembershipStatus} />}
                      <button type="button" className="btn btn-ghost btn-xs btn-danger-text" onClick={() => revoke(m.id!, m.full_name!)} disabled={busy === m.id}>
                        {busy === m.id ? <Spinner small /> : <Icon name="close" />}إلغاء الصفة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : apps.isLoading ? (
        <Skeleton rows={2} height={160} />
      ) : apps.isError ? (
        <ErrorState message="تعذّر تحميل الطلبات." onRetry={() => apps.refetch()} />
      ) : (tab === 'pending' ? pending : history).length === 0 ? (
        <div className="surface">
          <EmptyState icon={tab === 'pending' ? 'bell' : 'history'} title={tab === 'pending' ? 'لا توجد طلبات جديدة' : 'لا توجد طلبات سابقة'}>
            {tab === 'pending' ? 'يقدّم الأعضاء من صفحة «كن سفيرًا» في حساباتهم، ويصلك بريد بكل طلب.' : undefined}
          </EmptyState>
        </div>
      ) : (
        <div className="apps">
          {(tab === 'pending' ? pending : history).map((a, i) => (
            <motion.article key={a.id} className="surface app-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="app-head">
                <span className="avatar">{(a.full_name ?? '؟').trim().charAt(0)}</span>
                <span className="app-who">
                  <Link className="cell-strong" to={`/admin/members/${a.member_id}`}>{a.full_name}</Link>
                  <small><span className="mono" dir="ltr">{a.member_label}</span>{a.university && ` · ${a.university}`}{a.study_year && ` · ${a.study_year}`}</small>
                </span>
                <span className="app-tags">
                  {a.member_status !== 'active' && <StatusBadge status={a.member_status as MembershipStatus} />}
                  {a.status === 'approved' && <Badge tone="active">مقبول</Badge>}
                  {a.status === 'rejected' && <Badge tone="suspended">مرفوض</Badge>}
                  <small className="muted">{formatDateTime(a.created_at)}</small>
                </span>
              </div>
              <dl className="facts">
                <div className="facts-full"><dt><Icon name="sparkle" />لماذا يريد أن يكون سفيرًا</dt><dd className="pre-line">{a.motivation}</dd></div>
                {a.experience && <div className="facts-full"><dt><Icon name="trophy" />خبرته</dt><dd className="pre-line">{a.experience}</dd></div>}
                {a.social && <div><dt><Icon name="instagram" />حساباته</dt><dd dir="ltr">{a.social}</dd></div>}
                <div><dt><Icon name="phone" />الجوال</dt><dd dir="ltr">{a.phone}</dd></div>
                {a.status !== 'pending' && (
                  <div className="facts-full">
                    <dt><Icon name="check-circle" />القرار</dt>
                    <dd>{a.status === 'approved' ? 'قُبل' : 'رُفض'} في {formatDateTime(a.reviewed_at)}{a.reviewed_by_name && ` بواسطة ${a.reviewed_by_name}`}{a.admin_note && ` · ${a.admin_note}`}</dd>
                  </div>
                )}
              </dl>
              {a.status === 'pending' && (
                <div className="pcard-actions">
                  <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={() => { setRejecting(a); setNote(''); setError(null); }} disabled={busy === a.id}>
                    <Icon name="close" />رفض
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(a)} disabled={busy === a.id || a.member_status !== 'active'}>
                    {busy === a.id ? <Spinner small /> : <><Icon name="check" />قبول سفيرًا</>}
                  </button>
                </div>
              )}
            </motion.article>
          ))}
        </div>
      )}

      <ReferralsModal ambassador={viewing} onClose={() => setViewing(null)} />

      <Modal
        open={!!rejecting}
        title="رفض الطلب"
        icon="x-circle"
        onClose={() => setRejecting(null)}
        footer={
          <div className="ui-modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setRejecting(null)}>تراجع</button>
            <button type="button" className="btn btn-danger" onClick={reject} disabled={busy === rejecting?.id}>
              {busy === rejecting?.id ? <Spinner small /> : <><Icon name="close" />رفض وإبلاغ العضو</>}
            </button>
          </div>
        }
      >
        <div className="ui-form">
          <p className="ui-confirm-text">يصل إلى <b>{rejecting?.full_name}</b> بريد اعتذار، ويستطيع التقديم مرة أخرى لاحقًا.</p>
          <TextArea label="رسالة للعضو" optional="(اختياري، تظهر في البريد وفي صفحته)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: نحتاج سفراء من سنوات متقدمة حاليًا، نتمنى أن تقدّم في الفصل القادم." />
          <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>
        </div>
      </Modal>
    </>
  );
}

// Everyone who signed up through one ambassador's link or code, newest first, with an Excel export.
function ReferralsModal({ ambassador, onClose }: { ambassador: Ambassador | null; onClose: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);
  const list = useQuery({
    queryKey: ['admin', 'referrals', ambassador?.id],
    enabled: !!ambassador,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_members')
        .select('id, full_name, member_label, email, university, study_year, phone, joined_at, expires_at, status, is_trial')
        .eq('referred_by', ambassador!.id)
        .order('joined_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list.data ?? [];
    return (list.data ?? []).filter((m) =>
      [m.full_name, m.member_label, m.university, m.phone].some((v) => v?.toLowerCase().includes(term)),
    );
  }, [list.data, q]);

  const close = () => {
    setQ('');
    onClose();
  };

  // Always the whole list, whatever the search box shows.
  const exportList = async () => {
    if (!ambassador || !list.data?.length) return;
    setExporting(true);
    try {
      await exportExcel(
        `dasman-referrals-${ambassador.referral_code ?? ambassador.id}-${isoDay(new Date().toISOString())}`,
        `دعوات ${ambassador.full_name}`,
        list.data.map((m) => ({
          'رقم العضوية': m.member_label,
          الاسم: m.full_name,
          'البريد الإلكتروني': m.email,
          الهاتف: m.phone,
          الجامعة: m.university,
          'السنة الدراسية': m.study_year,
          الحالة: STATUS_LABELS[m.status as MembershipStatus],
          تجريبية: m.is_trial ? 'نعم' : 'لا',
          'تاريخ التسجيل': isoDay(m.joined_at),
          'تاريخ الانتهاء': isoDay(m.expires_at),
          'دعاه السفير': ambassador.full_name,
          'كود الدعوة': ambassador.referral_code ?? '',
        })),
      );
      toast(`تم تصدير ${list.data.length} عضو.`);
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={!!ambassador}
      wide
      icon="users"
      title={`سجّلوا عن طريق ${ambassador?.full_name ?? ''}`}
      lead={<>{ambassador?.referrals} عضو · كود الدعوة <span className="mono" dir="ltr">{ambassador?.referral_code}</span></>}
      onClose={close}
      footer={
        <div className="ui-modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>إغلاق</button>
          <button type="button" className="btn btn-primary" onClick={exportList} disabled={exporting || !list.data?.length}>
            {exporting ? <Spinner small /> : <Icon name="download" />}
            تصدير Excel
          </button>
        </div>
      }
    >
      {(ambassador?.referrals ?? 0) > 6 && (
        <div className="toolbar-search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الجامعة أو الجوال…" aria-label="بحث في الأعضاء" />
        </div>
      )}
      {list.isLoading ? (
        <Skeleton rows={4} height={48} />
      ) : list.isError ? (
        <ErrorState message="تعذّر تحميل الأعضاء." onRetry={() => list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState icon="users">لم يسجّل أحد عن طريقه بعد.</EmptyState>
      ) : !shown.length ? (
        <EmptyState icon="search">لا نتائج مطابقة.</EmptyState>
      ) : (
        <ul className="ref-list">
          {shown.map((m) => (
            <li key={m.id}>
              <span className="avatar">{(m.full_name ?? '؟').trim().charAt(0)}</span>
              <span className="ref-list-body">
                <Link className="cell-strong" to={`/admin/members/${m.id}`} onClick={close}>{m.full_name}</Link>
                <small>
                  <span className="mono" dir="ltr">{m.member_label}</span>
                  {[m.university, m.study_year, `انضم ${formatDate(m.joined_at)}`].filter(Boolean).map((v) => ` · ${v}`)}
                </small>
                {m.phone && (
                  <small>
                    <a href={`https://wa.me/${m.phone.replace(/^0/, '966').replace(/^\+/, '')}`} target="_blank" rel="noopener" dir="ltr">{m.phone}</a>
                  </small>
                )}
              </span>
              {m.is_trial && m.status === 'active' ? <Badge tone="gold">تجريبية</Badge> : <StatusBadge status={m.status as MembershipStatus} />}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
