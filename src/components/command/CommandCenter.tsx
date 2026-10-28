import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import {
  Scope, ScopeTask, Filters, KpiKey, KPI_DEFS, applyFilters, kpiTasks, onTimeRate, periodCompare, remainingMinutes,
  projectHealth, criticalNow, planDay, riskBucket, RISK_ORDER, RISK_LABELS, HEALTH_LABELS, Health, isOpen, isImportant,
  isOverdue, dueWithin, isCritical, dailySeries, burnSeries, DAY_MS, Priority,
} from '../../lib/insights';
import { ChartCard, LineChart, StackedBars, ProgressBar, RISK_COLORS, HEALTH_STYLES, SERIES, REFERENCE, fmtHours, fmtDay } from './Charts';
import { StatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import {
  Radar, Target, AlertOctagon, Crosshair, Users, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, X, Zap, CheckCircle2,
  Hourglass, ShieldAlert, Info, BarChart3, Gauge,
} from 'lucide-react';

export type CommandTab = 'pilotage' | 'analyses';

interface Props {
  tab: CommandTab;
  onTabChange: (t: CommandTab) => void;
  onOpenProject: (projectId: string, workspaceId: string) => void;
}

const FILTERS_KEY = 'axetask_command_filters';
const loadFilters = (): Filters => {
  try { return { days: 30, ...JSON.parse(sessionStorage.getItem(FILTERS_KEY) || '{}') }; } catch { return { days: 30 }; }
};

const PRIORITY_LABEL: Record<Priority, string> = { urgente: 'Urgente', haute: 'Haute', normale: 'Normale', basse: 'Basse' };

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—');

export const CommandCenter: React.FC<Props> = ({ tab, onTabChange, onOpenProject }) => {
  const { user } = useAuth();
  const { setSelectedTaskId, taskVersion } = useWorkspace();
  const [scope, setScope] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [drill, setDrill] = useState<KpiKey | null>(null);
  const [healthFilter, setHealthFilter] = useState<Health | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getInsightsScope()
      .then(s => { setScope(s); setError(null); })
      .catch(e => setError(e.message || 'Chargement impossible'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load, taskVersion]);
  useEffect(() => { try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); } catch { /* private mode */ } }, [filters]);

  const now = useMemo(() => (scope ? Date.now() : 0), [scope]);
  const dayStart = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }, [now]);
  const view = useMemo(() => (scope ? applyFilters(scope, filters) : { tasks: [], projects: [] }), [scope, filters]);
  const health = useMemo(() => view.projects.map(p => projectHealth(p, view.tasks, now)), [view, now]);
  const userName = useCallback((id: string | null) => (id ? scope?.users.find(u => u.id === id)?.name || 'Inconnu' : 'Non assigné'), [scope]);
  const userObj = useCallback((id: string | null) => scope?.users.find(u => u.id === id), [scope]);
  const projectName = useCallback((id: string) => scope?.projects.find(p => p.id === id)?.name || 'Projet', [scope]);

  const set = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));

  const header = (
    <div className="flex flex-col gap-3 border-b border-[#1E293B] pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-1">
            <Radar className="w-3.5 h-3.5" /> <span>Centre de contrôle</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">{tab === 'pilotage' ? 'Pilotage opérationnel' : 'Analyses'}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {tab === 'pilotage' ? 'Ce qui demande une action maintenant, vos priorités du jour et la santé des projets.' : 'Rythme, risques, charge et alertes — calculés sur les données réelles, filtres appliqués.'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#0B1120] border border-[#1E293B] rounded p-0.5" role="tablist">
          {(['pilotage', 'analyses'] as CommandTab[]).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => onTabChange(t)}
              className={`px-3 py-1 rounded text-xs font-semibold ${tab === t ? 'bg-[#2563EB]/20 text-[#93C5FD]' : 'text-slate-400 hover:text-slate-200'}`}>
              {t === 'pilotage' ? 'Pilotage' : 'Analyses'}
            </button>
          ))}
        </div>
      </div>
      {scope && (
        <div className="flex flex-wrap gap-2 items-center" aria-label="Filtres">
          <Select label="Période" value={String(filters.days)} onChange={v => set({ days: Number(v) })}
            options={[['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours']]} />
          <Select label="Espace" value={filters.workspace_id || ''} onChange={v => set({ workspace_id: v || undefined, project_id: undefined })}
            options={[['', 'Tous les espaces'], ...scope.workspaces.map(w => [w.id, w.name] as [string, string])]} />
          <Select label="Projet" value={filters.project_id || ''} onChange={v => set({ project_id: v || undefined })}
            options={[['', 'Tous les projets'], ...scope.projects.filter(p => !filters.workspace_id || p.workspace_id === filters.workspace_id).map(p => [p.id, p.name] as [string, string])]} />
          <Select label="Responsable" value={filters.assignee_id || ''} onChange={v => set({ assignee_id: v || undefined })}
            options={[['', 'Tous'], ['none', 'Non assigné'], ...scope.users.map(u => [u.id, u.name] as [string, string])]} />
          <Select label="Priorité" value={filters.priority || ''} onChange={v => set({ priority: (v || undefined) as Priority | undefined })}
            options={[['', 'Toutes'], ['urgente', 'Urgente'], ['haute', 'Haute'], ['normale', 'Normale'], ['basse', 'Basse']]} />
          {(filters.workspace_id || filters.project_id || filters.assignee_id || filters.priority) && (
            <button onClick={() => setFilters({ days: filters.days })} className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"><X className="w-3 h-3" /> Réinitialiser</button>
          )}
          <button onClick={load} className="ml-auto text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1" title="Actualiser">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /> {new Date(scope.generated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </button>
        </div>
      )}
    </div>
  );

  if (!scope) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 font-mono">
        {header}
        <ChartCard title="Centre de contrôle" question="Chargement des données" loading={loading} error={error}><div /></ChartCard>
      </div>
    );
  }

  const tasks = view.tasks;
  const days = filters.days;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 font-mono animate-in fade-in duration-150 motion-reduce:animate-none">
      {header}
      {error && <p className="text-xs text-rose-300 flex items-center gap-2"><AlertOctagon className="w-3.5 h-3.5" /> Dernière actualisation échouée : {error}. Les données affichées datent de {new Date(scope.generated_at).toLocaleTimeString('fr-FR')}.</p>}
      {tab === 'pilotage'
        ? <Pilotage {...{ scope, tasks, health, now, dayStart, days, userId: user!.id, isAdmin: user!.role === 'admin', drill, setDrill, healthFilter, setHealthFilter, userName, userObj, projectName, setSelectedTaskId, onOpenProject }} />
        : <Analyses {...{ scope, tasks, health, now, days, filters, userName, projectName, setSelectedTaskId, isAdmin: user!.role === 'admin' }} />}
    </div>
  );
};

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: [string, string][] }> = ({ label, value, onChange, options }) => (
  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider">
    <span className="hidden sm:inline">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label}
      className="bg-[#0F172A] border border-[#1E293B] rounded px-2 py-1 text-xs text-slate-200 normal-case tracking-normal max-w-[11rem] focus:outline-none focus:border-[#2563EB]/60">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </label>
);

