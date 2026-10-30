import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import { Task } from '../../types';
import { ChronoWidget } from './ChronoWidget';
import { Clock, ChevronDown, Pin, GripHorizontal, X } from 'lucide-react';

// AxeTask desktop app (Electron): it turns this named popup into an always-on-top window.
const isDesktopApp = navigator.userAgent.includes('Electron');

// Chrome/Edge desktop only: an always-on-top window that floats over every other app.
const pipApi = (isDesktopApp
  ? { requestWindow: async ({ width, height }: { width: number; height: number }) =>
      window.open('about:blank', 'axetask-chrono', `width=${width},height=${height}`)! }
  : (window as any).documentPictureInPicture) as
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
    // Desktop app: the window is transparent, only the card shows.
    win.document.body.className = isDesktopApp ? 'm-0 p-0 overflow-hidden' : 'bg-[#090D16] p-2 m-0';
    if (isDesktopApp) win.document.documentElement.style.background = win.document.body.style.background = 'transparent';
    win.addEventListener('pagehide', () => setPipWin(null));
    setPipWin(win);
  };

  // Desktop app: pop the always-on-top chrono out as soon as a task is in progress.
  useEffect(() => {
    if (isDesktopApp && tasks.length && !pipWin) openPip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length > 0]);

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

  if (pipWin && isDesktopApp) {
    return createPortal(<DesktopCard win={pipWin}>{cards(true)}</DesktopCard>, pipWin.document.body);
  }

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

// Desktop app card. The window has no title bar, so the top bar moves it
// (by hand: Electron ignores CSS drag regions in windows opened by the page).
// Its height goes to the desktop app through the window title ("chrono:<px>"),
// which resizes the window to fit.
const DesktopCard: React.FC<{ win: Window; children: React.ReactNode }> = ({ win, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => { win.document.title = `chrono:${Math.ceil(el.getBoundingClientRect().height)}`; };
    const ro = new (win as any).ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [win]);

  // Grab point inside the window, kept while dragging.
  const grab = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    grab.current = { x: e.screenX - win.screenX, y: e.screenY - win.screenY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (grab.current) win.moveTo(e.screenX - grab.current.x, e.screenY - grab.current.y);
  };
  const onPointerUp = () => { grab.current = null; };

  return (
    <div ref={ref} className="rounded-xl bg-[#090D16] border border-[#2563EB]/50 p-1.5 flex flex-col gap-1.5 select-none">
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Glisser pour déplacer"
        className="flex items-center justify-between px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#60A5FA] cursor-move touch-none"
      >
        <span className="flex items-center gap-1"><GripHorizontal className="w-3 h-3" />En cours</span>
        <button onClick={() => win.close()} title="Masquer" className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-[#1E293B] cursor-pointer">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
};
