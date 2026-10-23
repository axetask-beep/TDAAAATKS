// AXP service: the only place that writes xp_events. Called from task status
// transitions in queries.ts — the browser can never grant itself points
// (kudos and admin corrections go through validated API routes).
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from './index.ts';
import * as schema from './schema.ts';
import {
  XP_RULES, completionXp, levelFor, streaks, BADGES, BadgeStats, Status, Priority, DAY_MS,
} from '../lib/insights.ts';

const TZ = 'Africa/Douala';
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
/** Start of the current day in Douala time, as a Date. */
function dayStart(now = new Date()) {
  // Douala is UTC+1 all year (no DST), so local midnight = 23:00 UTC the day before.
  return new Date(new Date(`${dayKey(now)}T00:00:00Z`).getTime() - 3600_000);
}

const newId = () => `xp_${crypto.randomBytes(8).toString('hex')}`;
type TaskRow = typeof schema.tasks.$inferSelect;

async function workspaceOfProject(projectId: string): Promise<string | null> {
  const [p] = await db.select({ ws: schema.projects.workspace_id }).from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
  return p?.ws ?? null;
}

async function earnedToday(userId: string): Promise<number> {
  const [row] = await db.select({ s: sql<number>`coalesce(sum(${schema.xpEvents.points}), 0)::int` }).from(schema.xpEvents)
    .where(and(
      eq(schema.xpEvents.user_id, userId),
      isNull(schema.xpEvents.revoked_at),
      inArray(schema.xpEvents.kind, ['task_completed', 'blocker_resolved']),
      gte(schema.xpEvents.created_at, dayStart()),
    ));
  return row?.s ?? 0;
}

/**
 * Applies the AXP consequences of a task status change. Rules:
 * - → termine: one 'task_completed' event per task, ever (event_key). If the
 *   task was reopened, the same row is un-revoked with its original points,
 *   so reopen/close cycles can never pay twice.
 * - termine → other: the completion event is revoked (traceable).
 * - bloque → other after ≥ 1 h: one 'blocker_resolved' per task, to the actor.
 */
export async function onTaskStatusChange(before: TaskRow, nextStatus: Status, actorId: string | null): Promise<void> {
  if (!actorId || before.status === nextStatus) return;
  try {
    const now = new Date();
    if (nextStatus === 'termine') {
      const key = `task_completed:${before.id}`;
      const [existing] = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.event_key, key)).limit(1);
      if (existing) {
        if (existing.revoked_at) {
          await db.update(schema.xpEvents).set({ revoked_at: null, revoked_reason: null }).where(eq(schema.xpEvents.id, existing.id));
        }
      } else {
        const recipient = before.assignee_id || actorId;
        const r = completionXp({
          priority: before.priority as Priority,
          estimated_minutes: before.estimated_minutes,
          previousStatus: before.status as Status,
          actorId,
          assigneeId: before.assignee_id,
          createdBy: before.created_by,
          createdAt: before.created_at ? before.created_at.getTime() : 0,
          now: now.getTime(),
          earnedToday: await earnedToday(recipient),
        });
        await db.insert(schema.xpEvents).values({
          id: newId(),
          user_id: recipient,
          workspace_id: await workspaceOfProject(before.project_id),
          task_id: before.id,
          kind: 'task_completed',
          points: r.points,
          event_key: key,
          reason: r.reason,
          meta: { tier: r.tier, validated: r.validated, on_time: before.end_at ? now <= before.end_at : null, has_deadline: !!before.end_at, priority: before.priority },
          created_by: actorId,
        }).onConflictDoNothing();
      }
    } else if (before.status === 'termine') {
      await db.update(schema.xpEvents).set({
        revoked_at: now, revoked_reason: 'Tâche réouverte',
        meta: sql`coalesce(${schema.xpEvents.meta}, '{}'::jsonb) || '{"reopened": true}'::jsonb`,
      })
        .where(and(eq(schema.xpEvents.event_key, `task_completed:${before.id}`), isNull(schema.xpEvents.revoked_at)));
    }

    if (before.status === 'bloque' && nextStatus !== 'bloque' && before.blocked_at
      && now.getTime() - before.blocked_at.getTime() >= XP_RULES.blockerMinHours * 3600_000) {
      const room = Math.max(0, XP_RULES.dailyCap - await earnedToday(actorId));
      const points = Math.min(XP_RULES.blockerResolved, room);
      await db.insert(schema.xpEvents).values({
        id: newId(),
        user_id: actorId,
        workspace_id: await workspaceOfProject(before.project_id),
        task_id: before.id,
        kind: 'blocker_resolved',
        points,
        event_key: `blocker_resolved:${before.id}`,
        reason: points < XP_RULES.blockerResolved ? 'Blocage levé (plafond journalier atteint)' : 'Blocage levé',
        meta: { blocked_hours: Math.round((now.getTime() - before.blocked_at.getTime()) / 3600_000) },
        created_by: actorId,
      }).onConflictDoNothing();
    }
  } catch (err) {
    // Rewards must never break the business action itself.
    console.error('AXP award failed:', err);
  }
}

