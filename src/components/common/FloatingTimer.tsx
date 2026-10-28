import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import { Task } from '../../types';
import { ChronoWidget } from './ChronoWidget';

// Pinned on screen: live chrono of every task the user has "En cours".
export const FloatingTimer: React.FC = () => {
  const { user } = useAuth();
  const { taskVersion, setSelectedTaskId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) return;
    api.getDashboardTasks()
      .then(all => setTasks(all.filter(t => t.status === 'en_cours' && t.assignee_id === user.id)))
      .catch(() => {});
  }, [user, taskVersion]);

  if (!tasks.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-1.5 max-w-[min(20rem,calc(100vw-2rem))]">
      {tasks.map(t => (
        <button
          key={t.id}
          onClick={() => setSelectedTaskId(t.id)}
          className="flex items-center gap-2 p-2 rounded-lg bg-[#0F172A]/95 border border-[#2563EB]/40 shadow-lg backdrop-blur text-left hover:border-[#2563EB]"
        >
          <ChronoWidget startAt={t.start_at} endAt={t.end_at} completedAt={t.completed_at} size="sm" />
          <span className="text-xs font-semibold text-slate-100 break-words min-w-0">{t.title}</span>
        </button>
      ))}
    </div>
  );
};
