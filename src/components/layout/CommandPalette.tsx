import React, { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { api, SearchResults } from '../../lib/api';
import { STATUS_LABELS } from '../../types';
import { Search, X, Radar, ListTodo, BarChart3, Trophy, Bell, Plus, Clock, MessageSquare, Settings, FolderGit2, CheckSquare, Layers } from 'lucide-react';

export type PaletteView = 'command' | 'analytics' | 'progress' | 'dashboard' | 'workspaces' | 'time_tracking' | 'messages' | 'settings' | 'project_detail';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: PaletteView) => void;
}

interface Item { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void }

/** Ctrl/⌘+K: actions + server-side search across every workspace the user can access. */
export const CommandPalette: React.FC<Props> = ({ open, onClose, onNavigate }) => {
  const { setIsCreateTaskModalOpen, setSelectedTaskId, setCurrentProjectId } = useWorkspace();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResults>({ tasks: [], projects: [] });
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => { if (!open) { setQ(''); setResults({ tasks: [], projects: [] }); setActive(0); } }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults({ tasks: [], projects: [] }); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults({ tasks: [], projects: [] })).finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  const go = (fn: () => void) => () => { fn(); onClose(); };

  const actions: Item[] = useMemo(() => [
    { id: 'a-new', label: 'Créer une tâche', icon: <Plus className="w-3.5 h-3.5" />, run: go(() => setIsCreateTaskModalOpen(true)) },
    { id: 'a-cc', label: 'Ouvrir le Centre de contrôle', hint: 'À traiter maintenant, mission du jour', icon: <Radar className="w-3.5 h-3.5" />, run: go(() => onNavigate('command')) },
    { id: 'a-mine', label: 'Mes tâches prioritaires', icon: <ListTodo className="w-3.5 h-3.5" />, run: go(() => onNavigate('dashboard')) },
    { id: 'a-alerts', label: 'Ouvrir le centre d’alertes', icon: <Bell className="w-3.5 h-3.5" />, run: go(() => window.dispatchEvent(new Event('axetask:open-notifications'))) },
    { id: 'a-ana', label: 'Voir les analyses', icon: <BarChart3 className="w-3.5 h-3.5" />, run: go(() => onNavigate('analytics')) },
    { id: 'a-xp', label: 'Missions & progression', icon: <Trophy className="w-3.5 h-3.5" />, run: go(() => onNavigate('progress')) },
    { id: 'a-ws', label: 'Tous les espaces', icon: <Layers className="w-3.5 h-3.5" />, run: go(() => onNavigate('workspaces')) },
    { id: 'a-time', label: 'Mon temps', icon: <Clock className="w-3.5 h-3.5" />, run: go(() => onNavigate('time_tracking')) },
    { id: 'a-msg', label: 'Messages', icon: <MessageSquare className="w-3.5 h-3.5" />, run: go(() => onNavigate('messages')) },
    { id: 'a-set', label: user?.role === 'admin' ? 'Paramètres & équipe' : 'Paramètres', icon: <Settings className="w-3.5 h-3.5" />, run: go(() => onNavigate('settings')) },
  ].filter(a => user?.role === 'admin' || (a.id !== 'a-cc' && a.id !== 'a-ana')), [user?.role]);

  const needle = q.trim().toLowerCase();
  const items: Item[] = [
    ...actions.filter(a => !needle || a.label.toLowerCase().includes(needle)),
    ...results.projects.map(p => ({
      id: `p-${p.id}`, label: p.name, hint: 'Projet', icon: <FolderGit2 className="w-3.5 h-3.5" />,
      run: go(() => { setCurrentProjectId(p.id); onNavigate('project_detail'); }),
    })),
    ...results.tasks.map(t => ({
      id: `t-${t.id}`, label: t.title, hint: `${t.project_name} · ${STATUS_LABELS[t.status] || t.status}`, icon: <CheckSquare className="w-3.5 h-3.5" />,
      run: go(() => setSelectedTaskId(t.id)),
    })),
  ];

  useEffect(() => { setActive(0); }, [q, results]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); items[active].run(); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-start justify-center pt-16 sm:pt-20 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Palette de commandes" onMouseDown={e => e.stopPropagation()}
        className="bg-[#0F172A] border border-[#1E293B] rounded-lg w-full max-w-2xl overflow-hidden shadow-2xl font-mono">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1E293B] bg-[#0B1120]">
          <Search className="w-4 h-4 text-[#3B82F6]" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Action, tâche ou projet…" aria-label="Rechercher"
            className="w-full bg-transparent text-xs text-slate-100 placeholder-slate-500 focus:outline-none" />
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-[#1E293B]" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <ul className="max-h-96 overflow-y-auto p-1.5" role="listbox">
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={i === active}>
              <button onMouseEnter={() => setActive(i)} onClick={it.run}
                className={`w-full text-left px-2.5 py-2 rounded flex items-center gap-2.5 ${i === active ? 'bg-[#2563EB]/15 text-[#93C5FD]' : 'text-slate-300'}`}>
                <span className="text-slate-400 shrink-0">{it.icon}</span>
                <span className="text-xs truncate flex-1">{it.label}</span>
                {it.hint && <span className="text-[10px] text-slate-500 truncate max-w-[45%]">{it.hint}</span>}
              </button>
            </li>
          ))}
          {searching && <li className="px-3 py-3 text-[11px] text-slate-500">Recherche…</li>}
          {!searching && needle.length >= 2 && items.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">Aucun résultat pour « {q} ».</li>}
        </ul>
        <div className="px-3 py-1.5 border-t border-[#1E293B] text-[10px] text-slate-500 hidden sm:flex gap-3"><span>↑↓ naviguer</span><span>↵ ouvrir</span><span>Échap fermer</span></div>
      </div>
    </div>
  );
};