/** Deleting a task = cancelling it: its rewards are revoked, rows kept for audit. */
export async function revokeTaskEvents(taskId: string, reason: string) {
  await db.update(schema.xpEvents).set({ revoked_at: new Date(), revoked_reason: reason })
    .where(and(eq(schema.xpEvents.task_id, taskId), isNull(schema.xpEvents.revoked_at)));
}

/** Collective bonus: every person who completed a task of the project, once per project. */
export async function onProjectCompleted(projectId: string, workspaceId: string, projectName: string) {
  try {
    const contributors = await db.selectDistinct({ id: schema.tasks.assignee_id }).from(schema.tasks)
      .where(and(eq(schema.tasks.project_id, projectId), eq(schema.tasks.status, 'termine')));
    for (const c of contributors) {
      if (!c.id) continue;
      await db.insert(schema.xpEvents).values({
        id: newId(), user_id: c.id, workspace_id: workspaceId, kind: 'project_completed',
        points: XP_RULES.projectCompleted, event_key: `project_completed:${projectId}:${c.id}`,
        reason: `Projet terminé : ${projectName}`, meta: { project_id: projectId },
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.error('AXP project bonus failed:', err);
  }
}

export async function shareWorkspace(a: string, b: string): Promise<boolean> {
  const rows = await db.execute(sql`
    SELECT 1 FROM workspace_members m1 JOIN workspace_members m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = ${a} AND m2.user_id = ${b} LIMIT 1`);
  return rows.rows.length > 0;
}

export async function giveKudos(fromId: string, toId: string, message: string, taskId: string | null) {
  const today = dayStart();
  const given = await db.select({ id: schema.xpEvents.id }).from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.kind, 'kudos'), eq(schema.xpEvents.created_by, fromId), gte(schema.xpEvents.created_at, today)));
  if (given.length >= XP_RULES.kudosPerDay) throw new Error(`Limite de ${XP_RULES.kudosPerDay} reconnaissances par jour atteinte.`);
  let workspaceId: string | null = null;
  if (taskId) {
    const [t] = await db.select({ project_id: schema.tasks.project_id }).from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
    if (t) workspaceId = await workspaceOfProject(t.project_id);
  }
  const key = `kudos:${fromId}:${toId}:${dayKey(new Date())}`;
  const inserted = await db.insert(schema.xpEvents).values({
    id: newId(), user_id: toId, workspace_id: workspaceId, task_id: taskId, kind: 'kudos', points: XP_RULES.kudos,
    event_key: key, reason: message, created_by: fromId,
  }).onConflictDoNothing().returning();
  if (!inserted.length) throw new Error("Vous avez déjà reconnu cette personne aujourd'hui.");
  return inserted[0];
}

