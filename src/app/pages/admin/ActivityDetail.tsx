// One activity for the admin: seats, everyone signed up (grouped by seat / team), check-in,
// cancel a sign-up, email the participants, export, cancel or delete the activity.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { AdminTitle, StatCard } from './AdminLayout';
import { ActivityForm } from './Activities';
import { CampaignModal } from './CampaignModal';
import { adminError } from './memberFilter';
import { Icon } from '../../components/Icon';
import { useConfirm } from '../../components/Modal';
import { Badge, StatusBadge } from '../../components/StatusBadge';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { useToast } from '../../components/Toast';
import { formatDateTime, formatTime, isoDay, type MembershipStatus } from '../../lib/format';
import { exportExcel } from '../../lib/excel';
import { removeImage } from '../../lib/upload';
import { CATEGORY_AR, CATEGORY_ICON, STATE_AR, STATE_TONE, type ActivityState, type Category } from '../../lib/activities';
import type { Tables } from '../../types/database';

type RosterRow = Tables<'admin_activity_roster'>;

export default function ActivityDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [mailing, setMailing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const activity = useQuery({
    queryKey: ['admin', 'activity', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_activities').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const roster = useQuery({
    queryKey: ['admin', 'activity', id, 'roster'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_activity_roster').select('*').eq('activity_id', id).order('registered_at').order('is_captain', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Seats in sign-up order, each with its people (a team, or one person).
  const seats = useMemo(() => {
    const term = q.trim().toLowerCase();
    const map = new Map<string, RosterRow[]>();
    for (const r of roster.data ?? []) map.set(r.registration_id!, [...(map.get(r.registration_id!) ?? []), r]);
    return [...map.entries()].filter(([, people]) =>
      !term || people.some((p) => [p.full_name, p.member_label, p.team_name, p.phone, p.email].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [roster.data, q]);

  if (activity.isLoading) return <PageLoader />;
  if (activity.isError) return <ErrorState message="تعذّر تحميل النشاط." onRetry={() => activity.refetch()} />;
  const a = activity.data;
  if (!a) return <EmptyState icon="trophy" title="النشاط غير موجود" action={<Link className="btn btn-ghost btn-sm" to="/admin/activities">الأنشطة</Link>} />;

  const state = (a.state ?? 'open') as ActivityState;
  const team = a.mode === 'team';
  const people = roster.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const toggleCheckin = async (r: RosterRow) => {
    setBusy(`ci-${r.member_id}`);
    const { data, error } = await supabase.rpc('set_checkin', { p_activity_id: a.id!, p_member_id: r.member_id!, p_checked: !r.checked_in_at });
    setBusy(null);
    if (error || !(data as { ok?: boolean } | null)?.ok) return toast('تعذّر تحديث الحضور.', 'error');
    refresh();
  };

  const cancelSeat = async (regId: string, list: RosterRow[]) => {
    const who = list[0]?.team_name ? `فريق «${list[0].team_name}» (${list.length} أشخاص)` : list[0]?.full_name;
    const ok = await confirm({
      title: 'إلغاء التسجيل؟',
      message: <>يُلغى تسجيل <b>{who}</b> ويعود المقعد متاحًا، ويصلهم بريد بالإلغاء.</>,
      confirm: 'إلغاء التسجيل',
      cancel: 'تراجع',
      danger: true,
    });
    if (!ok) return;
    setBusy(`reg-${regId}`);
    const { error } = await supabase.rpc('admin_cancel_registration', { p_registration_id: regId, p_notify: true });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast('أُلغي التسجيل.');
    refresh();
  };

  const cancelActivity = async () => {
    const ok = await confirm({
      title: 'إلغاء النشاط؟',
      message: <>يختفي «{a.title}» من الأنشطة المتاحة، ويصل بريد بالإلغاء إلى كل المسجلين ({a.participants} شخص). لا يمكن التراجع.</>,
      confirm: 'إلغاء النشاط',
      cancel: 'تراجع',
      danger: true,
    });
    if (!ok) return;
    setBusy('cancel');
    const { error } = await supabase.rpc('admin_cancel_activity', { p_activity_id: a.id!, p_notify: true });
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    toast('أُلغي النشاط وأُبلغ المسجلون.');
    refresh();
  };

  const remove = async () => {
    if (!(await confirm({ title: 'حذف النشاط؟', message: 'يُحذف النشاط نهائيًا. متاح فقط لنشاط بلا مسجلين.', confirm: 'حذف', cancel: 'تراجع', danger: true }))) return;
    setBusy('delete');
    const { error } = await supabase.from('activities').delete().eq('id', a.id!);
    setBusy(null);
    if (error) return toast(adminError(error), 'error');
    removeImage(a.image_url);
    toast('حُذف النشاط.');
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    navigate('/admin/activities');
  };

  const exportRoster = async () => {
    setBusy('export');
    try {
      await exportExcel(
        `dasman-activity-${isoDay(a.starts_at)}`,
        a.title ?? 'النشاط',
        people.map((r) => ({
          ...(team ? { الفريق: r.team_name ?? '', القائد: r.is_captain ? 'نعم' : '' } : {}),
          'رقم العضوية': r.member_label,
          الاسم: r.full_name,
          الجوال: r.phone,
          البريد: r.email,
          الجامعة: r.university,
          'تاريخ التسجيل': formatDateTime(r.registered_at),
          الحضور: r.checked_in_at ? formatDateTime(r.checked_in_at) : '',
        })),
      );
    } catch {
      toast('تعذّر التصدير، حاول مرة أخرى.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const cap = a.capacity ?? 0;
  const left = Math.max(0, cap - (a.taken ?? 0));
  const memberIds = [...new Set(people.map((r) => r.member_id!))];

  return (
    <>
      <AdminTitle
        back={{ to: '/admin/activities', label: 'الأنشطة' }}
        title={a.title}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Icon name="edit" />تعديل</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportRoster} disabled={!people.length || busy === 'export'}>
              {busy === 'export' ? <Spinner small /> : <Icon name="download" />}Excel
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setMailing(true)} disabled={!people.length}><Icon name="send" />مراسلة المسجلين</button>
          </>
        }
      />

      <motion.section className="act-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="act-hero-media">
          {a.image_url ? <img src={a.image_url} alt="" /> : <span className="acard-img acard-img--blank"><Icon name={CATEGORY_ICON[a.category as Category] ?? 'calendar'} /></span>}
        </div>
        <div className="act-hero-body">
          <div className="acard-tags">
            <Badge tone={STATE_TONE[state]}>{STATE_AR[state]}</Badge>
            <Badge>{CATEGORY_AR[a.category as Category]}</Badge>
            <Badge>{!team ? 'تسجيل فردي' : a.team_min === a.team_max ? `فرق من ${a.team_max} أشخاص` : `فرق من ${a.team_min} إلى ${a.team_max}`}</Badge>
          </div>
          <dl className="facts">
            <div><dt><Icon name="calendar" />البداية</dt><dd>{formatDateTime(a.starts_at)}</dd></div>
            {a.ends_at && <div><dt><Icon name="clock" />النهاية</dt><dd>{formatDateTime(a.ends_at)}</dd></div>}
            {a.registration_closes_at && <div><dt><Icon name="lock" />آخر موعد للتسجيل</dt><dd>{formatDateTime(a.registration_closes_at)}</dd></div>}
            {a.location && <div><dt><Icon name="pin" />المكان</dt><dd>{a.location}</dd></div>}
            {a.description && <div className="facts-full"><dt><Icon name="file" />الوصف</dt><dd className="pre-line">{a.description}</dd></div>}
          </dl>
        </div>
      </motion.section>

      <div className="stats">
        <StatCard icon="ticket" tone="gold" label={team ? 'الفرق المسجلة' : 'المقاعد المحجوزة'} value={<>{a.taken}<small> / {cap}</small></>} foot={left ? `متبقٍ ${left}` : 'اكتمل العدد'} />
        <StatCard icon="users" label="الأشخاص" value={a.participants ?? 0} />
        <StatCard icon="check-circle" tone="green" label="حضروا" value={a.checked_in ?? 0} foot={a.participants ? `${Math.round(((a.checked_in ?? 0) / a.participants) * 100)}%` : undefined} />
        <StatCard icon="undo" tone="red" label="تسجيلات ملغاة" value={a.cancelled ?? 0} />
      </div>

      <section className="surface">
        <div className="surface-head">
          <h2><Icon name="users" />المسجلون</h2>
          <div className="toolbar-search">
            <Icon name="search" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الفريق…" aria-label="بحث في المسجلين" />
          </div>
        </div>
        {roster.isLoading ? (
          <Skeleton rows={4} height={52} />
        ) : roster.isError ? (
          <ErrorState message="تعذّر تحميل المسجلين." onRetry={() => roster.refetch()} />
        ) : !people.length ? (
          <EmptyState icon="users">لم يسجّل أحد بعد. {state === 'draft' && 'النشاط مسودة ولا يظهر للأعضاء.'}</EmptyState>
        ) : !seats.length ? (
          <EmptyState icon="search">لا نتائج مطابقة.</EmptyState>
        ) : (
          <div className="seats">
            {seats.map(([regId, list], i) => {
              const short = team && list.length < (a.team_min ?? 0);
              return (
                <div key={regId} className="seat">
                  <div className="seat-head">
                    <span className="seat-no">{i + 1}</span>
                    <span className="seat-title">
                      <strong>{team ? list[0]?.team_name : list[0]?.full_name}</strong>
                      <small>سجّل {formatDateTime(list[0]?.registered_at)}{team && ` · ${list.length} أشخاص`}</small>
                    </span>
                    {short && <Badge tone="expired">أقل من الحد الأدنى</Badge>}
                    <button type="button" className="btn btn-ghost btn-xs btn-danger-text" onClick={() => cancelSeat(regId, list)} disabled={busy === `reg-${regId}` || state === 'cancelled'}>
                      {busy === `reg-${regId}` ? <Spinner small /> : <Icon name="close" />}إلغاء
                    </button>
                  </div>
                  <ul className="seat-people">
                    {list.map((r) => (
                      <li key={r.member_id} className={r.checked_in_at ? 'is-in' : undefined}>
                        <span className="seat-person">
                          <Link className="cell-strong" to={`/admin/members/${r.member_id}`}>{r.full_name}</Link>
                          {team && r.is_captain && <em className="cap-tag">القائد</em>}
                          <small><span className="mono" dir="ltr">{r.member_label}</span> · <span dir="ltr">{r.phone}</span>{r.university && ` · ${r.university}`}</small>
                        </span>
                        {r.member_status !== 'active' && <StatusBadge status={r.member_status as MembershipStatus} />}
                        <button type="button" className={r.checked_in_at ? 'btn btn-xs btn-soft' : 'btn btn-xs btn-ghost'} onClick={() => toggleCheckin(r)} disabled={busy === `ci-${r.member_id}`} title={r.checked_in_by_name ? `سجّله ${r.checked_in_by_name}` : undefined}>
                          {busy === `ci-${r.member_id}` ? <Spinner small /> : r.checked_in_at ? <><Icon name="check-circle" />حضر {formatTime(r.checked_in_at)}</> : <><Icon name="check" />تسجيل حضور</>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {((state !== 'cancelled' && state !== 'ended') || !a.taken) && <section className="surface danger-zone">
        <h2 className="surface-title"><Icon name="alert" />إجراءات النشاط</h2>
        <div className="actions-list">
          {state !== 'cancelled' && state !== 'ended' && (
            <button type="button" className="is-danger" onClick={cancelActivity} disabled={!!busy}>
              <span className="al-icon al-icon--red">{busy === 'cancel' ? <Spinner small /> : <Icon name="x-circle" />}</span>
              <span><strong>إلغاء النشاط</strong><small>يختفي من الأنشطة، ويُبلَّغ كل المسجلين بالبريد</small></span>
            </button>
          )}
          {!a.taken && (
            <button type="button" className="is-danger" onClick={remove} disabled={!!busy}>
              <span className="al-icon al-icon--red">{busy === 'delete' ? <Spinner small /> : <Icon name="trash" />}</span>
              <span><strong>حذف النشاط</strong><small>متاح فقط لنشاط بلا مسجلين</small></span>
            </button>
          )}
        </div>
      </section>}

      {editing && <ActivityForm activity={a} onClose={() => setEditing(false)} />}
      <CampaignModal open={mailing} onClose={() => setMailing(false)} target={{ ids: memberIds, label: `المسجلون في «${a.title}»`, count: memberIds.length }} />
    </>
  );
}
