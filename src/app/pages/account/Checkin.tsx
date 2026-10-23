// Ambassador check-in at the door: everyone signed up for one activity (grouped by team), with search
// and a one-tap "here" button. Only names and membership numbers, no contact details.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { supabase } from '../../../lib/supabase';
import { useT } from '../../i18n';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState } from '../../components/States';
import { PageLoader, Spinner } from '../../components/PageLoader';
import { formatDateTime, formatTime } from '../../lib/format';

type Person = { member_id: string; name: string; member_no: string; university: string; team_name: string | null; is_captain: boolean; checked_in_at: string | null };
type Roster =
  | { ok: false; error: string }
  | { ok: true; checkin_open: boolean; activity: { id: string; title: string; starts_at: string; location: string; mode: string }; participants: Person[] };

export default function Checkin() {
  const { id = '' } = useParams();
  const { t, lang } = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const roster = useQuery({
    queryKey: ['checkin-roster', id],
    refetchInterval: 30_000, // several ambassadors at the door see each other's check-ins
    queryFn: async () => {
      const { data, error } = await supabase.rpc('checkin_roster', { p_activity_id: id });
      if (error) throw error;
      return data as unknown as Roster;
    },
  });

  const people = roster.data?.ok ? roster.data.participants : [];
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^dsm-?0*/, '');
    const match = (p: Person) => !term || p.name.toLowerCase().includes(term) || p.member_no.toLowerCase().replace(/^dsm-0*/, '').startsWith(term) || (p.team_name ?? '').toLowerCase().includes(term);
    const map = new Map<string, Person[]>();
    for (const p of people.filter(match)) {
      const key = p.team_name ?? '';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [people, q]);

  if (roster.isLoading) return <PageLoader />;
  if (roster.isError || !roster.data) {
    return <div className="container page"><ErrorState message={t('common.error')} onRetry={() => roster.refetch()} retryLabel={t('common.retry')} /></div>;
  }
  if (!roster.data.ok) {
    return (
      <div className="container page">
        <EmptyState icon="calendar" title={t('act.err.not_found')} action={<Link className="btn btn-ghost btn-sm" to="/account/ambassador">{t('common.back')}</Link>} />
      </div>
    );
  }

  const { activity, checkin_open } = roster.data;
  const present = people.filter((p) => p.checked_in_at).length;

  const toggle = async (p: Person) => {
    setBusy(p.member_id);
    const { data, error } = await supabase.rpc('set_checkin', { p_activity_id: activity.id, p_member_id: p.member_id, p_checked: !p.checked_in_at });
    setBusy(null);
    const r = data as unknown as { ok: boolean; error?: string } | null;
    if (error || !r?.ok) return toast(r?.error === 'checkin_closed' ? t('checkin.closed') : t('checkin.err'), 'error');
    queryClient.invalidateQueries({ queryKey: ['checkin-roster', id] });
    queryClient.invalidateQueries({ queryKey: ['checkin-activities'] });
  };

  return (
    <div className="container page checkin">
      <Link className="adm-crumb" to="/account/ambassador"><Icon name="arrow" className="icon-back" />{t('account.ambassadorMine')}</Link>
      <motion.header className="checkin-head" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <span className="dash-chip"><Icon name="qr" />{t('checkin.title')}</span>
          <h1>{activity.title}</h1>
          <p>{formatDateTime(activity.starts_at, lang)}{activity.location && ` · ${activity.location}`}</p>
        </div>
        <div className="checkin-count" aria-label={t('amb.present', { n: present, total: people.length })}>
          <strong>{present}<small>/{people.length}</small></strong>
        </div>
      </motion.header>

      {!checkin_open && (
        <div className="adm-note"><Icon name="info" /><span>{t('checkin.closed')}</span></div>
      )}

      <div className="checkin-search">
        <Icon name="search" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('checkin.search')} aria-label={t('checkin.search')} />
      </div>

      {people.length === 0 ? (
        <div className="surface"><EmptyState icon="users">{t('checkin.empty')}</EmptyState></div>
      ) : groups.length === 0 ? (
        <div className="surface"><EmptyState icon="search">{t('checkin.noMatch')}</EmptyState></div>
      ) : (
        groups.map(([team, list]) => (
          <section key={team} className="surface checkin-group">
            {activity.mode === 'team' && (
              <h2 className="checkin-team">
                <Icon name="trophy" />
                {team || t('checkin.individuals')}
                <small>{list.filter((p) => p.checked_in_at).length}/{list.length}</small>
              </h2>
            )}
            <ul className="checkin-people">
              {list.map((p) => (
                <li key={p.member_id} className={p.checked_in_at ? 'is-in' : undefined}>
                  <span className="avatar">{p.name.trim().charAt(0)}</span>
                  <span className="checkin-person">
                    <strong>{p.name}{p.is_captain && activity.mode === 'team' && <em className="cap-tag">{t('act.captain')}</em>}</strong>
                    <small><span dir="ltr" className="mono">{p.member_no}</span>{p.university && ` · ${p.university}`}{p.checked_in_at && ` · ${formatTime(p.checked_in_at, lang)}`}</small>
                  </span>
                  <button
                    type="button"
                    className={p.checked_in_at ? 'btn btn-xs btn-soft' : 'btn btn-xs btn-primary'}
                    onClick={() => toggle(p)}
                    disabled={busy === p.member_id || !checkin_open}
                  >
                    {busy === p.member_id ? <Spinner small /> : p.checked_in_at ? <><Icon name="undo" />{t('checkin.unmark')}</> : <><Icon name="check" />{t('checkin.mark')}</>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
