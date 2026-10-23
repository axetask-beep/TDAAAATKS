import React, { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { api, XpSummary, Leaderboards, Challenge } from '../../lib/api';
import { Scope, XP_RULES, LEVELS, TIER_LABELS, planDay, missions, DAY_MS } from '../../lib/insights';
import { ChartCard, ColumnChart, ProgressBar, SERIES, fmtDay } from '../command/Charts';
import { Avatar } from '../common/Avatar';
import { Trophy, Flame, Award, Target, Users, Swords, HeartHandshake, BookOpen, Lock, Plus, Trash2, ShieldCheck, Loader2 } from 'lucide-react';

const KIND_LABELS: Record<string, string> = {
  task_completed: 'Tâche terminée', blocker_resolved: 'Blocage levé', kudos: 'Reconnaissance', project_completed: 'Projet terminé', correction: 'Correction',
};
const LEVEL_KEY = 'axetask_last_seen_level';

export const ProgressView: React.FC = () => {
  const { user } = useAuth();
  const { taskVersion, setSelectedTaskId } = useWorkspace();
  const { notify } = useToast();
  const [xp, setXp] = useState<XpSummary | null>(null);
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [boardMode, setBoardMode] = useState<'teams' | 'people' | 'self'>('teams');
  const isAdmin = user?.role === 'admin';

  const load = useCallback(() => {
    Promise.all([api.getXpSummary(), api.getLeaderboards(days), api.getChallenges(), api.getInsightsScope()])
      .then(([x, b, c, s]) => { setXp(x); setBoards(b); setChallenges(c); setScope(s); setError(null); })
      .catch(e => setError(e.message || 'Chargement impossible'));
  }, [days]);
  useEffect(load, [load, taskVersion]);

  // Level-up moment: once per new level, skipped when the OS asks for reduced motion.
  useEffect(() => {
    if (!xp) return;
    let last = 0;
    try { last = Number(localStorage.getItem(`${LEVEL_KEY}:${user?.id}`) || 0); } catch { /* storage off */ }
    if (last && xp.level.level > last) {
      notify({ type: 'success', title: `Niveau ${xp.level.level} — ${xp.level.name}`, message: 'Nouveau palier de progression atteint.' });
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 }, disableForReducedMotion: true });
    }
    try { localStorage.setItem(`${LEVEL_KEY}:${user?.id}`, String(xp.level.level)); } catch { /* storage off */ }
  }, [xp?.level.level]);

  const plannedMissions = useMemo(() => {
    if (!scope || !xp || !user) return [];
    const now = Date.now();
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const w = new Date(dayStart); w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
    const plan = planDay(scope.tasks, user.id, now, dayStart);
    return missions({ plan, tasks: scope.tasks, userId: user.id, now, dayStart, weekStart: w.getTime(), blockersResolvedToday: xp.today.blockersResolved, validatedThisWeek: xp.validated_this_week });
  }, [scope, xp, user]);

  if (error && !xp) return <div className="p-6 max-w-6xl mx-auto font-mono"><ChartCard title="Progression" question="" error={error}><div /></ChartCard></div>;
  if (!xp || !boards || !challenges || !scope) return <div className="p-6 text-xs text-slate-400 font-mono flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement de la progression…</div>;

  const lvl = xp.level;
  const delta = xp.period.prev30 > 0 ? Math.round(((xp.period.last30 - xp.period.prev30) / xp.period.prev30) * 100) : null;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 font-mono animate-in fade-in duration-150 motion-reduce:animate-none">
      <div className="border-b border-[#1E293B] pb-4">
        <div className="flex items-center gap-2 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-1"><Trophy className="w-3.5 h-3.5" /> Points d'expérience AxeTask (AXP)</div>
        <h1 className="text-xl font-bold text-slate-100">Progression</h1>
        <p className="text-xs text-slate-400 mt-0.5">Les AXP récompensent des événements vérifiés (livrables validés, blocages levés, entraide). Ils ne mesurent pas la valeur professionnelle et ne sont liés à aucune rémunération.</p>
      </div>

      {/* Level + streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="md:col-span-2 bg-gradient-to-br from-[#0F172A] to-[#131B35] border border-[#2563EB]/30 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-[#2563EB]/15 border border-[#2563EB]/50 flex flex-col items-center justify-center shrink-0">
              <span className="text-[9px] text-[#93C5FD] uppercase">Niv.</span>
              <span className="text-2xl font-bold text-slate-100 leading-none">{lvl.level}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-100">{lvl.name}</p>
              <p className="text-[11px] text-slate-400">{xp.total} AXP au total{lvl.next ? ` · ${lvl.toNext} AXP avant ${lvl.next.name}` : ' · niveau maximal'}</p>
              <div className="mt-2"><ProgressBar value={lvl.progress} label="Progression vers le niveau suivant" /></div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-[11px]">
            <span className="text-slate-400">30 derniers jours : <b className="text-slate-100">{xp.period.last30} AXP</b> {delta === null ? <span className="text-slate-500">(pas de référence)</span> : <span className={delta >= 0 ? 'text-emerald-400' : 'text-slate-400'}>({delta >= 0 ? '+' : ''}{delta} % vs 30 j précédents)</span>}</span>
            <span className="text-slate-400">Aujourd'hui : <b className="text-slate-100">{xp.today.earned}</b> / {XP_RULES.dailyCap} AXP max</span>
          </div>
        </section>
        <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4">
          <p className="text-xs font-bold text-slate-100 flex items-center gap-2"><Flame className="w-4 h-4 text-amber-400" /> Série de régularité</p>
          <p className="text-3xl font-bold text-slate-100 mt-2 tabular-nums">{xp.streak.current} <span className="text-xs font-normal text-slate-400">jours ouvrés</span></p>
          <p className="text-[11px] text-slate-500">Record : {xp.streak.best} jours</p>
          <p className="text-[10px] text-slate-500 mt-2">Un jour compte s'il contient une contribution validée. Les week-ends ne comptent pas, et un jour manqué isolé (urgence, congé) ne casse pas la série.</p>
        </section>
      </div>

      {/* Missions */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Missions">
        <p className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-3"><Target className="w-4 h-4 text-[#60A5FA]" /> Missions</p>
        {plannedMissions.length === 0 ? <p className="text-xs text-slate-500">Aucune mission aujourd'hui : rien d'urgent ne vous concerne.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plannedMissions.map(m => (
              <div key={m.id} className={`rounded border p-3 ${m.progress >= m.target ? 'border-emerald-800/60 bg-emerald-950/20' : 'border-[#1E293B]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-100">{m.title}</p>
                  <span className="text-[9px] uppercase text-slate-500 shrink-0">{m.scope}</span>
                </div>
                <p className="text-[10px] text-slate-500 mb-2">{m.why}</p>
                <ProgressBar value={m.progress / m.target} color={m.progress >= m.target ? '#10B981' : SERIES[0]} label={m.title} />
                <p className="text-[10px] text-slate-400 mt-1 tabular-nums">{m.progress} / {m.target}{m.progress >= m.target ? ' — accomplie' : ''}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-3">Missions générées à partir de vos tâches et ajustées à votre charge. Elles ne rapportent pas d'AXP en plus : ce sont les actions elles-mêmes qui comptent (pas de double récompense).</p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="AXP gagnés par semaine" question="Ma progression est-elle régulière ?" empty={xp.weekly.every(w => !w.value)} emptyText="Pas encore d'AXP : terminez et faites valider une tâche."
          table={{ head: ['Semaine du', 'AXP'], rows: xp.weekly.map(w => [fmtDay(w.key), w.value]) }}>
          <ColumnChart data={xp.weekly.map(w => ({ label: fmtDay(w.key), value: w.value }))} unit=" AXP" />
        </ChartCard>

        <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Insignes">
          <p className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-violet-400" /> Insignes</p>
          <ul className="space-y-2">
            {xp.badges.map(b => (
              <li key={b.id} className={`flex items-center gap-3 ${b.earned ? '' : 'opacity-70'}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${b.earned ? 'bg-violet-950/40 border-violet-700/60 text-violet-300' : 'border-[#1E293B] text-slate-600'}`}>
                  {b.earned ? <Award className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-200">{b.name}</p>
                  <p className="text-[10px] text-slate-500">{b.rule}</p>
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">{b.progress[0]}/{b.progress[1]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Leaderboards */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Classements">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="text-xs font-bold text-slate-100 flex items-center gap-2"><Users className="w-4 h-4 text-[#60A5FA]" /> Classements</p>
          <div className="flex gap-1 ml-auto">
            {([['teams', 'Équipes'], ['people', 'Individuel (volontaires)'], ['self', 'Ma progression']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setBoardMode(k)} className={`px-2 py-1 rounded text-[10px] font-semibold ${boardMode === k ? 'bg-[#2563EB]/20 text-[#93C5FD]' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>
            ))}
            <select value={days} onChange={e => setDays(Number(e.target.value))} aria-label="Période" className="bg-[#0B1120] border border-[#1E293B] rounded px-1.5 text-[10px] text-slate-200">
              <option value={7}>7 j</option><option value={30}>30 j</option><option value={90}>90 j</option>
            </select>
          </div>
        </div>
        {boardMode === 'teams' && (
          boards.teams.length === 0 ? <p className="text-xs text-slate-500">Aucun espace.</p> : (
            <ol className="space-y-1.5">
              {boards.teams.map((t, i) => (
                <li key={t.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-[11px]">
                  <span className="text-slate-500 tabular-nums">{i + 1}.</span>
                  <span className="text-slate-200 truncate flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background: t.color }} />{t.name} <span className="text-slate-500">· {t.members} membres · {t.validated} validés · {t.blockers} blocages levés</span></span>
                  <b className="text-slate-100 tabular-nums">{t.xp} AXP</b>
                </li>
              ))}
            </ol>
          )
        )}
        {boardMode === 'people' && (
          <>
            {boards.people.length === 0 ? <p className="text-xs text-slate-500">Personne n'a encore choisi d'apparaître dans le classement individuel.</p> : (
              <ol className="space-y-1.5">
                {boards.people.map((p, i) => (
                  <li key={p.id} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-[11px]">
                    <span className="text-slate-500 tabular-nums">{i + 1}.</span>
                    <span className="text-slate-200 truncate flex items-center gap-2"><Avatar name={p.name} avatarUrl={p.avatar_url || undefined} size="xs" />{p.name}{p.id === user?.id ? ' (vous)' : ''} <span className="text-slate-500">· {p.validated} validés · {p.blockers} blocages</span></span>
                    <b className="text-slate-100 tabular-nums">{p.xp} AXP</b>
                  </li>
                ))}
              </ol>
            )}
            <label className="flex items-center gap-2 mt-3 text-[11px] text-slate-300">
              <input type="checkbox" checked={xp.show_in_leaderboard} onChange={async e => {
                try { await api.setLeaderboardVisibility(e.target.checked); load(); } catch (err: any) { notify({ type: 'error', title: 'Erreur', message: err.message }); }
              }} />
              Apparaître dans le classement individuel (visible par les membres de vos espaces). Désactivé par défaut.
            </label>
          </>
        )}
        {boardMode === 'self' && (
          <p className="text-[11px] text-slate-300">30 derniers jours : <b>{xp.period.last30} AXP</b> · 30 jours précédents : <b>{xp.period.prev30} AXP</b>. Votre seule référence, c'est vous.</p>
        )}
        <p className="text-[10px] text-slate-500 mt-3">Les classements d'équipe sont privilégiés : ils encouragent l'entraide plutôt que la compétition. Ils ne sont pas un indicateur de performance.</p>
      </section>

      <Challenges challenges={challenges} scope={scope} reload={load} />
      <Recognitions boards={boards} scope={scope} reload={load} meId={user!.id} />

      {/* History */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Historique AXP">
        <p className="text-xs font-bold text-slate-100 mb-3">Historique des récompenses</p>
        {xp.events.length === 0 ? <p className="text-xs text-slate-500">Aucun événement.</p> : (
          <ul className="divide-y divide-[#1E293B] max-h-72 overflow-y-auto">
            {xp.events.map(e => (
              <li key={e.id} className={`py-1.5 flex items-center gap-3 text-[11px] ${e.revoked ? 'opacity-60' : ''}`}>
                <span className={`w-12 text-right font-bold tabular-nums ${e.revoked ? 'line-through text-slate-500' : e.points < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{e.points > 0 ? '+' : ''}{e.points}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-slate-200">{KIND_LABELS[e.kind] || e.kind}</span>
                  <span className="text-slate-500"> — {e.reason}{e.revoked ? ` · annulé : ${e.revoked_reason}` : ''}</span>
                </span>
                {e.task_id && <button onClick={() => setSelectedTaskId(e.task_id)} className="text-[10px] text-[#93C5FD] hover:underline shrink-0">tâche</button>}
                <span className="text-[10px] text-slate-500 shrink-0">{new Date(e.created_at).toLocaleDateString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Rules />
      {isAdmin && <Corrections scope={scope} />}
    </div>
  );
};

const Challenges: React.FC<{ challenges: Challenge[]; scope: Scope; reload: () => void }> = ({ challenges, scope, reload }) => {
  const { notify } = useToast();
  const adminWs = scope.workspaces.filter(w => w.my_role === 'admin');
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ workspace_id: adminWs[0]?.id || '', title: '', metric: 'blockers_resolved', target: 5, reward: '', start_at: today, end_at: new Date(Date.now() + 14 * DAY_MS).toISOString().slice(0, 10) });
  const pct = form.metric === 'overdue_reduction' || form.metric === 'on_time_rate';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createChallenge({ ...form, start_at: new Date(`${form.start_at}T00:00:00`).toISOString(), end_at: new Date(`${form.end_at}T23:59:59`).toISOString() });
      setOpen(false); reload();
      notify({ type: 'success', title: 'Défi créé' });
    } catch (err: any) { notify({ type: 'error', title: 'Défi refusé', message: err.message }); }
  };
  const wsName = (id: string) => scope.workspaces.find(w => w.id === id)?.name || '';
  return (
    <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Défis d'équipe">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-bold text-slate-100 flex items-center gap-2"><Swords className="w-4 h-4 text-amber-400" /> Défis d'équipe</p>
        {adminWs.length > 0 && <button onClick={() => setOpen(v => !v)} className="ml-auto text-[11px] px-2 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold flex items-center gap-1"><Plus className="w-3 h-3" /> Nouveau défi</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 p-3 rounded border border-[#1E293B] bg-[#0B1120] text-[11px]">
          <label className="flex flex-col gap-1 text-slate-400">Espace<select required value={form.workspace_id} onChange={e => setForm({ ...form, workspace_id: e.target.value })} className="field">{adminWs.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-slate-400">Titre<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex. Zéro blocage avant la démo" className="field" /></label>
          <label className="flex flex-col gap-1 text-slate-400">Indicateur<select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })} className="field">
            <option value="blockers_resolved">Blocages levés (nombre)</option>
            <option value="validated_tasks">Livrables validés par un pair (nombre)</option>
            <option value="overdue_reduction">Réduction des tâches en retard (%)</option>
            <option value="on_time_rate">Taux de livraison à temps (%)</option>
          </select></label>
          <label className="flex flex-col gap-1 text-slate-400">Objectif {pct ? '(%)' : ''}<input type="number" min={1} max={pct ? 100 : 1000} required value={form.target} onChange={e => setForm({ ...form, target: Number(e.target.value) })} className="field" /></label>
          <label className="flex flex-col gap-1 text-slate-400">Début<input type="date" required value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} className="field" /></label>
          <label className="flex flex-col gap-1 text-slate-400">Fin<input type="date" required value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} className="field" /></label>
          <label className="flex flex-col gap-1 text-slate-400 sm:col-span-2">Récompense symbolique (optionnel)<input value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} placeholder="Ex. Petit-déjeuner d'équipe" className="field" /></label>
          <p className="sm:col-span-2 text-[10px] text-slate-500">Choisissez un objectif atteignable avec les moyens réels de l'équipe. Les indicateurs basés sur la validation par un pair évitent de récompenser la quantité au détriment de la qualité.</p>
          <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="px-3 py-1 rounded text-slate-400">Annuler</button><button className="px-3 py-1 rounded bg-[#2563EB] text-white font-bold">Créer</button></div>
        </form>
      )}
      {challenges.length === 0 ? <p className="text-xs text-slate-500">Aucun défi en cours.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {challenges.map(c => (
            <div key={c.id} className={`rounded border p-3 ${c.success ? 'border-emerald-800/60' : 'border-[#1E293B]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate">{c.title}</p>
                  <p className="text-[10px] text-slate-500">{wsName(c.workspace_id)} · {c.metric_label} · objectif {c.target}{c.unit === '%' ? ' %' : ` ${c.unit}`}</p>
                </div>
                <span className={`text-[9px] uppercase font-bold shrink-0 ${c.success ? 'text-emerald-400' : c.state === 'termine' ? 'text-slate-500' : 'text-amber-400'}`}>
                  {c.success ? 'Réussi' : c.state === 'termine' ? 'Terminé' : c.state === 'a_venir' ? 'À venir' : 'En cours'}
                </span>
              </div>
              <div className="mt-2"><ProgressBar value={c.value / c.target} color={c.success ? '#10B981' : SERIES[1]} label={c.title} /></div>
              <p className="text-[10px] text-slate-400 mt-1">{c.detail} · du {new Date(c.start_at).toLocaleDateString('fr-FR')} au {new Date(c.end_at).toLocaleDateString('fr-FR')}{c.reward ? ` · 🎁 ${c.reward}` : ''}</p>
              {scope.workspaces.find(w => w.id === c.workspace_id)?.my_role === 'admin' && (
                <button onClick={async () => { try { await api.deleteChallenge(c.id); reload(); } catch (err: any) { notify({ type: 'error', title: 'Erreur', message: err.message }); } }}
                  className="mt-1 text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Supprimer</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const Recognitions: React.FC<{ boards: Leaderboards; scope: Scope; reload: () => void; meId: string }> = ({ boards, scope, reload, meId }) => {
  const { notify } = useToast();
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const colleagues = scope.users.filter(u => u.id !== meId);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.giveKudos(to, msg);
      setMsg(''); setTo(''); reload();
      notify({ type: 'success', title: 'Reconnaissance envoyée' });
    } catch (err: any) { notify({ type: 'error', title: 'Impossible', message: err.message }); }
    finally { setBusy(false); }
  };
  return (
    <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4" aria-label="Reconnaissance">
      <p className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-3"><HeartHandshake className="w-4 h-4 text-rose-300" /> Reconnaissance</p>
      <form onSubmit={send} className="flex flex-col sm:flex-row gap-2 mb-3 text-[11px]">
        <select required value={to} onChange={e => setTo(e.target.value)} className="field sm:w-48" aria-label="Collègue">
          <option value="">Remercier un collègue…</option>
          {colleagues.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <input required minLength={5} maxLength={300} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Pour quelle aide concrète ? (ex. a débloqué l'accès API)" className="field flex-1" aria-label="Message" />
        <button disabled={busy || !to || msg.trim().length < 5} className="px-3 py-1 rounded bg-[#2563EB] disabled:opacity-50 text-white font-bold">Envoyer (+{XP_RULES.kudos} AXP)</button>
      </form>
      <p className="text-[10px] text-slate-500 mb-3">{XP_RULES.kudosPerDay} reconnaissances maximum par jour, une par collègue et par jour. Elles rapportent des AXP au collègue, jamais à vous.</p>
      {boards.recognitions.length === 0 ? <p className="text-xs text-slate-500">Aucune reconnaissance pour l'instant.</p> : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {boards.recognitions.map(r => (
            <li key={r.id} className="text-[11px] text-slate-300"><b className="text-slate-100">{r.from_name || 'Quelqu’un'}</b> → <b className="text-slate-100">{r.to_name}</b> : « {r.reason} »{r.task_title ? <span className="text-slate-500"> ({r.task_title})</span> : null} <span className="text-slate-500">· {new Date(r.created_at).toLocaleDateString('fr-FR')}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
};

const Rules: React.FC = () => (
  <details className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 text-[11px] text-slate-300">
    <summary className="text-xs font-bold text-slate-100 cursor-pointer flex items-center gap-2"><BookOpen className="w-4 h-4 text-[#60A5FA]" /> Règles de calcul (transparentes)</summary>
    <div className="mt-3 space-y-3">
      <table className="w-full max-w-xl">
        <thead><tr className="text-left text-slate-400"><th className="py-1">Événement validé</th><th className="py-1 text-right">AXP</th></tr></thead>
        <tbody className="divide-y divide-[#1E293B]">
          <tr><td className="py-1">Tâche {TIER_LABELS.simple.toLowerCase()} terminée (≤ 1 h estimée)</td><td className="text-right tabular-nums">{XP_RULES.simple}</td></tr>
          <tr><td className="py-1">Tâche {TIER_LABELS.medium.toLowerCase()} (1 à 4 h estimées)</td><td className="text-right tabular-nums">{XP_RULES.medium}</td></tr>
          <tr><td className="py-1">Livrable important (&gt; 4 h ou priorité haute) validé par un pair</td><td className="text-right tabular-nums">{XP_RULES.important}</td></tr>
          <tr><td className="py-1">Tâche urgente validée par un pair</td><td className="text-right tabular-nums">{XP_RULES.critical}</td></tr>
          <tr><td className="py-1">Blocage levé (tâche bloquée ≥ {XP_RULES.blockerMinHours} h)</td><td className="text-right tabular-nums">{XP_RULES.blockerResolved}</td></tr>
          <tr><td className="py-1">Reconnaissance reçue d'un collègue</td><td className="text-right tabular-nums">{XP_RULES.kudos}</td></tr>
          <tr><td className="py-1">Projet terminé (bonus collectif à chaque contributeur)</td><td className="text-right tabular-nums">{XP_RULES.projectCompleted}</td></tr>
        </tbody>
      </table>
      <ul className="list-disc pl-4 space-y-1 text-slate-400">
        <li><b>Validation par un pair</b> : la tâche passe de « En révision » à « Terminé » par une autre personne que le responsable. Sans validation, une tâche importante ou urgente est plafonnée à {XP_RULES.unvalidatedCap} AXP.</li>
        <li><b>Une seule récompense par événement</b> : chaque tâche ne peut rapporter qu'une fois. Réouverte, ses AXP sont suspendus ; refermée, les mêmes AXP reviennent (pas de cumul).</li>
        <li><b>Tâche supprimée</b> = annulée : ses AXP sont annulés (l'historique reste visible).</li>
        <li><b>Anti-abus</b> : une tâche créée et fermée par soi-même en moins de {XP_RULES.quickSelfCloseMinutes} min ne rapporte rien ; plafond de {XP_RULES.dailyCap} AXP par jour (le travail excessif n'est pas récompensé).</li>
        <li><b>Retards</b> : aucune pénalité automatique (un retard peut venir d'une validation externe ou d'une dépendance).</li>
        <li><b>Niveaux</b> : {LEVELS.map(l => `${l.level}. ${l.name} (${l.min})`).join(' · ')}.</li>
        <li>Les points sont calculés uniquement par le serveur ; les corrections sont faites par un administrateur, avec un motif, et tracées dans l'historique.</li>
      </ul>
    </div>
  </details>
);

const Corrections: React.FC<{ scope: Scope }> = ({ scope }) => {
  const { notify } = useToast();
  const [userId, setUserId] = useState('');
  const [points, setPoints] = useState(0);
  const [reason, setReason] = useState('');
  return (
    <form className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-4 text-[11px]" onSubmit={async e => {
      e.preventDefault();
      try { await api.addXpCorrection(userId, points, reason); setReason(''); setPoints(0); notify({ type: 'success', title: 'Correction enregistrée', message: "Visible dans l'historique de la personne et le journal d'activité." }); }
      catch (err: any) { notify({ type: 'error', title: 'Correction refusée', message: err.message }); }
    }}>
      <p className="text-xs font-bold text-slate-100 flex items-center gap-2 mb-2"><ShieldCheck className="w-4 h-4 text-[#60A5FA]" /> Correction auditée (administrateurs)</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select required value={userId} onChange={e => setUserId(e.target.value)} className="field sm:w-48" aria-label="Personne"><option value="">Personne…</option>{scope.users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <input type="number" required min={-500} max={500} value={points} onChange={e => setPoints(Number(e.target.value))} className="field sm:w-24" aria-label="Points" />
        <input required minLength={5} value={reason} onChange={e => setReason(e.target.value)} placeholder="Motif (obligatoire)" className="field flex-1" aria-label="Motif" />
        <button className="px-3 py-1 rounded bg-[#2563EB] text-white font-bold">Appliquer</button>
      </div>
    </form>
  );
};
