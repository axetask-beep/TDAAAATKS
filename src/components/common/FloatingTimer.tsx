import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import { Task } from '../../types';
import { ChronoWidget } from './ChronoWidget';
import { Clock, ChevronDown } from 'lucide-react';

// Pinned on screen: live chrono of every task the user has "En cours".
export const FloatingTimer: React.FC = () => {
  const { user } = useAuth();
  const { taskVersion, setSelectedTaskId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.getDashboardTasks()
      .then(all => setTasks(all.filter(t => t.status === 'en_cours' && t.assignee_id === user.id)))
      .catch(() => {});
  }, [user, taskVersion]);

  if (!tasks.length) return null;

  const multi = tasks.length > 1;

  // PC: one horizontal row (scrolls sideways if too many).
  // Mobile: with several tasks, a toggle opens them as a dropdown list.
  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:max-w-[calc(100vw-2rem)] z-40 flex flex-col items-end gap-1.5 pointer-events-none [&>*]:pointer-events-auto">
      {multi && (
        <button
          onClick={() => setOpen(o => !o)}
          className="md:hidden flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F172A]/95 border border-[#2563EB]/40 shadow-lg backdrop-blur text-xs font-bold text-[#60A5FA]"
        >
          <Clock className="w-3.5 h-3.5" />
          {tasks.length} tâches en cours
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      <div className={`${multi && !open ? 'hidden md:flex' : 'flex'} flex-col md:flex-row gap-1.5 w-full md:w-auto max-h-[50vh] overflow-y-auto md:overflow-y-visible md:overflow-x-auto`}>
        {tasks.map(t => (
          <button
            key={t.id}
            onClick={() => { setSelectedTaskId(t.id); setOpen(false); }}
            className="flex items-center gap-2 p-2 rounded-lg bg-[#0F172A]/95 border border-[#2563EB]/40 shadow-lg backdrop-blur text-left hover:border-[#2563EB] md:max-w-[16rem] shrink-0"
          >
            <ChronoWidget startAt={t.start_at} endAt={t.end_at} completedAt={t.completed_at} size="sm" />
            <span className="text-xs font-semibold text-slate-100 break-words min-w-0">{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