const Delta: React.FC<{ pct: number | null; goodWhenUp?: boolean; suffix?: string }> = ({ pct, goodWhenUp = true, suffix = '%' }) => {
  if (pct === null) return <span className="text-[10px] text-slate-500" title="Pas de référence sur la période précédente">— sans référence</span>;
  if (pct === 0) return <span className="text-[10px] text-slate-400 inline-flex items-center gap-0.5"><Minus className="w-3 h-3" /> stable</span>;
  const good = pct > 0 === goodWhenUp;
  const Icon = pct > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`text-[10px] inline-flex items-center gap-0.5 ${good ? 'text-emerald-400' : 'text-rose-400'}`}><Icon className="w-3 h-3" />{pct > 0 ? '+' : ''}{pct}{suffix} vs période préc.</span>;
};

interface KpiProps { label: string; value: React.ReactNode; hint: string; tone?: string; active?: boolean; onClick?: () => void; extra?: React.ReactNode }
const Kpi: React.FC<KpiProps> = ({ label, value, hint, tone = 'text-slate-100', active, onClick, extra }) => {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} aria-pressed={onClick ? !!active : undefined}
      className={`p-3 rounded-lg border text-left transition-colors min-w-0 ${active ? 'bg-[#2563EB]/10 border-[#2563EB]/60 ring-1 ring-[#2563EB]/30' : 'bg-[#0F172A] border-[#1E293B]'} ${onClick ? 'hover:border-slate-600 cursor-pointer' : ''}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={hint}>{hint}</p>
      {extra && <div className="mt-1">{extra}</div>}
    </C>
  );
};

const TaskRow: React.FC<{ t: ScopeTask; onOpen: (id: string) => void; projectName: (id: string) => string; userName: (id: string | null) => string; right?: React.ReactNode; reasons?: string[] }> = ({ t, onOpen, projectName, userName, right, reasons }) => (
  <button onClick={() => onOpen(t.id)} className="w-full text-left p-2.5 hover:bg-[#1E293B]/60 flex flex-col sm:flex-row sm:items-center gap-2 justify-between group">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-100 break-words group-hover:text-[#93C5FD]">{t.title}</p>
      <p className="text-[10px] text-slate-500 truncate">{projectName(t.project_id)} · {userName(t.assignee_id)}{t.end_at ? ` · échéance ${fmtDate(t.end_at)}` : ''}</p>
      {reasons && <p className="text-[10px] text-[#93C5FD] mt-0.5">{reasons.join(' · ')}</p>}
    </div>
    <div className="flex items-center gap-1.5 shrink-0">{right ?? <><PriorityBadge priority={t.priority} /><StatusBadge status={t.status} /></>}</div>
  </button>
);

// ======================================================================= Pilotage

const Pilotage: React.FC<any> = ({ scope, tasks, health, now, dayStart, days, userId, isAdmin, drill, setDrill, healthFilter, setHealthFilter, userName, userObj, projectName, setSelectedTaskId, onOpenProject }) => {
  const s = scope as Scope;
  const t = tasks as ScopeTask[];
  const h = health as ReturnType<typeof projectHealth>[];
  const cmp = periodCompare(t, now, days);
  const otr = onTimeRate(t, now - days * DAY_MS, now);
  const otrPrev = onTimeRate(t, now - 2 * days * DAY_MS, now - days * DAY_MS);
  const rem = remainingMinutes(t);
  const counts = (k: KpiKey) => kpiTasks(t, k, now, days).length;
  const healthCount = (x: Health) => h.filter(p => p.health === x).length;
  const unread = s.notifications.filter(n => !n.is_read).length;
  const critical = criticalNow(t, h, now);
  const plan = planDay(t, userId, now, dayStart);
  const drillTasks = drill ? kpiTasks(t, drill, now, days) : [];
  const toggle = (k: KpiKey) => setDrill(drill === k ? null : k);
  const otrPct = otr.rate === null ? null : Math.round(otr.rate * 100);
  const otrDelta = otr.rate !== null && otrPrev.rate !== null ? Math.round((otr.rate - otrPrev.rate) * 100) : null;
  const radar = h.filter(p => (healthFilter ? p.health === healthFilter : p.health !== 'termine' && p.health !== 'arrete'))
    .sort((a, b) => ['critique', 'surveiller', 'sain', 'termine', 'arrete'].indexOf(a.health) - ['critique', 'surveiller', 'sain', 'termine', 'arrete'].indexOf(b.health));

  return (
    <>
      {/* A. Executive overview */}
      <section aria-label="Vue exécutive" className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Kpi label={KPI_DEFS.active.label} value={counts('active')} hint={KPI_DEFS.active.hint} active={drill === 'active'} onClick={() => toggle('active')} />
          <Kpi label={`${KPI_DEFS.completed.label} (${days} j)`} value={cmp.cur} hint={`${cmp.prev} sur les ${days} j précédents`} tone="text-emerald-400" active={drill === 'completed'} onClick={() => toggle('completed')} extra={<Delta pct={cmp.deltaPct} />} />
          <Kpi label={KPI_DEFS.overdue.label} value={counts('overdue')} hint={KPI_DEFS.overdue.hint} tone={counts('overdue') ? 'text-orange-400' : 'text-slate-100'} active={drill === 'overdue'} onClick={() => toggle('overdue')} />
          <Kpi label={KPI_DEFS.critical.label} value={counts('critical')} hint={KPI_DEFS.critical.hint} tone={counts('critical') ? 'text-rose-400' : 'text-slate-100'} active={drill === 'critical'} onClick={() => toggle('critical')} />
          <Kpi label={KPI_DEFS.blocked.label} value={counts('blocked')} hint={KPI_DEFS.blocked.hint} tone={counts('blocked') ? 'text-rose-400' : 'text-slate-100'} active={drill === 'blocked'} onClick={() => toggle('blocked')} />
          <Kpi label={KPI_DEFS.review.label} value={counts('review')} hint={KPI_DEFS.review.hint} tone="text-indigo-300" active={drill === 'review'} onClick={() => toggle('review')} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Kpi label="Livrées à temps" value={otrPct === null ? '—' : `${otrPct} %`} hint={otr.sample ? `${otr.sample} tâches avec échéance terminées (${days} j)` : 'Aucune tâche avec échéance terminée'} extra={<Delta pct={otrDelta} suffix=" pts" />} />
          <Kpi label="Charge restante" value={fmtHours(rem.minutes)} hint={`${rem.estimated} estimées · ${rem.unestimated} sans estimation`} />
          <Kpi label="Projets sains" value={healthCount('sain')} hint="Aucun signal de risque" tone="text-emerald-400" active={healthFilter === 'sain'} onClick={() => setHealthFilter(healthFilter === 'sain' ? null : 'sain')} />
          <Kpi label="Sous surveillance" value={healthCount('surveiller')} hint="Retard, blocage ou rythme lent" tone="text-amber-400" active={healthFilter === 'surveiller'} onClick={() => setHealthFilter(healthFilter === 'surveiller' ? null : 'surveiller')} />
          <Kpi label="Projets critiques" value={healthCount('critique')} hint="Voir les règles dans le Radar des projets" tone={healthCount('critique') ? 'text-rose-400' : 'text-slate-100'} active={healthFilter === 'critique'} onClick={() => setHealthFilter(healthFilter === 'critique' ? null : 'critique')} />
          <Kpi label={isAdmin ? 'Alertes non lues (équipe)' : 'Alertes non lues'} value={unread} hint="Notifications non lues, 180 derniers jours" tone={unread ? 'text-amber-300' : 'text-slate-100'}
            onClick={() => window.dispatchEvent(new Event('axetask:open-notifications'))} />
        </div>
        {drill && (
          <div className="bg-[#0F172A] border border-[#2563EB]/40 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E293B] bg-[#0B1120]">
              <p className="text-xs font-bold text-slate-200">{KPI_DEFS[drill as KpiKey].label} — {drillTasks.length} tâche{drillTasks.length > 1 ? 's' : ''} <span className="font-normal text-slate-500">({KPI_DEFS[drill as KpiKey].hint})</span></p>
              <button onClick={() => setDrill(null)} className="p-1 text-slate-400 hover:text-slate-200" aria-label="Fermer"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="divide-y divide-[#1E293B] max-h-80 overflow-y-auto">
              {drillTasks.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">Aucune tâche.</p>
                : drillTasks.map(x => <TaskRow key={x.id} t={x} onOpen={setSelectedTaskId} projectName={projectName} userName={userName} />)}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* B. Critical now */}
        <section className="lg:col-span-3 bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden" aria-label="À traiter maintenant">
          <header className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs font-bold text-slate-100">À traiter maintenant</h2>
            <span className="text-[10px] text-slate-500 ml-auto">{critical.length} point{critical.length > 1 ? 's' : ''}, du plus urgent au moins urgent</span>
          </header>
          {critical.length === 0 ? (
            <div className="p-8 text-center"><CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" /><p className="text-xs text-slate-300">Rien de critique dans ce périmètre.</p></div>
          ) : (
            <ul className="divide-y divide-[#1E293B]">
              {critical.map(c => (
                <li key={c.key} className="p-3 flex gap-3">
                  <span className={`mt-0.5 w-1.5 rounded-full shrink-0 ${c.urgency === 'critique' ? 'bg-rose-500' : 'bg-amber-500'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${c.urgency === 'critique' ? 'text-rose-400' : 'text-amber-400'}`}>{c.urgency === 'critique' ? 'Critique' : 'Haute'} · {c.problem}</span>
                      {c.due && <span className="text-[10px] text-slate-500">échéance {fmtDate(c.due)}</span>}
                    </div>
                    <p className="text-xs font-semibold text-slate-100 break-words">{c.title}</p>
                    <p className="text-[11px] text-slate-400">{c.reason} · Responsable : {userName(c.ownerId)}</p>
                    <p className="text-[11px] text-[#93C5FD] mt-0.5">→ {c.action}</p>
                  </div>
                  <button
                    onClick={() => c.kind === 'task' ? setSelectedTaskId(c.id) : onOpenProject(c.id, s.projects.find(p => p.id === c.id)!.workspace_id)}
                    className="self-center shrink-0 px-2.5 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold">
                    Agir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* C. Today's mission */}
        <section className="lg:col-span-2 bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden" aria-label="Mission du jour">
          <header className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-[#60A5FA]" />
            <h2 className="text-xs font-bold text-slate-100">Mission du jour</h2>
            <span className="text-[10px] text-slate-500 ml-auto">{plan.doneToday} terminée{plan.doneToday > 1 ? 's' : ''} aujourd'hui</span>
          </header>
          <div className="p-3 space-y-3">
            <ProgressBar value={plan.realisticGoal ? plan.doneToday / Math.max(plan.realisticGoal, plan.doneToday) : plan.doneToday ? 1 : 0} label="Progression du jour" />
            <p className="text-[11px] text-slate-400">
              Objectif réaliste : <b className="text-slate-200">{plan.realisticGoal} tâche{plan.realisticGoal > 1 ? 's' : ''}</b> (≈ 6 h de travail concentré, estimations comprises).
              {plan.overloaded && <span className="block text-amber-300 mt-1 flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0" />Charge du jour élevée ({fmtHours(plan.loadMinutes)} en retard ou dû sous 24 h) : seules 2 priorités sont proposées. Parlez-en à votre responsable pour replanifier.</span>}
            </p>
            {plan.main ? (
              <div className="rounded border border-[#2563EB]/40 bg-[#2563EB]/10">
                <p className="px-2.5 pt-2 text-[10px] font-bold text-[#93C5FD] uppercase tracking-wider flex items-center gap-1"><Target className="w-3 h-3" /> Mission principale</p>
                <TaskRow t={plan.main.task} onOpen={setSelectedTaskId} projectName={projectName} userName={userName} reasons={plan.main.reasons} />
              </div>
            ) : <p className="text-xs text-slate-500 text-center py-4">Aucune tâche ouverte assignée.</p>}
            {plan.top.length > 1 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ensuite</p>
                <div className="divide-y divide-[#1E293B] border border-[#1E293B] rounded">
                  {plan.top.slice(1).map((r: any) => <TaskRow key={r.task.id} t={r.task} onOpen={setSelectedTaskId} projectName={projectName} userName={userName} reasons={r.reasons} />)}
                </div>
              </div>
            )}
            {plan.quickWins.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Rapides (≤ 30 min)</p>
                <div className="divide-y divide-[#1E293B] border border-[#1E293B] rounded">
                  {plan.quickWins.map((r: any) => <TaskRow key={r.task.id} t={r.task} onOpen={setSelectedTaskId} projectName={projectName} userName={userName} />)}
                </div>
              </div>
            )}
            {plan.toValidate.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Hourglass className="w-3 h-3 text-indigo-300" /> À valider par vous ({plan.toValidate.length})</p>
                <div className="divide-y divide-[#1E293B] border border-[#1E293B] rounded">
                  {plan.toValidate.slice(0, 5).map((x: ScopeTask) => <TaskRow key={x.id} t={x} onOpen={setSelectedTaskId} projectName={projectName} userName={userName} />)}
                </div>
                {plan.toValidate.length > 5 && <button onClick={() => setDrill('review')} className="text-[10px] text-[#93C5FD] hover:underline mt-1">+ {plan.toValidate.length - 5} autres livrables en révision</button>}
              </div>
            )}
            <p className="text-[10px] text-slate-500">Suggestions calculées (retard, échéance, priorité, statut). Ce n'est pas une obligation : ouvrez une tâche pour changer sa priorité ou son échéance.</p>
          </div>
        </section>
      </div>

      {/* D. Project radar */}
      <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden" aria-label="Radar des projets">
        <header className="px-4 py-3 border-b border-[#1E293B] flex flex-wrap items-center gap-2">
          <Gauge className="w-4 h-4 text-[#60A5FA]" />
          <h2 className="text-xs font-bold text-slate-100">Radar des projets</h2>
          {healthFilter && <button onClick={() => setHealthFilter(null)} className="text-[10px] px-2 py-0.5 rounded border border-[#2563EB]/40 text-[#93C5FD] flex items-center gap-1">{HEALTH_LABELS[healthFilter as Health]} <X className="w-3 h-3" /></button>}
          <details className="ml-auto text-[10px] text-slate-400">
            <summary className="cursor-pointer hover:text-slate-200">Règles de santé</summary>
            <ul className="mt-1 space-y-0.5 list-disc pl-4">
              <li><b className="text-rose-300">Critique</b> : échéance projet dépassée, ≥ 3 tâches en retard, ≥ 30 % des tâches ouvertes en retard, ou ≥ 2 bloquées.</li>
              <li><b className="text-amber-300">Sous surveillance</b> : ≥ 1 tâche en retard, bloquée ou critique, ou planning consommé ≥ 25 pts plus vite que l'avancement.</li>
              <li><b className="text-emerald-300">Sain</b> : aucun de ces signaux. Avancement = tâches terminées / total.</li>
            </ul>
          </details>
        </header>
        {radar.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">Aucun projet actif dans ce périmètre.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] min-w-[720px]">
              <thead className="text-slate-400 text-left">
                <tr className="border-b border-[#1E293B]">
                  {['Projet', 'Santé', 'Avancement', 'Retard', 'Bloquées', 'Charge restante', 'Prochaine échéance', 'Tendance 7 j', 'Responsable'].map(x => <th key={x} className="px-3 py-2 font-semibold">{x}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {radar.map(p => (
                  <tr key={p.project.id} className="hover:bg-[#1E293B]/40 cursor-pointer" onClick={() => onOpenProject(p.project.id, p.project.workspace_id)}>
                    <td className="px-3 py-2 text-slate-100 font-semibold max-w-[14rem] break-words">{p.project.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${HEALTH_STYLES[p.health].chip}`}>{HEALTH_LABELS[p.health]}</span>
                      {p.reasons.length > 0 && <p className="text-[10px] text-slate-500 mt-0.5 max-w-[14rem]">{p.reasons.join(' · ')}</p>}
                    </td>
                    <td className="px-3 py-2 w-36"><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={p.progress} color={HEALTH_STYLES[p.health].color} /></div><span className="tabular-nums text-slate-300">{Math.round(p.progress * 100)} %</span></div><p className="text-[10px] text-slate-500">{p.done}/{p.total} tâches{p.paceGap !== null ? ` · écart planning ${p.paceGap > 0 ? '+' : ''}${p.paceGap} pts` : ''}</p></td>
                    <td className={`px-3 py-2 tabular-nums ${p.overdue ? 'text-orange-400 font-bold' : 'text-slate-400'}`}>{p.overdue}</td>
                    <td className={`px-3 py-2 tabular-nums ${p.blocked ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>{p.blocked}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-300">{fmtHours(p.remaining.minutes)}{p.remaining.unestimated ? <span className="text-slate-500"> (+{p.remaining.unestimated} non est.)</span> : null}</td>
                    <td className="px-3 py-2 text-slate-300">{fmtDate(p.nextDue)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-300">{p.trend.last7} <span className="text-slate-500">vs {p.trend.prev7}</span></td>
                    <td className="px-3 py-2 text-slate-300 truncate max-w-[8rem]">{userName(p.ownerId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* E. Team pulse */}
      <TeamPulse scope={s} tasks={t} now={now} days={days} userName={userName} userObj={userObj} />
    </>
  );
};

const TeamPulse: React.FC<{ scope: Scope; tasks: ScopeTask[]; now: number; days: number; userName: (id: string | null) => string; userObj: (id: string | null) => any }> = ({ scope, tasks, now, days, userName, userObj }) => {
  const teams = scope.workspaces.map(w => {
    const tt = tasks.filter(t => t.workspace_id === w.id);
    const otr = onTimeRate(tt, now - days * DAY_MS, now);
    return {
      w, open: tt.filter(isOpen).length, blocked: tt.filter(t => t.status === 'bloque').length, overdue: tt.filter(t => isOverdue(t, now)).length,
      done: tt.filter(t => t.status === 'termine' && t.completed_at && new Date(t.completed_at).getTime() >= now - days * DAY_MS).length,
      otr, rem: remainingMinutes(tt),
    };
  }).filter(x => x.open + x.done > 0);
  return (
    <section className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden" aria-label="Pouls des équipes">
      <header className="px-4 py-3 border-b border-[#1E293B] flex items-center gap-2">
        <Users className="w-4 h-4 text-[#60A5FA]" />
        <h2 className="text-xs font-bold text-slate-100">Pouls des équipes</h2>
        <span className="text-[10px] text-slate-500 ml-auto">Par espace (équipe) · capacité non renseignée dans AxeTasks</span>
      </header>
      {teams.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">Aucune activité dans ce périmètre.</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-[#1E293B]">
          {teams.map(x => (
            <div key={x.w.id} className="bg-[#0F172A] p-3">
              <p className="text-xs font-bold text-slate-100 flex items-center gap-2 truncate"><span className="w-2 h-2 rounded-sm shrink-0" style={{ background: x.w.color }} />{x.w.name}</p>
              <dl className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                <div><dt className="text-slate-500">Ouvertes</dt><dd className="text-sm font-bold text-slate-100 tabular-nums">{x.open}</dd></div>
                <div><dt className="text-slate-500">Terminées ({days} j)</dt><dd className="text-sm font-bold text-emerald-400 tabular-nums">{x.done}</dd></div>
                <div><dt className="text-slate-500">À temps</dt><dd className="text-sm font-bold text-slate-100 tabular-nums">{x.otr.rate === null ? '—' : `${Math.round(x.otr.rate * 100)} %`}</dd></div>
                <div><dt className="text-slate-500">En retard</dt><dd className={`text-sm font-bold tabular-nums ${x.overdue ? 'text-orange-400' : 'text-slate-400'}`}>{x.overdue}</dd></div>
                <div><dt className="text-slate-500">Bloquées</dt><dd className={`text-sm font-bold tabular-nums ${x.blocked ? 'text-rose-400' : 'text-slate-400'}`}>{x.blocked}</dd></div>
                <div><dt className="text-slate-500">Charge est.</dt><dd className="text-sm font-bold text-slate-100 tabular-nums">{fmtHours(x.rem.minutes)}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

// ======================================================================= Analyses

const Analyses: React.FC<any> = ({ scope, tasks, health, now, days, filters, userName, projectName, setSelectedTaskId, isAdmin }) => {
  const s = scope as Scope;
  const t = tasks as ScopeTask[];
  const h = health as ReturnType<typeof projectHealth>[];
  const [burnProject, setBurnProject] = useState<string>('');

  // 3.2 progression: completions per day, current vs previous period
  const from = Math.floor(now / DAY_MS) * DAY_MS - (days - 1) * DAY_MS;
  const doneTimes = t.filter(x => x.status === 'termine' && x.completed_at).map(x => new Date(x.completed_at!).getTime());
  const cur = dailySeries(doneTimes, from, days);
  const prev = dailySeries(doneTimes, from - days * DAY_MS, days);

  // 3.3 burnup / burndown
  const burnCandidates = h.filter(p => p.total > 0).sort((a, b) => b.total - a.total);
  const burnId = filters.project_id || burnProject || burnCandidates[0]?.project.id || '';
  const burn = burnId ? burnSeries(t, burnId, now) : [];

  // 3.4 deadline risk by project
  const open = t.filter(isOpen);
  const riskRows = h.filter(p => p.total - p.done > 0).sort((a, b) => (b.total - b.done) - (a.total - a.done)).slice(0, 10).map(p => ({
    id: p.project.id, label: p.project.name,
    segments: RISK_ORDER.map(b => ({ name: RISK_LABELS[b], color: RISK_COLORS[b], value: open.filter(x => x.project_id === p.project.id && riskBucket(x, now) === b).length })),
  }));

  // 3.5 workload per assignee (estimated minutes, unknown estimate counted apart)
  const people = [...new Set(open.map(x => x.assignee_id || 'none'))];
  const workload = people.map(id => {
    const mine = open.filter(x => (x.assignee_id || 'none') === id);
    const critMin = mine.filter(x => isCritical(x, now)).reduce((a, x) => a + (x.estimated_minutes || 0), 0);
    const allMin = mine.reduce((a, x) => a + (x.estimated_minutes || 0), 0);
    return {
      id, label: id === 'none' ? 'Non assigné' : userName(id),
      segments: [{ name: 'Critique', value: critMin, color: RISK_COLORS.critique }, { name: 'Autre', value: allMin - critMin, color: SERIES[0] }],
      note: `${mine.filter(x => dueWithin(x, now, 3 * DAY_MS)).length} éch. < 3 j · ${mine.filter(x => x.status === 'bloque').length} bloq. · ${mine.filter(x => !x.estimated_minutes).length} non est.`,
      count: mine.length, allMin,
    };
  }).sort((a, b) => b.allMin - a.allMin);

  // 3.6 priority matrix
  const urgent = (x: ScopeTask) => isOverdue(x, now) || dueWithin(x, now, 3 * DAY_MS);
  const quadrants = [
    { key: 'do', title: 'Urgent & important', hint: 'À traiter tout de suite', tone: 'border-rose-800/60', list: open.filter(x => isImportant(x) && urgent(x)) },
    { key: 'plan', title: 'Important, pas urgent', hint: 'Stratégique : planifier', tone: 'border-[#2563EB]/50', list: open.filter(x => isImportant(x) && !urgent(x)) },
    { key: 'delegate', title: 'Urgent, moins important', hint: 'Opérationnel : déléguer ou traiter vite', tone: 'border-amber-800/60', list: open.filter(x => !isImportant(x) && urgent(x)) },
    { key: 'later', title: 'Ni urgent ni important', hint: 'Peut attendre', tone: 'border-[#1E293B]', list: open.filter(x => !isImportant(x) && !urgent(x)) },
  ];

  // 3.9 alert analytics
  const nFrom = now - days * DAY_MS;
  const notif = s.notifications.filter(n => new Date(n.created_at).getTime() >= nFrom);
  const types = [...new Set(notif.map(n => n.type))];
  const median = (a: number[]) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const alertRows = types.map(type => {
    const list = notif.filter(n => n.type === type);
    const delays = list.filter(n => n.read_at).map(n => (new Date(n.read_at!).getTime() - new Date(n.created_at).getTime()) / 60000);
    const med = median(delays);
    return { type, created: list.length, read: list.filter(n => n.is_read).length, med };
  }).sort((a, b) => b.created - a.created);
  const TYPE_LABELS: Record<string, string> = {
    task_assigned: 'Assignation', task_status_changed: 'Changement de statut', task_comment: 'Commentaire', task_due_today: "Échéance du jour",
    task_overdue: 'Tâche en retard', workspace_added: 'Ajout à un espace', workspace_removed: "Retrait d'un espace", workspace_role_changed: 'Rôle modifié',
    project_completed: 'Projet terminé', project_playbook_reminder: 'Rappel playbook', announcement: 'Annonce', kudos: 'Reconnaissance',
  };

  const dimRows = h.filter(p => p.health !== 'termine' && p.health !== 'arrete' && p.total > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard className="lg:col-span-2" title="Progression des tâches terminées" question={`Le rythme accélère-t-il ou ralentit-il ? Tâches terminées par jour, ${days} derniers jours vs les ${days} précédents.`}
        empty={cur.every(d => !d.value) && prev.every(d => !d.value)} emptyText="Aucune tâche terminée sur ces deux périodes."
        source="Source : date de passage à « Terminé ». Aucun objectif chiffré n'est défini dans AxeTasks : la comparaison se fait avec la période précédente."
        table={{ head: ['Jour', 'Terminées', 'Période préc. (même rang)'], rows: cur.map((d, i) => [fmtDay(d.key), d.value, prev[i].value]) }}>
        <LineChart labels={cur.map(d => fmtDay(d.key))} series={[
          { name: 'Réalisé', color: SERIES[0], values: cur.map(d => d.value) },
          { name: 'Période précédente', color: REFERENCE, dashed: true, values: prev.map(d => d.value) },
        ]} />
      </ChartCard>

      <ChartCard title="Avancement du projet (accompli / restant)" question="Le projet avance-t-il assez vite, et son périmètre grossit-il ?"
        empty={!burn.length} emptyText="Aucune tâche dans ce projet."
        actions={!filters.project_id && burnCandidates.length > 1 ? (
          <select value={burnId} onChange={e => setBurnProject(e.target.value)} aria-label="Projet" className="bg-[#0B1120] border border-[#1E293B] rounded px-1.5 py-1 text-[10px] text-slate-200 max-w-[9rem]">
            {burnCandidates.map(p => <option key={p.project.id} value={p.project.id}>{p.project.name}</option>)}
          </select>
        ) : undefined}
        source="En nombre de tâches (les estimations ne sont pas renseignées partout). Les tâches supprimées n'apparaissent plus ; une tâche réouverte sort de « terminé »."
        table={{ head: ['Jour', 'Périmètre', 'Terminées', 'Restantes'], rows: burn.map(d => [fmtDay(d.key), d.scope, d.done, d.remaining]) }}>
        <LineChart labels={burn.map(d => fmtDay(d.key))} series={[
          { name: 'Périmètre total', color: REFERENCE, dashed: true, values: burn.map(d => d.scope) },
          { name: 'Terminées (travail accompli)', color: SERIES[0], values: burn.map(d => d.done) },
          { name: 'Restantes (travail restant)', color: SERIES[1], values: burn.map(d => d.remaining) },
        ]} />
      </ChartCard>

      <ChartCard title="Risque d'échéance par projet" question="Où sont les tâches ouvertes en danger ?"
        empty={!riskRows.length} emptyText="Aucune tâche ouverte."
        source="Une catégorie par tâche ouverte, la plus grave l'emporte. Critique = haute/urgente en retard."
        table={{ head: ['Projet', ...RISK_ORDER.map(b => RISK_LABELS[b])], rows: riskRows.map(r => [r.label, ...r.segments.map(x => x.value)]) }}>
        <StackedBars rows={riskRows} legend={RISK_ORDER.map(b => ({ label: RISK_LABELS[b], color: RISK_COLORS[b] }))} />
      </ChartCard>

      <ChartCard title="Charge par responsable" question="Qui porte le plus de travail restant estimé, et quelle part est critique ?"
        empty={!workload.length} emptyText="Aucune tâche ouverte."
        source="Somme des estimations des tâches ouvertes. Le nombre de tâches seul n'est pas une mesure de charge : les tâches sans estimation sont signalées à part. Capacité non renseignée."
        table={{ head: ['Responsable', 'Charge estimée', 'Dont critique', 'Tâches', 'Détail'], rows: workload.map(w => [w.label, fmtHours(w.allMin), fmtHours(w.segments[0].value), w.count, w.note]) }}>
        <StackedBars rows={workload} unit={fmtHours} legend={[{ label: 'Charge critique', color: RISK_COLORS.critique }, { label: 'Autre charge', color: SERIES[0] }]} />
      </ChartCard>

      <ChartCard title="Matrice de priorisation" question="Qu'est-ce qui est stratégique, urgent, ou peut attendre ?"
        empty={!open.length} emptyText="Aucune tâche ouverte."
        source="Important = priorité haute ou urgente. Urgent = en retard ou échéance sous 3 jours."
        table={{ head: ['Quadrant', 'Tâches'], rows: quadrants.map(q => [q.title, q.list.length]) }}>
        <div className="grid grid-cols-2 gap-2">
          {quadrants.map(q => (
            <div key={q.key} className={`rounded border ${q.tone} p-2 min-w-0`}>
              <p className="text-[11px] font-bold text-slate-100">{q.title} <span className="text-slate-500 tabular-nums">({q.list.length})</span></p>
              <p className="text-[10px] text-slate-500 mb-1">{q.hint}</p>
              <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                {q.list.slice(0, 8).map(x => (
                  <li key={x.id}><button onClick={() => setSelectedTaskId(x.id)} className="text-[11px] text-slate-300 hover:text-[#93C5FD] break-words w-full text-left">• {x.title}</button></li>
                ))}
                {q.list.length > 8 && <li className="text-[10px] text-slate-500">+ {q.list.length - 8} autres</li>}
              </ul>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Santé des projets par dimension" question="Quelle dimension tire chaque projet vers le bas ?"
        empty={!dimRows.length} emptyText="Aucun projet actif."
        source="Échéances = 1 − part des tâches ouvertes en retard · Avancement = terminées / total · Blocages = 1 − part bloquée · Rythme = 1 − écart planning (si dates). Qualité des livrables : non mesurée (pas de critères d'acceptation dans AxeTasks)."
        table={{ head: ['Projet', 'Échéances', 'Avancement', 'Blocages', 'Rythme'], rows: dimRows.map(p => {
          const o = p.total - p.done || 1;
          return [p.project.name, `${Math.round((1 - p.overdue / o) * 100)} %`, `${Math.round(p.progress * 100)} %`, `${Math.round((1 - p.blocked / o) * 100)} %`, p.paceGap === null ? '—' : `${Math.max(0, 100 - Math.max(0, p.paceGap))} %`];
        }) }}>
        <div className="space-y-3">
          {dimRows.slice(0, 6).map(p => {
            const o = p.total - p.done || 1;
            const dims = [
              ['Échéances', 1 - p.overdue / o], ['Avancement', p.progress], ['Blocages', 1 - p.blocked / o],
              ['Rythme', p.paceGap === null ? null : Math.max(0, 100 - Math.max(0, p.paceGap)) / 100],
            ] as [string, number | null][];
            return (
              <div key={p.project.id}>
                <p className="text-[11px] font-semibold text-slate-200 mb-1 flex items-center gap-2">{p.project.name}<span className={`px-1.5 rounded border text-[9px] ${HEALTH_STYLES[p.health].chip}`}>{HEALTH_LABELS[p.health]}</span></p>
                <div className="grid grid-cols-4 gap-2">
                  {dims.map(([label, v]) => (
                    <div key={label} title={v === null ? `${label} : non calculable (dates manquantes)` : `${label} : ${Math.round(v * 100)} %`}>
                      <p className="text-[9px] text-slate-500">{label}</p>
                      {v === null ? <p className="text-[10px] text-slate-600">—</p> : <ProgressBar value={v} color={v >= 0.8 ? HEALTH_STYLES.sain.color : v >= 0.5 ? HEALTH_STYLES.surveiller.color : HEALTH_STYLES.critique.color} label={label} />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      <ChartCard className="lg:col-span-2" title={isAdmin ? "Analyse des alertes (toute l'équipe)" : 'Analyse de vos alertes'} question="Les alertes sont-elles lues, et en combien de temps ?"
        empty={!alertRows.length} emptyText="Aucune alerte sur cette période."
        source="Délai de lecture mesuré depuis la mise en place du suivi (champ read_at). Non mesurés pour l'instant : alertes dupliquées évitées (le rappel quotidien n'envoie qu'une alerte par tâche et par jour), échecs d'envoi push. Les alertes d'échéance cessent dès que la tâche est terminée."
        table={{ head: ['Type', 'Créées', 'Lues', 'Délai médian de lecture'], rows: alertRows.map(r => [TYPE_LABELS[r.type] || r.type, r.created, r.read, r.med === null ? '—' : fmtHours(Math.round(r.med))]) }}>
        <StackedBars rows={alertRows.map(r => ({
          id: r.type, label: TYPE_LABELS[r.type] || r.type,
          segments: [{ name: 'Lues', value: r.read, color: SERIES[0] }, { name: 'Non lues', value: r.created - r.read, color: RISK_COLORS.proche }],
          note: r.med === null ? 'délai —' : `médiane ${fmtHours(Math.round(r.med))}`,
        }))} legend={[{ label: 'Lues', color: SERIES[0] }, { label: 'Non lues', color: RISK_COLORS.proche }]} />
      </ChartCard>

      <p className="lg:col-span-2 text-[10px] text-slate-500 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Les statistiques de progression AXP sont séparées des indicateurs opérationnels : voir « Progression ». Un niveau AXP élevé n'est pas une mesure de productivité.</p>
    </div>
  );
};
