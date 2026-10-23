// Command Center / AXP checks. Run: npm test
// Part 1 = pure rules (no DB). Part 2 = integration against a THROWAWAY local
// database, only when TEST_DATABASE_URL points at localhost (never prod).
import assert from 'node:assert/strict';
import {
  ScopeTask, ScopeProject, KPI_DEFS, kpiTasks, applyFilters, projectHealth, completionXp, levelFor, streaks,
  planDay, riskBucket, onTimeRate, periodCompare, missions, XP_RULES, DAY_MS, Scope,
} from '../src/lib/insights.ts';

const NOW = Date.UTC(2026, 9, 21, 10); // Wed 21 Oct 2026, 10:00 UTC
const iso = (ms: number) => new Date(ms).toISOString();
let n = 0;
const task = (p: Partial<ScopeTask> = {}): ScopeTask => ({
  id: `t${++n}`, title: `T${n}`, status: 'a_faire', priority: 'normale', project_id: 'p1', workspace_id: 'w1',
  assignee_id: 'u1', created_by: 'u2', created_at: iso(NOW - 30 * DAY_MS), start_at: null, end_at: null,
  completed_at: null, blocked_at: null, stopped_at: null, estimated_minutes: null, ...p,
});
const project = (p: Partial<ScopeProject> = {}): ScopeProject => ({
  id: 'p1', name: 'P1', workspace_id: 'w1', created_by: 'u2', start_at: null, end_at: null, completed_at: null, stopped_at: null,
  created_at: iso(NOW - 30 * DAY_MS), ...p,
});
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); console.log(`  ✓ ${name}`); } catch (e) { console.error(`  ✗ ${name}`); throw e; }
};

