// Command Center + AXP rules. Pure functions only (no DB, no DOM) so the same
// definitions drive the server (XP awards), the UI (KPIs, charts, drill-downs)
// and scripts/test-insights.ts. Every number shown in the Command Center is
// computed here from the rows returned by GET /api/insights/scope.

export type Status = 'a_faire' | 'en_cours' | 'en_revision' | 'termine' | 'bloque';
export type Priority = 'basse' | 'normale' | 'haute' | 'urgente';

export interface ScopeTask {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  project_id: string;
  workspace_id: string;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  start_at: string | null;
  end_at: string | null;
  completed_at: string | null;
  blocked_at: string | null;
  stopped_at: string | null;
  estimated_minutes: number | null;
}

export interface ScopeProject {
  id: string;
  name: string;
  workspace_id: string;
  created_by: string | null;
  start_at: string | null;
  end_at: string | null;
  completed_at: string | null;
  stopped_at: string | null;
  created_at: string;
}

export interface ScopeWorkspace { id: string; name: string; color: string; my_role: 'admin' | 'member' }
export interface ScopeUser { id: string; name: string; avatar_url: string | null }
export interface ScopeNotification { type: string; created_at: string; is_read: boolean; read_at: string | null }

export interface Scope {
  generated_at: string;
  workspaces: ScopeWorkspace[];
  projects: ScopeProject[];
  tasks: ScopeTask[];
  users: ScopeUser[];
  notifications: ScopeNotification[];
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

export const isOpen = (t: ScopeTask) => t.status !== 'termine';
export const isImportant = (t: ScopeTask) => t.priority === 'urgente' || t.priority === 'haute';
export const isOverdue = (t: ScopeTask, now: number) => isOpen(t) && !!t.end_at && ts(t.end_at) < now;
export const dueWithin = (t: ScopeTask, now: number, ms: number) =>
  isOpen(t) && !!t.end_at && ts(t.end_at) >= now && ts(t.end_at) - now <= ms;
/** Critical = important task that is overdue or due within 48h. */
export const isCritical = (t: ScopeTask, now: number) => isImportant(t) && (isOverdue(t, now) || dueWithin(t, now, 2 * DAY));
export const completedBetween = (t: ScopeTask, from: number, to: number) =>
  t.status === 'termine' && !!t.completed_at && ts(t.completed_at) >= from && ts(t.completed_at) < to;
export const onTime = (t: ScopeTask) => !!t.end_at && !!t.completed_at && ts(t.completed_at) <= ts(t.end_at);

// ---------------------------------------------------------------- filters

export interface Filters {
  days: number; // period length: completions are counted over [now - days, now)
  workspace_id?: string;
  project_id?: string;
  assignee_id?: string; // 'none' = unassigned
  priority?: Priority;
}

export function applyFilters(scope: Scope, f: Filters): { tasks: ScopeTask[]; projects: ScopeProject[] } {
  const projects = scope.projects.filter(p =>
    (!f.workspace_id || p.workspace_id === f.workspace_id) && (!f.project_id || p.id === f.project_id));
  const ids = new Set(projects.map(p => p.id));
  const tasks = scope.tasks.filter(t =>
    ids.has(t.project_id) &&
    (!f.assignee_id || (f.assignee_id === 'none' ? !t.assignee_id : t.assignee_id === f.assignee_id)) &&
    (!f.priority || t.priority === f.priority));
  return { tasks, projects };
}

// ------------------------------------------------------------------- KPIs
// Each KPI is a predicate, so the number on a card and the list it opens are
// the same filter by construction (no separate "detail query" to drift).

export type KpiKey = 'active' | 'completed' | 'overdue' | 'critical' | 'blocked' | 'review' | 'unassigned_important';

export const KPI_DEFS: Record<KpiKey, { label: string; hint: string; test: (t: ScopeTask, now: number, days: number) => boolean }> = {
  active: { label: 'Tâches actives', hint: 'Statut ≠ Terminé', test: t => isOpen(t) },
  completed: { label: 'Terminées', hint: 'Terminées sur la période', test: (t, now, days) => completedBetween(t, now - days * DAY, now) },
  overdue: { label: 'En retard', hint: 'Échéance dépassée, non terminées', test: (t, now) => isOverdue(t, now) },
  critical: { label: 'Critiques', hint: 'Haute/urgente en retard ou à rendre sous 48 h', test: (t, now) => isCritical(t, now) },
  blocked: { label: 'Bloquées', hint: 'Statut Bloqué', test: t => t.status === 'bloque' },
  review: { label: 'À valider', hint: 'Statut En révision', test: t => t.status === 'en_revision' },
  unassigned_important: { label: 'Sans responsable', hint: 'Haute/urgente non assignées', test: t => isOpen(t) && isImportant(t) && !t.assignee_id },
};

export function kpiTasks(tasks: ScopeTask[], key: KpiKey, now: number, days: number) {
  return tasks.filter(t => KPI_DEFS[key].test(t, now, days));
}

/** On-time rate over a window; null when nothing with a deadline was completed (no valid reference). */
export function onTimeRate(tasks: ScopeTask[], from: number, to: number): { rate: number | null; sample: number } {
  const done = tasks.filter(t => completedBetween(t, from, to) && t.end_at);
  if (done.length === 0) return { rate: null, sample: 0 };
  return { rate: done.filter(onTime).length / done.length, sample: done.length };
}

/** Completed-count delta vs the previous period of the same length; null when the previous period is empty. */
export function periodCompare(tasks: ScopeTask[], now: number, days: number) {
  const cur = tasks.filter(t => completedBetween(t, now - days * DAY, now)).length;
  const prev = tasks.filter(t => completedBetween(t, now - 2 * days * DAY, now - days * DAY)).length;
  return { cur, prev, deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null };
}

export function remainingMinutes(tasks: ScopeTask[]) {
  const open = tasks.filter(isOpen);
  const estimated = open.filter(t => t.estimated_minutes && t.estimated_minutes > 0);
  return {
    minutes: estimated.reduce((s, t) => s + (t.estimated_minutes || 0), 0),
    estimated: estimated.length,
    unestimated: open.length - estimated.length,
  };
}

// ------------------------------------------------------------ deadline risk

export type RiskBucket = 'bloquee' | 'critique' | 'en_retard' | 'proche' | 'a_jour' | 'sans_date';
export const RISK_ORDER: RiskBucket[] = ['bloquee', 'critique', 'en_retard', 'proche', 'a_jour', 'sans_date'];
export const RISK_LABELS: Record<RiskBucket, string> = {
  bloquee: 'Bloquée', critique: 'Critique', en_retard: 'En retard', proche: 'Échéance < 48 h', a_jour: 'À jour', sans_date: 'Sans échéance',
};

/** One exclusive bucket per open task, most severe first. */
export function riskBucket(t: ScopeTask, now: number): RiskBucket {
  if (t.status === 'bloque') return 'bloquee';
  if (isCritical(t, now) && isOverdue(t, now)) return 'critique';
  if (isOverdue(t, now)) return 'en_retard';
  if (dueWithin(t, now, 2 * DAY)) return 'proche';
  return t.end_at ? 'a_jour' : 'sans_date';
}

// ------------------------------------------------------------ project health

export type Health = 'sain' | 'surveiller' | 'critique' | 'termine' | 'arrete';
export const HEALTH_LABELS: Record<Health, string> = {
  sain: 'Sain', surveiller: 'Sous surveillance', critique: 'Critique', termine: 'Terminé', arrete: 'Arrêté',
};

export interface ProjectHealth {
  project: ScopeProject;
  health: Health;
  reasons: string[];
  total: number;
  done: number;
  progress: number; // 0..1, task-count based
  overdue: number;
  blocked: number;
  critical: number;
  paceGap: number | null; // elapsed share - progress share, in points; null without dates
  remaining: ReturnType<typeof remainingMinutes>;
  nextDue: string | null;
  trend: { last7: number; prev7: number };
  ownerId: string | null;
}

/**
 * Explicit rules (shown in the UI next to each project):
 * - critique: project deadline passed while unfinished, or ≥3 overdue tasks,
 *   or ≥30 % of open tasks overdue, or ≥2 blocked tasks.
 * - sous surveillance: ≥1 overdue or blocked or critical task, or the schedule
 *   is consumed ≥25 points faster than tasks are completed.
 * - sain otherwise.
 */
export function projectHealth(p: ScopeProject, tasks: ScopeTask[], now: number): ProjectHealth {
  const own = tasks.filter(t => t.project_id === p.id);
  const open = own.filter(isOpen);
  const done = own.length - open.length;
  const progress = own.length ? done / own.length : 0;
  const overdue = open.filter(t => isOverdue(t, now)).length;
  const blocked = open.filter(t => t.status === 'bloque').length;
  const critical = open.filter(t => isCritical(t, now)).length;
  const start = ts(p.start_at || p.created_at);
  const end = ts(p.end_at);
  const paceGap = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? Math.round((Math.min(1, Math.max(0, (now - start) / (end - start))) - progress) * 100)
    : null;
  const nextDue = open.filter(t => t.end_at && ts(t.end_at) >= now).map(t => t.end_at!).sort()[0] || null;
  const trend = {
    last7: own.filter(t => completedBetween(t, now - 7 * DAY, now)).length,
    prev7: own.filter(t => completedBetween(t, now - 14 * DAY, now - 7 * DAY)).length,
  };

  const reasons: string[] = [];
  let health: Health = 'sain';
  if (p.completed_at) health = 'termine';
  else if (p.stopped_at) health = 'arrete';
  else {
    const crit: string[] = [];
    if (Number.isFinite(end) && end < now) crit.push('Échéance du projet dépassée');
    if (overdue >= 3) crit.push(`${overdue} tâches en retard`);
    else if (open.length && overdue / open.length >= 0.3) crit.push(`${Math.round((overdue / open.length) * 100)} % des tâches ouvertes en retard`);
    if (blocked >= 2) crit.push(`${blocked} tâches bloquées`);
    if (crit.length) { health = 'critique'; reasons.push(...crit); }
    else {
      if (overdue) reasons.push(`${overdue} tâche${overdue > 1 ? 's' : ''} en retard`);
      if (blocked) reasons.push('1 tâche bloquée');
      if (critical && !overdue) reasons.push(`${critical} tâche${critical > 1 ? 's' : ''} critique${critical > 1 ? 's' : ''} à rendre sous 48 h`);
      if (paceGap !== null && paceGap >= 25) reasons.push(`Rythme en retard de ${paceGap} pts sur le planning`);
      if (reasons.length) health = 'surveiller';
    }
  }
  return { project: p, health, reasons, total: own.length, done, progress, overdue, blocked, critical, paceGap, remaining: remainingMinutes(own), nextDue, trend, ownerId: p.created_by };
}

// ------------------------------------------------------------ critical now

export interface CriticalItem {
  key: string;
  kind: 'task' | 'project';
  id: string;
  title: string;
  problem: string;
  reason: string;
  action: string;
  ownerId: string | null;
  due: string | null;
  urgency: 'critique' | 'haute';
  score: number;
}

export function criticalNow(tasks: ScopeTask[], health: ProjectHealth[], now: number, limit = 8): CriticalItem[] {
  const items: CriticalItem[] = [];
  for (const t of tasks) {
    if (!isOpen(t)) continue;
    const lateDays = t.end_at ? Math.floor((now - ts(t.end_at)) / DAY) : 0;
    if (t.status === 'bloque') {
      const since = t.blocked_at ? Math.floor((now - ts(t.blocked_at)) / DAY) : null;
      items.push({
        key: `blk:${t.id}`, kind: 'task', id: t.id, title: t.title, problem: 'Tâche bloquée',
        reason: since === null ? 'Bloquée (date de blocage inconnue)' : since >= 1 ? `Bloquée depuis ${since} j` : "Bloquée aujourd'hui",
        action: 'Identifier la cause et lever le blocage', ownerId: t.assignee_id, due: t.end_at,
        urgency: isImportant(t) ? 'critique' : 'haute', score: 60 + (isImportant(t) ? 30 : 0) + Math.min(since ?? 0, 10) * 2,
      });
    } else if (isOverdue(t, now) && isImportant(t)) {
      items.push({
        key: `late:${t.id}`, kind: 'task', id: t.id, title: t.title, problem: 'Échéance critique dépassée',
        reason: lateDays >= 1 ? `Priorité ${t.priority}, en retard de ${lateDays} j` : `Priorité ${t.priority}, échéance passée aujourd'hui`,
        action: t.assignee_id ? 'Terminer ou replanifier avec le responsable' : 'Assigner un responsable puis replanifier',
        ownerId: t.assignee_id, due: t.end_at, urgency: 'critique', score: 80 + Math.min(lateDays, 10) * 2 + (t.priority === 'urgente' ? 10 : 0),
      });
    } else if (t.status === 'en_revision' && t.end_at && ts(t.end_at) - now <= 2 * DAY) {
      items.push({
        key: `rev:${t.id}`, kind: 'task', id: t.id, title: t.title, problem: 'Validation urgente',
        reason: 'Livrable en révision, échéance sous 48 h', action: 'Relire et valider ou renvoyer le livrable',
        ownerId: t.created_by, due: t.end_at, urgency: 'haute', score: 55,
      });
    } else if (isImportant(t) && !t.assignee_id) {
      items.push({
        key: `own:${t.id}`, kind: 'task', id: t.id, title: t.title, problem: 'Tâche importante sans responsable',
        reason: `Priorité ${t.priority}, personne n'est assigné`, action: 'Assigner un responsable',
        ownerId: null, due: t.end_at, urgency: 'haute', score: 45,
      });
    }
  }
  for (const h of health) {
    if (h.health !== 'critique') continue;
    items.push({
      key: `prj:${h.project.id}`, kind: 'project', id: h.project.id, title: h.project.name, problem: 'Projet en risque',
      reason: h.reasons.join(' · '), action: 'Revoir le planning et les priorités du projet',
      ownerId: h.ownerId, due: h.project.end_at, urgency: 'critique', score: 70 + h.overdue * 3 + h.blocked * 3,
    });
  }
  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ------------------------------------------------------------ today's mission

export interface RankedTask { task: ScopeTask; score: number; reasons: string[] }

export const DAILY_FOCUS_MINUTES = 6 * 60; // realistic focused time per day used for suggestions

/** Explainable ranking of a user's open tasks (score + human reasons). Pure suggestion. */
export function rankTask(t: ScopeTask, now: number): RankedTask {
  const reasons: string[] = [];
  let score = 0;
  if (isOverdue(t, now)) {
    const d = Math.floor((now - ts(t.end_at)) / DAY);
    score += 40 + Math.min(d, 10) * 2;
    reasons.push(d >= 1 ? `En retard de ${d} j` : "Échéance dépassée aujourd'hui");
  } else if (dueWithin(t, now, DAY)) { score += 30; reasons.push('À rendre sous 24 h'); }
  else if (dueWithin(t, now, 3 * DAY)) { score += 18; reasons.push('À rendre sous 3 jours'); }
  else if (dueWithin(t, now, 7 * DAY)) { score += 8; reasons.push('À rendre cette semaine'); }
  const pr = { urgente: 30, haute: 20, normale: 8, basse: 0 }[t.priority];
  score += pr;
  if (pr >= 20) reasons.push(`Priorité ${t.priority}`);
  if (t.status === 'en_cours') { score += 5; reasons.push('Déjà en cours'); }
  if (!reasons.length) reasons.push('Aucune échéance proche');
  return { task: t, score, reasons };
}

export interface DayPlan {
  main: RankedTask | null;
  top: RankedTask[];
  quickWins: RankedTask[];
  toValidate: ScopeTask[];
  blocked: ScopeTask[];
  doneToday: number;
  overloaded: boolean;
  loadMinutes: number; // estimated minutes of overdue + due-today tasks
  realisticGoal: number;
}

export function planDay(tasks: ScopeTask[], userId: string, now: number, dayStart: number): DayPlan {
  const mine = tasks.filter(t => t.assignee_id === userId);
  const open = mine.filter(t => isOpen(t) && t.status !== 'bloque' && t.status !== 'en_revision' && !t.stopped_at);
  const ranked = open.map(t => rankTask(t, now)).sort((a, b) => b.score - a.score);
  const pressing = mine.filter(t => isOpen(t) && (isOverdue(t, now) || dueWithin(t, now, DAY)));
  const loadMinutes = pressing.reduce((s, t) => s + (t.estimated_minutes || 60), 0);
  const overloaded = loadMinutes > 8 * 60 || pressing.length > 6;
  // Fill the day with ranked tasks that fit the focus budget (unknown estimate = 1 h).
  let budget = DAILY_FOCUS_MINUTES;
  let realisticGoal = 0;
  for (const r of ranked) {
    const m = r.task.estimated_minutes || 60;
    if (m > budget && realisticGoal > 0) break;
    budget -= m; realisticGoal++;
    if (realisticGoal >= 5) break;
  }
  const topCount = overloaded ? 2 : 3; // never push more on someone already overloaded
  const top = ranked.slice(0, topCount);
  const topIds = new Set(top.map(r => r.task.id));
  return {
    main: ranked[0] || null,
    top,
    quickWins: ranked.filter(r => !topIds.has(r.task.id) && r.task.estimated_minutes && r.task.estimated_minutes <= 30).slice(0, 3),
    toValidate: tasks.filter(t => t.status === 'en_revision' && t.created_by === userId && t.assignee_id !== userId),
    blocked: mine.filter(t => t.status === 'bloque'),
    doneToday: mine.filter(t => completedBetween(t, dayStart, now + 1)).length,
    overloaded,
    loadMinutes,
    realisticGoal: Math.min(realisticGoal, topCount + 2),
  };
}

// ---------------------------------------------------------------- AXP rules

/** Initial calibration — change values here, the server and the rules page follow. */
export const XP_RULES = {
  simple: 10,          // ≤ 1 h estimated (or no estimate), basse/normale
  medium: 25,          // 1 h – 4 h estimated
  important: 50,       // > 4 h estimated, or priorité haute
  critical: 75,        // priorité urgente
  unvalidatedCap: 25,  // important/critical closed without peer validation are capped
  blockerResolved: 30, // task leaves 'bloque' after ≥ blockerMinHours
  blockerMinHours: 1,
  kudos: 15,           // colleague recognition, given by a peer
  kudosPerDay: 3,      // max recognitions a person can give per day
  projectCompleted: 40,// collective bonus for each contributor of a completed project
  quickSelfCloseMinutes: 15, // self-created + self-closed within this delay → 0 AXP
  dailyCap: 300,       // max AXP per person per day from task events (no reward for overwork)
};

export type XpTier = 'simple' | 'medium' | 'important' | 'critical';
export const TIER_LABELS: Record<XpTier, string> = { simple: 'Simple', medium: 'Moyenne', important: 'Importante', critical: 'Critique' };

export function taskTier(t: { priority: Priority; estimated_minutes: number | null }): XpTier {
  if (t.priority === 'urgente') return 'critical';
  const m = t.estimated_minutes || 0;
  if (t.priority === 'haute' || m > 240) return 'important';
  if (m > 60) return 'medium';
  return 'simple';
}

export interface CompletionContext {
  priority: Priority;
  estimated_minutes: number | null;
  previousStatus: Status;
  actorId: string;
  assigneeId: string | null;
  createdBy: string | null;
  createdAt: number;
  now: number;
  earnedToday: number; // recipient's non-revoked task XP already earned today
}

/** XP for a completion + the human explanation stored with the event. */
export function completionXp(c: CompletionContext): { points: number; tier: XpTier; validated: boolean; reason: string } {
  const tier = taskTier(c);
  const recipient = c.assigneeId || c.actorId;
  const validated = c.previousStatus === 'en_revision' && c.actorId !== recipient;
  let points = XP_RULES[tier];
  const notes = [`Tâche ${TIER_LABELS[tier].toLowerCase()}`];
  if ((tier === 'important' || tier === 'critical') && !validated) {
    points = Math.min(points, XP_RULES.unvalidatedCap);
    notes.push('non validée par un pair (plafonné)');
  } else if (validated) notes.push('validée par un pair');
  if (c.createdBy === recipient && c.actorId === recipient && c.now - c.createdAt < XP_RULES.quickSelfCloseMinutes * 60_000) {
    points = 0;
    notes.push(`créée et fermée par soi-même en moins de ${XP_RULES.quickSelfCloseMinutes} min`);
  }
  const room = Math.max(0, XP_RULES.dailyCap - c.earnedToday);
  if (points > room) { points = room; notes.push('plafond journalier atteint'); }
  return { points, tier, validated, reason: notes.join(', ') };
}

// ---------------------------------------------------------------- levels

export const LEVELS = [
  { level: 1, name: 'Initié', min: 0 },
  { level: 2, name: 'Bâtisseur', min: 100 },
  { level: 3, name: 'Opérateur', min: 300 },
  { level: 4, name: 'Stratège', min: 700 },
  { level: 5, name: 'Exécutant d\'élite', min: 1500 },
  { level: 6, name: 'Maître opérateur', min: 3000 },
  { level: 7, name: 'Sommet de la performance', min: 6000 },
];

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  return { ...cur, next, progress: next ? (xp - cur.min) / (next.min - cur.min) : 1, toNext: next ? next.min - xp : 0 };
}

// ---------------------------------------------------------------- streaks

const isWorkday = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
const dayKeyUTC = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Streak of working days (Mon–Fri) with at least one validated contribution.
 * Weekends never count nor break. A single missed working day is forgiven
 * (urgent day, leave); two consecutive missed working days end the streak.
 * Today does not break the streak while it is still in progress.
 */
export function streaks(activeDays: Set<string>, todayKey: string): { current: number; best: number } {
  if (activeDays.size === 0) return { current: 0, best: 0 };
  const first = [...activeDays].sort()[0];
  let best = 0, run = 0, misses = 0, current = 0;
  const end = new Date(`${todayKey}T00:00:00Z`);
  for (let d = new Date(`${first}T00:00:00Z`); d <= end; d = new Date(d.getTime() + DAY)) {
    if (!isWorkday(d)) continue;
    const key = dayKeyUTC(d);
    if (activeDays.has(key)) { run++; misses = 0; }
    else if (key !== todayKey) { misses++; if (misses >= 2) run = 0; }
    best = Math.max(best, run);
  }
  current = run;
  return { current, best };
}

// ---------------------------------------------------------------- badges

export interface BadgeStats {
  onTimeCompleted: number;   // completions with a deadline met (last 90 days)
  withDeadline: number;      // completions with a deadline (last 90 days)
  blockersResolved: number;
  validatedKept: number;     // peer-validated completions never revoked
  kudosReceived: number;
  projectsCompleted: number;
  bestStreak: number;
  criticalValidated: number;
}

export const BADGES: { id: string; name: string; rule: string; earned: (s: BadgeStats) => boolean; progress: (s: BadgeStats) => [number, number] }[] = [
  { id: 'deadline_master', name: 'Maître des échéances', rule: '≥ 10 tâches avec échéance terminées à temps et ≥ 90 % de ponctualité sur 90 jours',
    earned: s => s.onTimeCompleted >= 10 && s.onTimeCompleted / Math.max(1, s.withDeadline) >= 0.9, progress: s => [Math.min(s.onTimeCompleted, 10), 10] },
  { id: 'blocker_breaker', name: 'Briseur de blocages', rule: '5 blocages levés (bloqués ≥ 1 h)', earned: s => s.blockersResolved >= 5, progress: s => [Math.min(s.blockersResolved, 5), 5] },
  { id: 'quality_guardian', name: 'Gardien de la qualité', rule: '5 livrables validés par un pair, jamais réouverts', earned: s => s.validatedKept >= 5, progress: s => [Math.min(s.validatedKept, 5), 5] },
  { id: 'team_catalyst', name: 'Catalyseur d\'équipe', rule: '5 reconnaissances reçues de collègues', earned: s => s.kudosReceived >= 5, progress: s => [Math.min(s.kudosReceived, 5), 5] },
  { id: 'project_finisher', name: 'Finisseur de projets', rule: 'Contribution à un projet terminé', earned: s => s.projectsCompleted >= 1, progress: s => [Math.min(s.projectsCompleted, 1), 1] },
  { id: 'consistency_builder', name: 'Champion de la régularité', rule: 'Série de 10 jours ouvrés', earned: s => s.bestStreak >= 10, progress: s => [Math.min(s.bestStreak, 10), 10] },
  { id: 'strategic_executor', name: 'Exécutant stratégique', rule: '3 tâches urgentes validées par un pair', earned: s => s.criticalValidated >= 3, progress: s => [Math.min(s.criticalValidated, 3), 3] },
];

// ---------------------------------------------------------------- missions

export interface Mission { id: string; scope: 'jour' | 'semaine'; title: string; why: string; progress: number; target: number }

export interface MissionInput {
  plan: DayPlan;
  tasks: ScopeTask[];
  userId: string;
  now: number;
  dayStart: number;
  weekStart: number;
  blockersResolvedToday: number;
  validatedThisWeek: number; // tasks I created that I validated this week
}

/** Deterministic missions, sized to the person's load (fewer when overloaded). */
export function missions(m: MissionInput): Mission[] {
  const out: Mission[] = [];
  const mine = m.tasks.filter(t => t.assignee_id === m.userId);
  const importantDoneToday = mine.filter(t => isImportant(t) && completedBetween(t, m.dayStart, m.now + 1)).length;
  const importantOpen = mine.filter(t => isOpen(t) && isImportant(t)).length;
  const target = Math.min(m.plan.overloaded ? 1 : 2, importantOpen + importantDoneToday);
  if (target > 0) out.push({ id: 'day_priorities', scope: 'jour', title: `Terminer ${target} tâche${target > 1 ? 's' : ''} prioritaire${target > 1 ? 's' : ''}`,
    why: m.plan.overloaded ? 'Objectif réduit : charge du jour élevée' : 'Haute ou urgente, assignées à vous', progress: Math.min(importantDoneToday, target), target });
  const blockedAround = m.tasks.filter(t => t.status === 'bloque' && t.assignee_id === m.userId).length;
  if (blockedAround + m.blockersResolvedToday > 0) out.push({ id: 'day_unblock', scope: 'jour', title: 'Lever un blocage',
    why: `${blockedAround} tâche${blockedAround > 1 ? 's' : ''} bloquée${blockedAround > 1 ? 's' : ''} vous concerne${blockedAround > 1 ? 'nt' : ''}`, progress: Math.min(m.blockersResolvedToday, 1), target: 1 });
  if (m.plan.toValidate.length + m.validatedThisWeek > 0) {
    const t = Math.min(2, m.plan.toValidate.length + m.validatedThisWeek);
    out.push({ id: 'week_validate', scope: 'semaine', title: `Valider ${t} livrable${t > 1 ? 's' : ''} en attente`,
      why: 'Des tâches que vous avez créées attendent votre relecture', progress: Math.min(m.validatedThisWeek, t), target: t });
  }
  const overdueNow = mine.filter(t => isOverdue(t, m.now)).length;
  const lateDoneWeek = mine.filter(t => completedBetween(t, m.weekStart, m.now + 1) && t.end_at && !onTime(t)).length;
  if (overdueNow + lateDoneWeek > 0) {
    const t = Math.min(3, overdueNow + lateDoneWeek);
    out.push({ id: 'week_overdue', scope: 'semaine', title: `Résorber ${t} tâche${t > 1 ? 's' : ''} en retard`,
      why: 'Terminer ou replanifier avec votre responsable compte aussi', progress: Math.min(lateDoneWeek, t), target: t });
  }
  return out;
}

// ---------------------------------------------------------------- series

/** Daily counts over [from, to) as {key, value}; keys are YYYY-MM-DD (UTC). */
export function dailySeries(times: number[], from: number, days: number) {
  const out = Array.from({ length: days }, (_, i) => ({ key: dayKeyUTC(new Date(from + i * DAY)), value: 0 }));
  for (const t of times) {
    const i = Math.floor((t - from) / DAY);
    if (i >= 0 && i < days) out[i].value++;
  }
  return out;
}

/** Burnup/burndown for one project, task-count based (scope = tasks created so far). */
export function burnSeries(tasks: ScopeTask[], projectId: string, now: number) {
  const own = tasks.filter(t => t.project_id === projectId);
  if (!own.length) return [];
  const start = Math.floor(Math.min(...own.map(t => ts(t.created_at))) / DAY) * DAY;
  const days = Math.min(180, Math.max(1, Math.ceil((now - start) / DAY) + 1));
  const from = Math.max(start, Math.floor(now / DAY) * DAY - (days - 1) * DAY);
  return Array.from({ length: days }, (_, i) => {
    const end = from + (i + 1) * DAY;
    const scope = own.filter(t => ts(t.created_at) < end).length;
    const done = own.filter(t => t.completed_at && ts(t.completed_at) < end && t.status === 'termine').length;
    return { key: dayKeyUTC(new Date(from + i * DAY)), scope, done, remaining: scope - done };
  });
}

export const DAY_MS = DAY;
