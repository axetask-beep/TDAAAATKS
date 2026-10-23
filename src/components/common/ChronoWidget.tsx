import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Square } from 'lucide-react';
import { computeChronoState, formatDuration, CHRONO_LABELS } from '../../lib/chrono';

interface ChronoWidgetProps {
  startAt?: string | null;
  endAt?: string | null;
  completedAt?: string | null;
  stoppedAt?: string | null;
  size?: 'sm' | 'md';
}

// Lifecycle chrono for a project or task — purely derived from its schedule,
// ticks live while running/overtime, freezes once completed_at (or, for
// projects, a manual stoppedAt) is set.
export const ChronoWidget: React.FC<ChronoWidgetProps> = ({ startAt, endAt, completedAt, stoppedAt, size = 'md' }) => {
  const [now, setNow] = useState(() => new Date());
  const isFrozen = !!completedAt || !!stoppedAt;

  useEffect(() => {
    if (isFrozen) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isFrozen]);

  const state = computeChronoState(startAt, endAt, completedAt, now, stoppedAt);
  if (state.status === 'none') return null;

  const isRed = state.status === 'overtime' || state.status === 'completed_overtime' || state.status === 'stopped_overtime';
  const isDone = state.status === 'completed' || state.status === 'completed_overtime';
  const isStopped = state.status === 'stopped' || state.status === 'stopped_overtime';
  const isPending = state.status === 'pending';

  const colorClasses = isPending
    ? 'bg-[#1E293B] text-slate-400 border-[#334155]'
    : isStopped && !isRed
    ? 'bg-[#1E293B] text-slate-300 border-[#334155]'
    : isRed
    ? 'bg-rose-500/15 text-rose-400 border-rose-500/40'
    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';

  const Icon = isPending ? Clock : isStopped ? Square : isRed ? AlertTriangle : isDone ? CheckCircle2 : Clock;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1.5 gap-1.5';

  return (
    <div
      className={`inline-flex items-center rounded border font-bold ${colorClasses} ${sizeClasses}`}
      title={CHRONO_LABELS[state.status]}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>
        {isPending ? CHRONO_LABELS.pending : formatDuration(state.elapsedMs)}
        {state.overtimeMs > 0 && (
          <span className="ml-1 opacity-80">(+{formatDuration(state.overtimeMs)})</span>
        )}
      </span>
    </div>
  );
};
