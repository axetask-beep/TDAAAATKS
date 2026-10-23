import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { ActivityLog, User, STATUS_LABELS } from '../../types';
import { Avatar } from '../common/Avatar';
import { ScrollText, Search, X, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 100; // must match the limit in GET /api/activity

const FIELD_LABELS: Record<string, string> = {
  title: 'Titre',
  name: 'Nom',
  description: 'Description',
  content: 'Contenu',
  status: 'Statut',
  priority: 'Priorité',
  assignee_id: 'Assigné à',
  start_at: 'Début',
  end_at: 'Fin',
  stopped_at: 'Arrêt du chrono',
  estimated_minutes: 'Estimation (min)',
  tag_ids: 'Tags',
  color: 'Couleur',
  photo_url: 'Photo',
  avatar_url: 'Photo',
  link: 'Lien',
  role: 'Rôle',
  completed: 'Terminée',
  email: 'Email',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export const ActivityLogView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(err => console.error(err));
  }, []);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    try {
      const page = await api.getActivityLogs({ q: search, userId, offset });
      setLogs(prev => (offset ? [...prev, ...page] : page));
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load activity log:', err);
    } finally {
      setLoading(false);
    }
  }, [search, userId]);

  useEffect(() => {
    const timer = setTimeout(() => load(0), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load]);

  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'status') return STATUS_LABELS[String(value)] || String(value);
    if (field === 'assignee_id') return users.find(u => u.id === value)?.name || String(value);
    if (field.endsWith('_at') && typeof value === 'string' && !isNaN(Date.parse(value))) return formatDate(value);
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    if (Array.isArray(value)) return value.join(', ') || '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-1">
          <ScrollText className="w-3.5 h-3.5" />
          <span>Administration</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">Historique d'activité</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Toutes les actions effectuées sur la plateforme : qui, quoi, quand, et les valeurs avant / après.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une action, une tâche, un utilisateur..."
            className="w-full pl-8 pr-8 py-1.5 rounded bg-[#0F172A] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={userId}
          onChange={e => setUserId(e.target.value)}
          className="sm:w-56 px-2 py-1.5 rounded bg-[#0F172A] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      {/* Log list */}
      <div className="rounded border border-[#1E293B] bg-[#0B1120] divide-y divide-[#1E293B]">
        {logs.length === 0 && !loading && (
          <div className="p-8 text-center text-xs text-slate-500">Aucune activité enregistrée.</div>
        )}
        {logs.map(log => {
          const changes = log.details?.changes || {};
          const before = log.details?.before || {};
          const fields = Object.keys(changes);
          const isOpen = expandedId === log.id;
          const author = users.find(u => u.id === log.user_id);
          return (
            <div key={log.id}>
              <button
                onClick={() => setExpandedId(isOpen ? null : log.id)}
                disabled={fields.length === 0}
                className="w-full p-3 flex items-center gap-3 text-left hover:bg-[#0F172A] transition-colors disabled:cursor-default"
              >
                <Avatar user={author} name={log.user_name || 'Système'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">
                    <span className="font-bold">{log.user_name || 'Système'}</span>
                    <span className="text-slate-400"> · {log.action}</span>
                    {log.entity_label && <span className="text-[#60A5FA]"> « {log.entity_label} »</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{formatDate(log.created_at)}</div>
                </div>
                {fields.length > 0 && (
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isOpen && (
                <div className="px-3 pb-3 pl-13">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 text-left">
                        <th className="py-1 pr-3 font-semibold">Champ</th>
                        {Object.keys(before).length > 0 && <th className="py-1 pr-3 font-semibold">Avant</th>}
                        <th className="py-1 font-semibold">Après</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(f => (
                        <tr key={f} className="border-t border-[#1E293B] align-top">
                          <td className="py-1 pr-3 text-slate-400">{FIELD_LABELS[f] || f}</td>
                          {Object.keys(before).length > 0 && (
                            <td className="py-1 pr-3 text-rose-300/80 break-words">{formatValue(f, before[f])}</td>
                          )}
                          <td className="py-1 text-emerald-300/90 break-words">
                            {f === 'tag_ids' ? `${(changes[f] as unknown[] | undefined)?.length ?? 0} tag(s)` : formatValue(f, changes[f])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {loading && <div className="p-4 text-center text-xs text-slate-500">Chargement...</div>}
      </div>

      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={() => load(logs.length)}
            className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] hover:text-slate-100 transition-colors"
          >
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
};
