import React from 'react';
import { TaskStatus, TaskPriority, UserRole } from '../../types';
import { AlertCircle, Clock, CheckCircle2, PlayCircle, XCircle, Flame, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

export const StatusBadge: React.FC<{ status: TaskStatus; className?: string; size?: 'sm' | 'md' }> = ({ status, className = '', size = 'sm' }) => {
  const configs: Record<TaskStatus, { label: string; bg: string; text: string; border: string; dot: string; icon: React.ComponentType<{ className?: string }> }> = {
    a_faire: {
      label: 'À faire',
      bg: 'bg-[#171717]',
      text: 'text-neutral-300',
      border: 'border-[#2E2E2E]',
      dot: 'bg-neutral-400',
      icon: Clock,
    },
    en_cours: {
      label: 'En cours',
      bg: 'bg-[#2563EB]/15',
      text: 'text-[#60A5FA]',
      border: 'border-[#2563EB]/40',
      dot: 'bg-[#2563EB]',
      icon: PlayCircle,
    },
    en_revision: {
      label: 'En révision',
      bg: 'bg-indigo-950/30',
      text: 'text-indigo-300',
      border: 'border-indigo-800/40',
      dot: 'bg-indigo-400',
      icon: AlertCircle,
    },
    termine: {
      label: 'Terminé',
      bg: 'bg-emerald-950/30',
      text: 'text-emerald-300',
      border: 'border-emerald-800/40',
      dot: 'bg-emerald-400',
      icon: CheckCircle2,
    },
    bloque: {
      label: 'Bloqué',
      bg: 'bg-rose-950/30',
      text: 'text-rose-300',
      border: 'border-rose-800/40',
      dot: 'bg-rose-400',
      icon: XCircle,
    },
  };

  const config = configs[status] || configs.a_faire;
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5 gap-1.5' : 'text-xs px-2.5 py-1 gap-2';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: TaskPriority; className?: string; size?: 'sm' | 'md'; showLabel?: boolean }> = ({
  priority,
  className = '',
  size = 'sm',
  showLabel = true,
}) => {
  const configs: Record<TaskPriority, { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
    urgente: {
      label: 'Urgente',
      bg: 'bg-rose-950/30',
      text: 'text-rose-400',
      border: 'border-rose-800/50',
      icon: Flame,
    },
    haute: {
      label: 'Haute',
      bg: 'bg-amber-950/30',
      text: 'text-amber-400',
      border: 'border-amber-800/50',
      icon: ArrowUp,
    },
    normale: {
      label: 'Normale',
      bg: 'bg-sky-950/30',
      text: 'text-sky-400',
      border: 'border-sky-800/50',
      icon: ArrowRight,
    },
    basse: {
      label: 'Basse',
      bg: 'bg-[#171717]',
      text: 'text-neutral-400',
      border: 'border-[#2E2E2E]',
      icon: ArrowDown,
    },
  };

  const config = configs[priority] || configs.normale;
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[11px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-0.5 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
      title={`Priorité ${config.label}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

export const RoleBadge: React.FC<{ role: UserRole | string; className?: string }> = ({ role, className = '' }) => {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
        isAdmin
          ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40'
          : 'bg-[#131B2E] text-slate-400 border border-[#1E293B]'
      } ${className}`}
    >
      {isAdmin ? 'Admin' : 'Membre'}
    </span>
  );
};