export async function addCorrection(adminId: string, userId: string, points: number, reason: string) {
  const [row] = await db.insert(schema.xpEvents).values({
    id: newId(), user_id: userId, kind: 'correction', points, event_key: `correction:${crypto.randomUUID()}`,
    reason, created_by: adminId,
  }).returning();
  return row;
}

export async function setLeaderboardVisibility(userId: string, visible: boolean) {
  await db.update(schema.users).set({ show_in_leaderboard: visible }).where(eq(schema.users.id, userId));
}

// ---------------------------------------------------------------- summaries

function since(days: number) { return new Date(Date.now() - days * DAY_MS); }

export async function getXpSummary(userId: string) {
  const events = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.user_id, userId));
  const live = events.filter(e => !e.revoked_at);
  const total = live.reduce((s, e) => s + e.points, 0);
  const activeDays = new Set(live.filter(e => e.kind === 'task_completed' || e.kind === 'blocker_resolved').map(e => dayKey(e.created_at!)));
  const st = streaks(activeDays, dayKey(new Date()));
  const recent = live.filter(e => e.created_at! >= since(90));
  const completions = recent.filter(e => e.kind === 'task_completed');
  const meta = (e: typeof events[number]) => (e.meta || {}) as Record<string, unknown>;
  const stats: BadgeStats = {
    onTimeCompleted: completions.filter(e => meta(e).on_time === true).length,
    withDeadline: completions.filter(e => meta(e).has_deadline === true).length,
    blockersResolved: live.filter(e => e.kind === 'blocker_resolved').length,
    validatedKept: 0, // set below
    kudosReceived: live.filter(e => e.kind === 'kudos').length,
    projectsCompleted: live.filter(e => e.kind === 'project_completed').length,
    bestStreak: st.best,
    criticalValidated: live.filter(e => e.kind === 'task_completed' && meta(e).validated === true && meta(e).tier === 'critical').length,
  };
  // Quality Guardian counts only validations that were never reopened.
  // meta.reopened survives the un-revoke of a re-completed task.
  const everRevoked = new Set(events.filter(e => e.revoked_at || meta(e).reopened).map(e => e.event_key));
  stats.validatedKept = live.filter(e => e.kind === 'task_completed' && meta(e).validated === true && !everRevoked.has(e.event_key)).length;

  const [u] = await db.select({ show: schema.users.show_in_leaderboard }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const startToday = dayStart();
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const to = Date.now() - (7 - i - 1) * 7 * DAY_MS;
    const from = to - 7 * DAY_MS;
    return { key: dayKey(new Date(from)), value: live.filter(e => e.created_at!.getTime() >= from && e.created_at!.getTime() < to).reduce((s, e) => s + e.points, 0) };
  });
  const sum = (from: number, to: number) => live.filter(e => e.created_at!.getTime() >= from && e.created_at!.getTime() < to).reduce((s, e) => s + e.points, 0);
  const now = Date.now();
  return {
    total,
    level: levelFor(total),
    streak: st,
    badges: BADGES.map(b => ({ id: b.id, name: b.name, rule: b.rule, earned: b.earned(stats), progress: b.progress(stats) })),
    stats,
    weekly,
    period: { last30: sum(now - 30 * DAY_MS, now), prev30: sum(now - 60 * DAY_MS, now - 30 * DAY_MS) },
    today: {
      blockersResolved: live.filter(e => e.kind === 'blocker_resolved' && e.created_at! >= startToday).length,
      earned: live.filter(e => (e.kind === 'task_completed' || e.kind === 'blocker_resolved') && e.created_at! >= startToday).reduce((s, e) => s + e.points, 0),
    },
    show_in_leaderboard: !!u?.show,
    events: events
      .sort((a, b) => b.created_at!.getTime() - a.created_at!.getTime())
      .slice(0, 40)
      .map(e => ({ id: e.id, kind: e.kind, points: e.points, reason: e.reason, task_id: e.task_id, revoked: !!e.revoked_at, revoked_reason: e.revoked_reason, created_at: e.created_at!.toISOString() })),
  };
}