async function pure() {
  console.log('Règles pures');
  const overdueUrgent = task({ priority: 'urgente', end_at: iso(NOW - 2 * DAY_MS) });
  const dueSoonHigh = task({ priority: 'haute', end_at: iso(NOW + DAY_MS) });
  const blocked = task({ status: 'bloque', blocked_at: iso(NOW - 3 * DAY_MS) });
  const doneOnTime = task({ status: 'termine', end_at: iso(NOW - DAY_MS), completed_at: iso(NOW - 2 * DAY_MS) });
  const doneLate = task({ status: 'termine', end_at: iso(NOW - 5 * DAY_MS), completed_at: iso(NOW - 3 * DAY_MS) });
  const donePrev = task({ status: 'termine', completed_at: iso(NOW - 40 * DAY_MS) });
  const review = task({ status: 'en_revision', assignee_id: 'u1', created_by: 'u2' });
  const all = [overdueUrgent, dueSoonHigh, blocked, doneOnTime, doneLate, donePrev, review];

  await test('KPI = longueur de la liste de détail (même prédicat)', () => {
    for (const k of Object.keys(KPI_DEFS) as (keyof typeof KPI_DEFS)[]) {
      assert.equal(kpiTasks(all, k, NOW, 30).length, all.filter(t => KPI_DEFS[k].test(t, NOW, 30)).length);
    }
    assert.equal(kpiTasks(all, 'overdue', NOW, 30).length, 1);
    assert.equal(kpiTasks(all, 'critical', NOW, 30).length, 2);
    assert.equal(kpiTasks(all, 'completed', NOW, 30).length, 2);
  });
  await test('Une tâche terminée met à jour les indicateurs', () => {
    const t = task({ priority: 'urgente', end_at: iso(NOW - DAY_MS) });
    assert.equal(kpiTasks([t], 'overdue', NOW, 30).length, 1);
    const done = { ...t, status: 'termine' as const, completed_at: iso(NOW) };
    assert.equal(kpiTasks([done], 'overdue', NOW, 30).length, 0);
    assert.equal(kpiTasks([done], 'completed', NOW + 1, 30).length, 1);
  });
  await test('Un changement de priorité recalcule « critique »', () => {
    const t = task({ priority: 'normale', end_at: iso(NOW + DAY_MS) });
    assert.equal(kpiTasks([t], 'critical', NOW, 30).length, 0);
    assert.equal(kpiTasks([{ ...t, priority: 'haute' }], 'critical', NOW, 30).length, 1);
  });
  await test('Comparaison de période : pas de % sans référence', () => {
    assert.equal(periodCompare([doneOnTime], NOW, 30).deltaPct, null);
    assert.equal(periodCompare([doneOnTime, donePrev], NOW, 30).deltaPct, 0);
    assert.equal(onTimeRate([], NOW - DAY_MS, NOW).rate, null);
    assert.equal(onTimeRate(all, NOW - 30 * DAY_MS, NOW).rate, 0.5);
  });
  await test('Filtres : espace/responsable/priorité changent réellement les données', () => {
    const scope: Scope = { generated_at: iso(NOW), workspaces: [], users: [], notifications: [],
      projects: [project(), project({ id: 'p2', workspace_id: 'w2' })],
      tasks: [...all, task({ project_id: 'p2', workspace_id: 'w2', assignee_id: null, priority: 'basse' })] };
    assert.equal(applyFilters(scope, { days: 30, workspace_id: 'w2' }).tasks.length, 1);
    assert.equal(applyFilters(scope, { days: 30, assignee_id: 'none' }).tasks.length, 1);
    assert.equal(applyFilters(scope, { days: 30, priority: 'urgente' }).tasks.length, 1);
  });
  await test('Risque d’échéance : une catégorie, la plus grave', () => {
    assert.equal(riskBucket(blocked, NOW), 'bloquee');
    assert.equal(riskBucket(overdueUrgent, NOW), 'critique');
    assert.equal(riskBucket(task({ end_at: iso(NOW - DAY_MS) }), NOW), 'en_retard');
    assert.equal(riskBucket(dueSoonHigh, NOW), 'proche');
    assert.equal(riskBucket(task(), NOW), 'sans_date');
  });
  await test('Santé projet : règles explicites', () => {
    assert.equal(projectHealth(project(), [task({ status: 'termine', completed_at: iso(NOW) })], NOW).health, 'sain');
    const watch = projectHealth(project(), [overdueUrgent, task(), task(), task()], NOW);
    assert.equal(watch.health, 'surveiller');
    const crit = projectHealth(project({ end_at: iso(NOW - DAY_MS) }), [task()], NOW);
    assert.equal(crit.health, 'critique');
    assert.ok(crit.reasons.includes('Échéance du projet dépassée'));
    assert.equal(projectHealth(project({ completed_at: iso(NOW) }), [], NOW).health, 'termine');
  });
  await test('XP : barème, validation par un pair, anti-abus, plafond', () => {
    const base = { estimated_minutes: null, previousStatus: 'en_cours' as const, actorId: 'u1', assigneeId: 'u1', createdBy: 'u2', createdAt: NOW - DAY_MS, now: NOW, earnedToday: 0 };
    assert.equal(completionXp({ ...base, priority: 'normale' }).points, XP_RULES.simple);
    assert.equal(completionXp({ ...base, priority: 'normale', estimated_minutes: 120 }).points, XP_RULES.medium);
    assert.equal(completionXp({ ...base, priority: 'urgente' }).points, XP_RULES.unvalidatedCap);
    const v = completionXp({ ...base, priority: 'urgente', previousStatus: 'en_revision', actorId: 'u2' });
    assert.equal(v.points, XP_RULES.critical); assert.equal(v.validated, true);
    assert.equal(completionXp({ ...base, priority: 'normale', createdBy: 'u1', createdAt: NOW - 60_000 }).points, 0);
    assert.equal(completionXp({ ...base, priority: 'normale', earnedToday: XP_RULES.dailyCap - 4 }).points, 4);
  });
  await test('Niveaux', () => {
    assert.equal(levelFor(0).name, 'Initié');
    assert.equal(levelFor(99).level, 1);
    assert.equal(levelFor(100).level, 2);
    assert.equal(levelFor(10_000).name, 'Sommet de la performance');
    assert.equal(levelFor(10_000).next, null);
  });
  await test('Streaks : week-end neutre, 1 jour manqué pardonné, 2 cassent', () => {
    // Mon 12 → Fri 16 Oct, Mon 19, Tue 20; today Wed 21 (in progress)
    assert.equal(streaks(new Set(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-19', '2026-10-20']), '2026-10-21').current, 7);
    assert.equal(streaks(new Set(['2026-10-15', '2026-10-19', '2026-10-20']), '2026-10-21').current, 3); // Fri 16 missed: forgiven
    assert.equal(streaks(new Set(['2026-10-14', '2026-10-19', '2026-10-20']), '2026-10-21').current, 2); // Thu+Fri missed
    assert.equal(streaks(new Set(), '2026-10-21').current, 0);
  });
  await test('Mission du jour : classement expliqué et réduit en surcharge', () => {
    const plan = planDay(all, 'u1', NOW, NOW - 10 * 3600_000);
    assert.equal(plan.main?.task.id, overdueUrgent.id);
    assert.ok(plan.main!.reasons.some(r => r.startsWith('En retard')));
    assert.ok(!plan.top.some(r => r.task.status === 'bloque'));
    const heavy = Array.from({ length: 8 }, () => task({ priority: 'haute', end_at: iso(NOW - DAY_MS), estimated_minutes: 120 }));
    const p2 = planDay(heavy, 'u1', NOW, NOW - 10 * 3600_000);
    assert.equal(p2.overloaded, true);
    assert.equal(p2.top.length, 2);
    const ms = missions({ plan: p2, tasks: heavy, userId: 'u1', now: NOW, dayStart: NOW - 10 * 3600_000, weekStart: NOW - 2 * DAY_MS, blockersResolvedToday: 0, validatedThisWeek: 0 });
    assert.equal(ms.find(m => m.id === 'day_priorities')?.target, 1);
  });
  await test('Missions : uniquement les tâches de la personne', () => {
    const other = [task({ assignee_id: 'u9', priority: 'urgente' })];
    const plan = planDay(other, 'u1', NOW, NOW - 3600_000);
    assert.equal(missions({ plan, tasks: other, userId: 'u1', now: NOW, dayStart: NOW - 3600_000, weekStart: NOW - DAY_MS, blockersResolvedToday: 0, validatedThisWeek: 0 }).length, 0);
  });
}

async function integration() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) { console.log('\nIntégration ignorée (TEST_DATABASE_URL non défini).'); return; }
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error('TEST_DATABASE_URL doit pointer sur une base locale.');
  process.env.DATABASE_URL = url;
  const q = await import('../src/db/queries.ts');
  const g = await import('../src/db/gamification.ts');
  const { db } = await import('../src/db/index.ts');
  const schema = await import('../src/db/schema.ts');
  const { eq, sql } = await import('drizzle-orm');
  console.log('\nIntégration (base locale)');

  const tag = Date.now().toString(36);
  const a = await q.createUserWithRole(`a-${tag}@test.local`, 'pass1234', 'Alice');
  const b = await q.createUserWithRole(`b-${tag}@test.local`, 'pass1234', 'Bob');
  const c = await q.createUserWithRole(`c-${tag}@test.local`, 'pass1234', 'Chloé');
  const ws = await q.createWorkspace(`WS ${tag}`, '#2563EB', 'Briefcase', b.id);
  await q.addWorkspaceMember(ws.id, a.id);
  const prj = await q.createProject(ws.id, `Projet ${tag}`, undefined, undefined, undefined, 'en_cours', b.id);
  const events = async (taskId: string) => db.select().from(schema.xpEvents).where(eq(schema.xpEvents.task_id, taskId));
  const old = async (taskId: string) => db.update(schema.tasks).set({ created_at: new Date(Date.now() - DAY_MS) }).where(eq(schema.tasks.id, taskId));

  const t1 = await q.createTask({ project_id: prj.id, title: 'Livrable urgent', priority: 'urgente', assignee_id: a.id, created_by: b.id });
  await old(t1.id);
  await test('Livrable validé par un pair → AXP une seule fois', async () => {
    await q.updateTask(t1.id, { status: 'en_revision' }, a.id);
    await q.updateTask(t1.id, { status: 'termine' }, b.id);
    await q.updateTask(t1.id, { status: 'termine' }, b.id);
    const ev = await events(t1.id);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].user_id, a.id);
    assert.equal(ev[0].points, XP_RULES.critical);
  });
  await test('Réouverture : AXP suspendus puis rétablis sans doublon', async () => {
    await q.updateTask(t1.id, { status: 'en_cours' }, a.id);
    let ev = await events(t1.id);
    assert.ok(ev[0].revoked_at);
    await q.updateTask(t1.id, { status: 'termine' }, a.id);
    ev = await events(t1.id);
    assert.equal(ev.length, 1);
    assert.equal(ev[0].revoked_at, null);
    assert.equal(ev[0].points, XP_RULES.critical);
  });
  await test('Glisser-déposer (reorder) passe par les mêmes règles', async () => {
    const t = await q.createTask({ project_id: prj.id, title: 'Kanban', assignee_id: a.id, created_by: b.id });
    await old(t.id);
    await q.reorderTasks([{ id: t.id, status: 'termine', position: 0 }], a.id);
    await q.reorderTasks([{ id: t.id, status: 'termine', position: 1 }], a.id);
    assert.equal((await events(t.id)).length, 1);
  });
  await test('Tâche annulée (supprimée) → AXP annulés, trace conservée', async () => {
    const t = await q.createTask({ project_id: prj.id, title: 'À annuler', assignee_id: a.id, created_by: b.id });
    await old(t.id);
    await q.updateTask(t.id, { status: 'termine' }, a.id);
    const [before] = await events(t.id);
    await q.deleteTask(t.id);
    const [row] = await db.select().from(schema.xpEvents).where(eq(schema.xpEvents.id, before.id));
    assert.ok(row.revoked_at);
    assert.equal(row.revoked_reason, 'Tâche supprimée (annulée)');
  });
  await test('Tâche créée et fermée par soi-même en 1 min → 0 AXP', async () => {
    const t = await q.createTask({ project_id: prj.id, title: 'Artificielle', assignee_id: a.id, created_by: a.id });
    await q.updateTask(t.id, { status: 'termine' }, a.id);
    assert.equal((await events(t.id))[0].points, 0);
  });
  await test('Blocage levé après ≥ 1 h → récompense unique', async () => {
    const t = await q.createTask({ project_id: prj.id, title: 'Bloquée', assignee_id: a.id, created_by: b.id });
    await q.updateTask(t.id, { status: 'bloque' }, a.id);
    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, t.id));
    assert.ok(row.blocked_at, 'blocked_at rempli');
    await db.update(schema.tasks).set({ blocked_at: new Date(Date.now() - 2 * 3600_000) }).where(eq(schema.tasks.id, t.id));
    await q.updateTask(t.id, { status: 'en_cours' }, b.id);
    await q.updateTask(t.id, { status: 'bloque' }, a.id);
    await db.update(schema.tasks).set({ blocked_at: new Date(Date.now() - 2 * 3600_000) }).where(eq(schema.tasks.id, t.id));
    await q.updateTask(t.id, { status: 'en_cours' }, b.id);
    const ev = (await events(t.id)).filter(e => e.kind === 'blocker_resolved');
    assert.equal(ev.length, 1);
    assert.equal(ev[0].user_id, b.id);
    const [after] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, t.id));
    assert.equal(after.blocked_at, null);
  });
  await test('Reconnaissance : 1 par collègue et par jour', async () => {
    await g.giveKudos(a.id, b.id, 'Merci pour la relecture', null);
    await assert.rejects(() => g.giveKudos(a.id, b.id, 'Encore merci', null));
    assert.equal(await g.shareWorkspace(a.id, b.id), true);
    assert.equal(await g.shareWorkspace(a.id, c.id), false);
  });
  await test('Défi collectif : progresse sur événements valides uniquement', async () => {
    const ch = await g.createChallenge({ workspace_id: ws.id, title: 'Débloquer', metric: 'blockers_resolved', target: 2, start_at: new Date(Date.now() - DAY_MS), end_at: new Date(Date.now() + DAY_MS), created_by: b.id });
    const list = await g.getChallenges([ws.id]);
    const mine = list.find(x => x.id === ch.id)!;
    assert.equal(mine.value, 1);
    assert.equal(mine.success, false);
    assert.equal((await g.getChallenges([])).length, 0);
  });
  await test('Projet terminé → bonus collectif une fois par contributeur', async () => {
    const p2 = await q.createProject(ws.id, `Mini ${tag}`, undefined, undefined, undefined, 'en_cours', b.id);
    const t = await q.createTask({ project_id: p2.id, title: 'Unique', assignee_id: a.id, created_by: b.id });
    await old(t.id);
    await q.updateTask(t.id, { status: 'termine' }, a.id);
    await q.updateTask(t.id, { status: 'en_cours' }, a.id);
    await q.updateTask(t.id, { status: 'termine' }, a.id);
    const r = await db.execute(sql`SELECT count(*)::int AS n FROM xp_events WHERE kind = 'project_completed' AND meta->>'project_id' = ${p2.id}`);
    assert.equal((r.rows[0] as { n: number }).n, 1);
  });
  await test('Classement individuel : opt-in et périmètre des espaces', async () => {
    let boards = await g.getLeaderboards(c.id, false, 30, []);
    assert.equal(boards.people.length, 0);
    await g.setLeaderboardVisibility(a.id, true);
    boards = await g.getLeaderboards(c.id, false, 30, []); // Chloé ne partage aucun espace avec Alice
    assert.equal(boards.people.length, 0);
    boards = await g.getLeaderboards(b.id, false, 30, [ws.id]);
    assert.deepEqual(boards.people.map((p: any) => p.id), [a.id]);
  });
  await test('Scope du Command Center : membres limités à leurs espaces', async () => {
    const scopeC = await q.getInsightsScope(c.id, false);
    assert.equal(scopeC.tasks.length, 0);
    const scopeA = await q.getInsightsScope(a.id, false);
    assert.ok(scopeA.tasks.every(t => t.workspace_id === ws.id || scopeA.workspaces.some(w => w.id === t.workspace_id)));
    assert.ok(scopeA.tasks.length >= 5);
  });
  await test('Résumé XP cohérent avec le journal', async () => {
    const s = await g.getXpSummary(a.id);
    const r = await db.execute(sql`SELECT coalesce(sum(points),0)::int AS s FROM xp_events WHERE user_id = ${a.id} AND revoked_at IS NULL`);
    assert.equal(s.total, (r.rows[0] as { s: number }).s);
    assert.ok(s.badges.find(x => x.id === 'project_finisher')!.earned);
  });
  await test('Notification lue → read_at renseigné (analyse des alertes)', async () => {
    const nn = await q.createNotification({ user_id: a.id, type: 'task_overdue', title: 'x' });
    await q.markNotificationRead(nn.id, a.id);
    const [row] = await db.select().from(schema.notifications).where(eq(schema.notifications.id, nn.id));
    assert.ok(row.read_at);
  });
  await test('Alerte obsolète : plus de rappel quand la tâche est terminée', async () => {
    const t = await q.createTask({ project_id: prj.id, title: 'Échue', assignee_id: a.id, created_by: b.id, end_at: iso(Date.now() - DAY_MS) });
    await q.updateTask(t.id, { status: 'termine' }, a.id);
    await q.createDueDateNotifications();
    const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.task_id, t.id));
    assert.equal(rows.length, 0);
  });
}

(async () => {
  await pure();
  await integration();
  console.log('\nTous les tests passent.');
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
