import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import { Task } from '../../types';
import { ChronoWidget } from './ChronoWidget';
import { Clock, ChevronDown, Pin } from 'lucide-react';

// Chrome/Edge desktop only: an always-on-top window that floats over every other app.
const pipApi = (window as any).documentPictureInPicture as
  | { requestWindow: (o: { width: number; height: number }) => Promise<Window> }
  | undefined;

// The PiP window starts blank: copy the app's styles into it so Tailwind classes work.
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

// Pinned on screen: live chrono of every task the user has "En cours".
export const FloatingTimer: React.FC = () => {
  const { user } = useAuth();
  const { taskVersion, setSelectedTaskId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [pipWin, setPipWin] = useState<Window | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getDashboardTasks()
      .then(all => setTasks(all.filter(t => t.status === 'en_cours' && t.assignee_id === user.id)))
      .catch(() => {});
  }, [user, taskVersion]);

  // No task left in progress → close the floating window.
  useEffect(() => {
    if (!tasks.length) pipWin?.close();
  }, [tasks.length, pipWin]);

  const openPip = async () => {
    if (!pipApi) return;
    const win = await pipApi.requestWindow({ width: 320, height: 64 + 48 * Math.min(tasks.length, 4) });
    copyStyles(win.document);
    win.document.body.className = 'bg-[#090D16] p-2 m-0';
    win.addEventListener('pagehide', () => setPipWin(null));
    setPipWin(win);
  };

  if (!tasks.length) return null;

  const multi = tasks.length > 1;

  const cards = (inPip: boolean) => tasks.map(t => (
    <button
      key={t.id}
      onClick={() => { setSelectedTaskId(t.id); setOpen(false); if (inPip) window.focus(); }}
      className={`flex items-center gap-2 p-2 rounded-lg bg-[#0F172A]/95 border border-[#2563EB]/40 shadow-lg backdrop-blur text-left hover:border-[#2563EB] shrink-0 ${inPip ? 'w-full' : 'md:max-w-[16rem]'}`}
    >
      <ChronoWidget startAt={t.start_at} endAt={t.end_at} completedAt={t.completed_at} size="sm" />
      <span className="text-xs font-semibold text-slate-100 break-words min-w-0">{t.title}</span>
    </button>
  ));

  // While the always-on-top window is open, the chronos live there instead of in the page.
  if (pipWin) {
    return createPortal(<div className="flex flex-col gap-1.5">{cards(true)}</div>, pipWin.document.body);
  }

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
      <div className={`${multi && !open ? 'hidden md:flex' : 'flex'} flex-col md:flex-row md:items-center gap-1.5 w-full md:w-auto max-h-[50vh] overflow-y-auto md:overflow-y-visible md:overflow-x-auto`}>
        {pipApi && (
          <button
            onClick={openPip}
            title="Garder le chrono au-dessus de toutes les applications"
            className="hidden md:flex p-2 rounded-lg bg-[#0F172A]/95 border border-[#2563EB]/40 shadow-lg text-[#60A5FA] hover:border-[#2563EB] shrink-0"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
        {cards(false)}
      </div>
    </div>
  );
};