/** Peer validations done by this user this week (tasks they created, moved en_revision → termine). */
export async function validationsThisWeek(userId: string) {
  const rows = await db.select({ id: schema.xpEvents.id }).from(schema.xpEvents)
    .where(and(eq(schema.xpEvents.created_by, userId), eq(schema.xpEvents.kind, 'task_completed'),
      sql`${schema.xpEvents.meta}->>'validated' = 'true'`, gte(schema.xpEvents.created_at, since(7))));
  return rows.length;
}

export async function getLeaderboards(userId: string, isGlobalAdmin: boolean, days: number, workspaceIds: string[]) {
  const from = since(days);
  const teams = workspaceIds.length ? await db.execute(sql`
    SELECT w.id, w.name, w.color,
      coalesce(sum(e.points) FILTER (WHERE e.id IS NOT NULL), 0)::int AS xp,
      count(e.id) FILTER (WHERE e.kind = 'task_completed' AND e.meta->>'validated' = 'true')::int AS validated,
      count(e.id) FILTER (WHERE e.kind = 'blocker_resolved')::int AS blockers,
      (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = w.id)::int AS members
    FROM workspaces w
    LEFT JOIN xp_events e ON e.workspace_id = w.id AND e.revoked_at IS NULL AND e.created_at >= ${from}
    WHERE w.id IN (${sql.join(workspaceIds.map(id => sql`${id}`), sql`, `)})
    GROUP BY w.id ORDER BY xp DESC`) : { rows: [] };

  // Individual board: opt-in users only, restricted to people sharing a workspace (admins: all opt-ins).
  const people = await db.execute(sql`
    SELECT u.id, u.name, u.avatar_url, coalesce(sum(e.points), 0)::int AS xp,
      count(e.id) FILTER (WHERE e.kind = 'blocker_resolved')::int AS blockers,
      count(e.id) FILTER (WHERE e.kind = 'task_completed' AND e.meta->>'validated' = 'true')::int AS validated
    FROM users u
    LEFT JOIN xp_events e ON e.user_id = u.id AND e.revoked_at IS NULL AND e.created_at >= ${from}
    WHERE u.show_in_leaderboard = true
      AND (${isGlobalAdmin} OR u.id = ${userId} OR EXISTS (
        SELECT 1 FROM workspace_members m1 JOIN workspace_members m2 ON m1.workspace_id = m2.workspace_id
        WHERE m1.user_id = ${userId} AND m2.user_id = u.id))
    GROUP BY u.id ORDER BY xp DESC LIMIT 50`);
  return { teams: teams.rows, people: people.rows };
}

export async function getRecognitions(workspaceIds: string[], isGlobalAdmin: boolean, userId: string) {
  const rows = await db.execute(sql`
    SELECT e.id, e.reason, e.created_at, e.task_id, t.title AS task_title,
      tu.id AS to_id, tu.name AS to_name, fu.id AS from_id, fu.name AS from_name
    FROM xp_events e
    JOIN users tu ON tu.id = e.user_id
    LEFT JOIN users fu ON fu.id = e.created_by
    LEFT JOIN tasks t ON t.id = e.task_id
    WHERE e.kind = 'kudos' AND e.revoked_at IS NULL
      AND (${isGlobalAdmin} OR e.user_id = ${userId} OR e.created_by = ${userId}
        OR e.workspace_id IN (${workspaceIds.length ? sql.join(workspaceIds.map(id => sql`${id}`), sql`, `) : sql`NULL`}))
    ORDER BY e.created_at DESC LIMIT 30`);
  return rows.rows;
}

// ---------------------------------------------------------------- challenges

export const CHALLENGE_METRICS: Record<string, { label: string; unit: string }> = {
  blockers_resolved: { label: 'Blocages levés', unit: 'blocages' },
  validated_tasks: { label: 'Livrables validés par un pair', unit: 'livrables' },
  overdue_reduction: { label: 'Réduction des tâches en retard', unit: '%' },
  on_time_rate: { label: 'Taux de livraison à temps', unit: '%' },
};

