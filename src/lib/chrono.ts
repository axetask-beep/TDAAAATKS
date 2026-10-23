// Chrono = a derived lifecycle state for a project or task, computed purely
// from its schedule (start_at/end_at), completion (completed_at) and, for
// projects only, a manual stop (stopped_at) — there is no persisted "timer
// running" flag anywhere. This is unrelated to the personal work-session
// stopwatch in WorkspaceContext.tsx ("Chronométrer").
export type ChronoStatus =
  | 'pending'
  | 'running'
  | 'overtime'
  | 'completed'
  | 'completed_overtime'
  | 'stopped'
  | 'stopped_overtime'
  | 'none';

export interface ChronoState {
  status: ChronoStatus;
  // Elapsed time since start_at (or since start_at until the freeze point), in ms.
  elapsedMs: number;
  // Time spent past end_at while not yet frozen (or, once frozen, how late
  // the freeze happened), in ms. Always 0 when not overdue.
  overtimeMs: number;
}

export function computeChronoState(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  completedAt: string | null | undefined,
  now: Date = new Date(),
  stoppedAt?: string | null
): ChronoState {
  if (!startAt) {
    return { status: 'none', elapsedMs: 0, overtimeMs: 0 };
  }

  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : null;
  const completed = completedAt ? new Date(completedAt).getTime() : null;
  const stopped = stoppedAt ? new Date(stoppedAt).getTime() : null;
  const nowMs = now.getTime();

  if (nowMs < start) {
    return { status: 'pending', elapsedMs: 0, overtimeMs: 0 };
  }

  // A manual stop freezes the chrono the same way completion does, but is
  // tracked separately so it isn't silently undone by the task-completion
  // auto-reopen logic (see recalcProjectCompletion) — and so it's labeled
  // distinctly ("Arrêté" vs "Terminé").
  const freezeAt = stopped !== null ? stopped : completed;
  if (freezeAt !== null) {
    const elapsedMs = freezeAt - start;
    const overtimeMs = end !== null && freezeAt > end ? freezeAt - end : 0;
    const isManualStop = stopped !== null;
    return {
      status: overtimeMs > 0
        ? (isManualStop ? 'stopped_overtime' : 'completed_overtime')
        : (isManualStop ? 'stopped' : 'completed'),
      elapsedMs,
      overtimeMs,
    };
  }

  const isOverdue = end !== null && nowMs > end;
  return {
    status: isOverdue ? 'overtime' : 'running',
    elapsedMs: nowMs - start,
    overtimeMs: isOverdue ? nowMs - end! : 0,
  };
}

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}j ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export const CHRONO_LABELS: Record<ChronoStatus, string> = {
  none: 'Aucune date définie',
  pending: "Pas encore démarré",
  running: 'En cours',
  overtime: 'En retard',
  completed: 'Terminé dans les temps',
  completed_overtime: 'Terminé avec retard',
  stopped: 'Arrêté manuellement',
  stopped_overtime: 'Arrêté manuellement (en retard)',
};
