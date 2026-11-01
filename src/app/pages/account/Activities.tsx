// Member activities: upcoming tournaments and events, sign-up (alone or as a team captain who adds
// teammates by membership number), and the member's own sign-ups with leave / edit team.
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import type { StringKey } from '../../i18n/ar';
import { useAuth } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';
import { Modal, useConfirm } from '../../components/Modal';
import { Tabs } from '../../components/Tabs';
import { Alert, TextField } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { Spinner } from '../../components/PageLoader';
import { formatDateTime, memberLabel, statusOf } from '../../lib/format';
import { CATEGORY_ICON, normalizeMemberNo, type MemberActivity, type RpcResult } from '../../lib/activities';

type Tab = 'upcoming' | 'mine';
type Mate = { member_no: string; name: string };

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const },
});

/** Readable message for an RPC error code (act.err.*). */
function useErrText() {
  const { t } = useT();
  return (r: Extract<RpcResult, { ok: false }>) => {
    const key = `act.err.${r.error}` as StringKey;
    const text = t(key, { members: (r.members ?? (r.member_no ? [r.member_no] : [])).join('، '), min: r.min ?? '', max: r.max ?? '' });
    return text === key ? t('common.error') : text;
  };
}

export default function Activities() {
  const { t } = useT();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_activities');
      if (error) throw error;
      return (data ?? []) as unknown as MemberActivity[];
    },
  });

  const all = list.data ?? [];
  const upcoming = all.filter((a) => a.state !== 'ended' && a.state !== 'cancelled');
  const mine = all.filter((a) => a.registration_id);
  const shown = tab === 'upcoming' ? upcoming : mine;
  const current = all.find((a) => a.id === openId) ?? null;
  const active = !!profile && statusOf(profile) === 'active';

  return (
    <div className="container page">
      <motion.header className="dash-hello" {...rise(0)}>
        <div>
          <span className="dash-chip"><Icon name="trophy" />{t('nav.activities')}</span>
          <h1>{t('act.title')}</h1>
          <p>{t('act.lead')}</p>
        </div>
      </motion.header>

      {profile && !active && (
        <motion.div className="dash-alert dash-alert--expired act-inactive" {...rise(1)}>
          <Icon name="alert" />
          <div><p>{t('act.inactive')}</p></div>
        </motion.div>
      )}

      <motion.div className="act-tabs" {...rise(1)}>
        <Tabs
          label={t('act.title')}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'upcoming', label: t('act.tabUpcoming'), count: list.isLoading ? undefined : upcoming.length },
            { value: 'mine', label: t('act.tabMine'), count: list.isLoading ? undefined : mine.length },
          ]}
        />
      </motion.div>

      {list.isLoading ? (
        <Skeleton rows={2} height={260} />
      ) : list.isError ? (
        <ErrorState message={t('common.error')} onRetry={() => list.refetch()} retryLabel={t('common.retry')} />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {shown.length === 0 ? (
              <div className="surface">
                <EmptyState icon="trophy" title={tab === 'upcoming' ? t('act.emptyUpcomingTitle') : undefined}>
                  {tab === 'upcoming' ? t('act.emptyUpcoming') : t('act.emptyMine')}
                </EmptyState>
              </div>
            ) : (
              <div className="acards">
                {shown.map((a, i) => (
                  <ActivityCard key={a.id} a={a} i={i} onOpen={() => setOpenId(a.id)} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {current && <ActivityModal a={current} canRegister={active} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export function ActivityCover({ a }: { a: Pick<MemberActivity, 'image_url' | 'category' | 'title'> }) {
  return a.image_url ? (
    <img className="acard-img" src={a.image_url} alt="" loading="lazy" />
  ) : (
    <span className="acard-img acard-img--blank"><Icon name={CATEGORY_ICON[a.category] ?? 'calendar'} /></span>
  );
}

function SeatsLine({ a }: { a: MemberActivity }) {
  const { t } = useT();
  const left = Math.max(0, a.capacity - a.taken);
  const pct = Math.min(100, (a.taken / a.capacity) * 100);
  return (
    <div className="acard-seats">
      <div className="acard-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} className={left === 0 ? 'is-full' : left <= Math.ceil(a.capacity * 0.2) ? 'is-low' : undefined} /></div>
      <small>{t(a.mode === 'team' ? 'act.teamsLeft' : 'act.seatsLeft', { n: left, total: a.capacity })}</small>
    </div>
  );
}

function ModeLine({ a }: { a: MemberActivity }) {
  const { t } = useT();
  if (a.mode === 'individual') return <>{t('act.individual')}</>;
  return <>{a.team_min === a.team_max ? t('act.teamModeFixed', { n: a.team_max ?? '' }) : t('act.teamMode', { min: a.team_min ?? '', max: a.team_max ?? '' })}</>;
}

function ActivityCard({ a, i, onOpen }: { a: MemberActivity; i: number; onOpen: () => void }) {
  const { t, lang } = useT();
  const off = a.state === 'ended' || a.state === 'cancelled';
  return (
    <motion.button type="button" className={off ? 'acard is-off' : 'acard'} onClick={onOpen} {...rise(i + 2)}>
      <div className="acard-media">
        <ActivityCover a={a} />
        <span className="acard-cat"><Icon name={CATEGORY_ICON[a.category] ?? 'calendar'} />{t(`act.cat.${a.category}` as StringKey)}</span>
        {a.registration_id ? (
          <span className="acard-state is-in"><Icon name="check" />{a.checked_in_at ? t('act.checkedIn') : t('act.registered')}</span>
        ) : (
          <span className={`acard-state is-${a.state}`}>{t(`act.state.${a.state}` as StringKey)}</span>
        )}
      </div>
      <div className="acard-body">
        <h3>{a.title}</h3>
        <span className="acard-line"><Icon name="calendar" />{formatDateTime(a.starts_at, lang)}</span>
        {a.location && <span className="acard-line"><Icon name="pin" />{a.location}</span>}
        <span className="acard-line"><Icon name="users" /><ModeLine a={a} /></span>
        {a.registration_id && a.team_name && <span className="acard-line acard-team"><Icon name="trophy" />{a.team_name}</span>}
        {!off && <SeatsLine a={a} />}
      </div>
    </motion.button>
  );
}

function ActivityModal({ a, canRegister, onClose }: { a: MemberActivity; canRegister: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const errText = useErrText();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'register' | 'edit' | 'done'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['activities'] });
  const registered = !!a.registration_id;
  const editable = a.state === 'open' || a.state === 'full';

  const registerIndividual = async () => {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('register_activity', { p_activity_id: a.id });
    setBusy(false);
    if (rpcError) return setError(t('common.error'));
    const r = data as unknown as RpcResult;
    if (!r.ok) {
      refresh();
      return setError(errText(r));
    }
    setMode('done');
    refresh();
  };

  const leave = async () => {
    const message = !a.is_captain ? t('act.leaveMember', { team: a.team_name ?? '' }) : a.mode === 'team' ? t('act.leaveCaptain') : t('act.leaveSeat');
    if (!(await confirm({ title: t('act.leaveTitle'), message, confirm: a.is_captain ? t('act.leave') : t('act.leaveTeam'), cancel: t('act.keep'), danger: true }))) return;
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('leave_activity', { p_registration_id: a.registration_id! });
    setBusy(false);
    const r = data as unknown as RpcResult | null;
    if (rpcError || !r) return toast(t('common.error'), 'error');
    if (!r.ok) return toast(errText(r), 'error');
    toast(t('act.left'));
    refresh();
    onClose();
  };

  return (
    <Modal open title={a.title} icon={CATEGORY_ICON[a.category] ?? 'calendar'} onClose={onClose} wide closeLabel={t('common.cancel')}>
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'done' ? (
          <motion.div key="done" className="act-done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.svg className="success-check" viewBox="0 0 96 96" initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
              <circle cx="48" cy="48" r="44" />
              <motion.path d="M28 49l13 13 27-28" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
            </motion.svg>
            <h3>{t('act.doneTitle')}</h3>
            <p>{t('act.doneLead')}{a.mode === 'team' ? ` ${t('act.doneTeam')}` : ''}</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>{t('scan.done')}</button>
          </motion.div>
        ) : mode === 'register' || mode === 'edit' ? (
          <motion.div key="team" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <TeamForm
              a={a}
              editing={mode === 'edit'}
              onCancel={() => setMode('view')}
              onDone={() => {
                refresh();
                if (mode === 'edit') {
                  toast(t('act.teamSaved'));
                  setMode('view');
                } else setMode('done');
              }}
            />
          </motion.div>
        ) : (
          <motion.div key="view" className="act-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="act-view-media"><ActivityCover a={a} /></div>
            <dl className="act-facts">
              <div><dt><Icon name="calendar" />{t('act.when')}</dt><dd>{formatDateTime(a.starts_at, lang)}{a.ends_at && <> – {formatDateTime(a.ends_at, lang)}</>}</dd></div>
              {a.location && <div><dt><Icon name="pin" />{t('act.where')}</dt><dd>{a.location}</dd></div>}
              <div><dt><Icon name="users" />{t('act.signupType')}</dt><dd><ModeLine a={a} /></dd></div>
              {a.registration_closes_at && <div><dt><Icon name="clock" />{t('act.closesAt')}</dt><dd>{formatDateTime(a.registration_closes_at, lang)}</dd></div>}
            </dl>
            {a.state !== 'ended' && a.state !== 'cancelled' && <SeatsLine a={a} />}
            {a.description && <p className="act-desc">{a.description}</p>}

            {registered && (
              <div className="act-mine">
                <strong><Icon name="check-circle" />{a.checked_in_at ? t('act.checkedIn') : t('act.registered')}{a.team_name && <> · {a.team_name}</>}</strong>
                {!a.is_captain && a.captain_name && <small>{t('act.addedBy', { name: a.captain_name })}</small>}
                {a.team && a.team.length > 1 && (
                  <ul className="team-list">
                    {a.team.map((m) => (
                      <li key={m.member_no}>
                        <span className="avatar">{m.name.trim().charAt(0)}</span>
                        <span>{m.name}<small dir="ltr" className="mono">{m.member_no}</small></span>
                        {m.is_captain && <em className="cap-tag">{t('act.captain')}</em>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>

            <div className="act-actions">
              {registered ? (
                <>
                  {a.mode === 'team' && a.is_captain && editable && (
                    <button type="button" className="btn btn-ghost" onClick={() => setMode('edit')} disabled={busy}><Icon name="edit" />{t('act.editTeam')}</button>
                  )}
                  {new Date(a.starts_at) > new Date() && a.state !== 'cancelled' && (
                    <button type="button" className="btn btn-ghost btn-danger-text" onClick={leave} disabled={busy}>
                      {busy ? <Spinner small /> : <Icon name="close" />}
                      {a.is_captain ? t('act.leave') : t('act.leaveTeam')}
                    </button>
                  )}
                </>
              ) : a.state === 'open' ? (
                a.mode === 'team' ? (
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => setMode('register')} disabled={!canRegister}><Icon name="users" />{t('act.registerTeam')}</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-lg" onClick={registerIndividual} disabled={busy || !canRegister}>
                    {busy ? <Spinner small /> : <><Icon name="check" />{t('act.register')}</>}
                  </button>
                )
              ) : (
                <span className={`acard-state is-${a.state}`}>{t(`act.state.${a.state}` as StringKey)}</span>
              )}
            </div>
            {!registered && a.state === 'open' && !canRegister && <p className="ui-hint">{t('act.inactive')}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

function TeamForm({ a, editing, onCancel, onDone }: { a: MemberActivity; editing: boolean; onCancel: () => void; onDone: () => void }) {
  const { t } = useT();
  const { profile } = useAuth();
  const errText = useErrText();
  const original: Mate[] = (a.team ?? []).filter((m) => !m.is_captain).map(({ member_no, name }) => ({ member_no, name }));
  const [teamName, setTeamName] = useState(a.team_name ?? '');
  const [mates, setMates] = useState<Mate[]>(editing ? original : []);
  const [input, setInput] = useState('');
  const [lookup, setLookup] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = a.team_max ?? 1;
  const min = a.team_min ?? 1;
  const size = 1 + mates.length;
  const me = profile ? memberLabel(profile.member_no) : '';

  const add = async () => {
    const no = normalizeMemberNo(input);
    setAddError(null);
    if (!no) return setAddError(t('act.err.format'));
    if (no === me) return setAddError(t('act.err.self'));
    if (mates.some((m) => m.member_no === no)) return setAddError(t('act.err.duplicate'));
    if (size >= max) return setAddError(t('act.err.teamFull', { max }));
    setLookup(true);
    const { data, error: rpcError } = await supabase.rpc('find_teammate', { p_activity_id: a.id, p_member_no: no });
    setLookup(false);
    if (rpcError) return setAddError(t('common.error'));
    const r = data as unknown as RpcResult;
    if (r.ok) {
      setMates((m) => [...m, { member_no: String(r.member_no), name: String(r.name) }]);
      setInput('');
      return;
    }
    // While editing, a teammate who was removed and added back is still in this team on the server.
    const back = editing && r.error === 'already_registered' && original.find((m) => m.member_no === no);
    if (back) {
      setMates((m) => [...m, back]);
      setInput('');
      return;
    }
    setAddError(r.error === 'not_found' ? t('act.err.member_not_found', { members: no }) : errText(r));
  };

  const submit = async () => {
    setError(null);
    if (!editing && teamName.trim().length < 2) return setError(t('act.err.team_name_required'));
    if (size < min) return setError(t('act.teamNeed', { min }));
    setBusy(true);
    const nos = mates.map((m) => m.member_no);
    const { data, error: rpcError } = editing
      ? await supabase.rpc('update_team', { p_registration_id: a.registration_id!, p_member_nos: nos })
      : await supabase.rpc('register_activity', { p_activity_id: a.id, p_team_name: teamName.trim(), p_member_nos: nos });
    setBusy(false);
    if (rpcError) return setError(t('common.error'));
    const r = data as unknown as RpcResult;
    if (!r.ok) return setError(errText(r));
    onDone();
  };

  return (
    <form className="ui-form team-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {!editing && <TextField label={t('act.teamName')} icon="trophy" placeholder={t('act.teamNamePh')} maxLength={40} value={teamName} onChange={(e) => setTeamName(e.target.value)} />}

      <div className="ui-field">
        <span className="ui-label">
          {t('act.teammates')}
          <span className={size < min ? 'team-count is-short' : 'team-count'}>{t('act.teamCount', { n: size, max })}</span>
        </span>
        <p className="ui-hint team-hint">{t('act.teammatesHint')}</p>
        <ul className="team-list">
          <li>
            <span className="avatar">{profile?.full_name.trim().charAt(0)}</span>
            <span>{profile?.full_name} ({t('act.you')})<small dir="ltr" className="mono">{me}</small></span>
            <em className="cap-tag">{t('act.captain')}</em>
          </li>
          <AnimatePresence initial={false}>
            {mates.map((m) => (
              <motion.li key={m.member_no} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <span className="avatar">{m.name.trim().charAt(0)}</span>
                <span>{m.name}<small dir="ltr" className="mono">{m.member_no}</small></span>
                <button type="button" className="ui-icon-btn" onClick={() => setMates((list) => list.filter((x) => x.member_no !== m.member_no))} aria-label={t('act.removeMate')}>
                  <Icon name="close" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {size < max && (
          <div className="team-add">
            <TextField
              label={t('act.mateNo')}
              icon="hash"
              dir="ltr"
              placeholder="DSM-0012"
              autoComplete="off"
              value={input}
              error={addError ?? undefined}
              onChange={(e) => {
                setInput(e.target.value);
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" className="btn btn-soft" onClick={add} disabled={lookup || !input.trim()}>
              {lookup ? <Spinner small /> : <><Icon name="plus" />{t('act.addMate')}</>}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>{error && <Alert tone="error">{error}</Alert>}</AnimatePresence>

      <div className="step-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}><Icon name="arrow" className="icon-back" />{t('common.back')}</button>
        <button type="submit" className="btn btn-primary" disabled={busy || size < min}>
          {busy ? <Spinner small /> : <><Icon name="check" />{editing ? t('act.saveTeam') : t('act.confirm')}</>}
        </button>
      </div>
    </form>
  );
}