async function overdueCount(workspaceId: string) {
  const r = await db.execute(sql`
    SELECT count(*)::int AS n FROM tasks t JOIN projects p ON p.id = t.project_id
    WHERE p.workspace_id = ${workspaceId} AND t.status <> 'termine' AND t.end_at < now()`);
  return (r.rows[0] as { n: number }).n;
}

export async function createChallenge(data: { workspace_id: string; title: string; metric: string; target: number; reward?: string; start_at: Date; end_at: Date; created_by: string }) {
  const baseline = data.metric === 'overdue_reduction' ? await overdueCount(data.workspace_id) : null;
  const [row] = await db.insert(schema.challenges).values({ id: `chl_${crypto.randomBytes(8).toString('hex')}`, ...data, baseline }).returning();
  return row;
}

export async function deleteChallenge(id: string) {
  await db.delete(schema.challenges).where(eq(schema.challenges.id, id));
}

export async function getChallenge(id: string) {
  const [row] = await db.select().from(schema.challenges).where(eq(schema.challenges.id, id)).limit(1);
  return row || null;
}

/** Progress is recomputed from valid events only (revoked rewards never count). */
export async function getChallenges(workspaceIds: string[]) {
  if (!workspaceIds.length) return [];
  const rows = await db.select().from(schema.challenges).where(inArray(schema.challenges.workspace_id, workspaceIds));
  const out = [];
  for (const c of rows) {
    const end = c.end_at < new Date() ? c.end_at : new Date();
    let value = 0;
    let detail = '';
    if (c.metric === 'blockers_resolved' || c.metric === 'validated_tasks') {
      const r = await db.execute(sql`
        SELECT count(*)::int AS n FROM xp_events
        WHERE workspace_id = ${c.workspace_id} AND revoked_at IS NULL AND created_at >= ${c.start_at} AND created_at <= ${end}
          AND ${c.metric === 'blockers_resolved' ? sql`kind = 'blocker_resolved'` : sql`kind = 'task_completed' AND meta->>'validated' = 'true'`}`);
      value = (r.rows[0] as { n: number }).n;
      detail = `${value} / ${c.target}`;
    } else if (c.metric === 'overdue_reduction') {
      const cur = await overdueCount(c.workspace_id);
      const base = c.baseline || 0;
      value = base > 0 ? Math.max(0, Math.round(((base - cur) / base) * 100)) : (cur === 0 ? 100 : 0);
      detail = `${base} → ${cur} tâches en retard`;
    } else if (c.metric === 'on_time_rate') {
      const r = await db.execute(sql`
        SELECT count(*) FILTER (WHERE t.completed_at <= t.end_at)::int AS ok, count(*)::int AS n
        FROM tasks t JOIN projects p ON p.id = t.project_id
        WHERE p.workspace_id = ${c.workspace_id} AND t.status = 'termine' AND t.end_at IS NOT NULL
          AND t.completed_at >= ${c.start_at} AND t.completed_at <= ${end}`);
      const { ok, n } = r.rows[0] as { ok: number; n: number };
      value = n ? Math.round((ok / n) * 100) : 0;
      detail = n ? `${ok} / ${n} à temps` : 'Aucune tâche avec échéance terminée';
    }
    const now = new Date();
    out.push({
      ...c,
      start_at: c.start_at.toISOString(), end_at: c.end_at.toISOString(), created_at: c.created_at?.toISOString(),
      metric_label: CHALLENGE_METRICS[c.metric]?.label || c.metric,
      unit: CHALLENGE_METRICS[c.metric]?.unit || '',
      value, detail,
      success: value >= c.target,
      state: now < c.start_at ? 'a_venir' : now > c.end_at ? 'termine' : 'en_cours',
    });
  }
  return out;
}
