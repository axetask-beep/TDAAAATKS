import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { api } from '../../lib/api';
import { downloadDataUrl } from '../../lib/file';
import { DocumentItem, DocumentFacets, STATUS_LABELS } from '../../types';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { StatusBadge } from '../common/Badge';
import { formatSize, range, input } from '../reports/ReportsView';
import { FolderOpen, Download, Trash2, Search, X, FileText, FileSpreadsheet, Presentation, Image, Film, Archive, File } from 'lucide-react';

export const DOC_CATEGORIES: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  pdf: { label: 'PDF', icon: FileText, color: 'text-rose-400' },
  texte: { label: 'Texte / Word', icon: FileText, color: 'text-sky-400' },
  tableur: { label: 'Tableur / Excel', icon: FileSpreadsheet, color: 'text-emerald-400' },
  presentation: { label: 'Présentation', icon: Presentation, color: 'text-orange-400' },
  image: { label: 'Image', icon: Image, color: 'text-violet-400' },
  media: { label: 'Audio / Vidéo', icon: Film, color: 'text-pink-400' },
  archive: { label: 'Archive (zip…)', icon: Archive, color: 'text-amber-400' },
  autre: { label: 'Autre', icon: File, color: 'text-slate-400' },
};

const PAGE = 50;
const EMPTY = { q: '', uploader: '', category: '', workspace: '', project: '', status: '', from: '', to: '', sort: 'recent' };

export const DocumentsView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const { setSelectedTaskId } = useWorkspace();
  const { confirmProps, confirm } = useConfirm();
  const isAdmin = user?.role === 'admin';
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [facets, setFacets] = useState<DocumentFacets>({ uploaders: [], workspaces: [], projects: [] });
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState(''); // typed text, applied after a short pause
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const set = (patch: Partial<typeof EMPTY>) => setFilters(f => ({ ...f, ...patch }));
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY);
  const projects = facets.projects.filter(p => !filters.workspace || p.workspace_id === filters.workspace);

  useEffect(() => {
    const id = setTimeout(() => set({ q: query.trim() }), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = (offset = 0) => {
    setLoading(true);
    return api.getDocuments({ ...filters, limit: PAGE, offset })
      .then(rows => {
        setDocs(prev => (offset ? [...prev, ...rows] : rows));
        setHasMore(rows.length === PAGE);
      })
      .catch(err => notify({ type: 'error', title: 'Documents indisponibles', message: err.message, sound: false }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filters]);
  useEffect(() => { api.getDocumentFacets().then(setFacets).catch(() => {}); }, []);

  const onDownload = (d: DocumentItem) =>
    api.getAttachmentFile(d.file_url)
      .then(f => downloadDataUrl(f.data_url, f.file_name))
      .catch(err => notify({ type: 'error', title: 'Téléchargement impossible', message: err.message, sound: false }));

  const onDelete = async (d: DocumentItem) => {
    const ok = await confirm({ title: 'Supprimer le document', message: `Supprimer « ${d.file_name} » de la tâche « ${d.task_title} » ?`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    await api.deleteAttachment(d.id).catch(() => {});
    load();
  };

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-4 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />

      <div>
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-[#60A5FA]" /> Documents
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {isAdmin ? "Tous les fichiers importés sur les tâches, par toute l'équipe." : 'Les fichiers que tu as importés sur les tâches.'}
        </p>
      </div>

      {/* Filters */}
      <div className="p-3 rounded-lg bg-[#0F172A] border border-[#1E293B] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un nom de fichier, une tâche ou un projet…"
            className={`${input} w-full pl-8`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select aria-label="Importé par" value={filters.uploader} onChange={e => set({ uploader: e.target.value })} className={input}>
              <option value="">Toutes les personnes</option>
              {facets.uploaders.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select aria-label="Type de document" value={filters.category} onChange={e => set({ category: e.target.value })} className={input}>
            <option value="">Tous les types</option>
            {Object.entries(DOC_CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
          <select aria-label="Espace de travail" value={filters.workspace} onChange={e => set({ workspace: e.target.value, project: '' })} className={input}>
            <option value="">Tous les espaces</option>
            {facets.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select aria-label="Projet" value={filters.project} onChange={e => set({ project: e.target.value })} className={input}>
            <option value="">Tous les projets</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select aria-label="Statut de la tâche" value={filters.status} onChange={e => set({ status: e.target.value })} className={input}>
            <option value="">Tous les statuts de tâche</option>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Période" value="" onChange={e => set(range(e.target.value))} className={input}>
            <option value="">Période rapide…</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
          </select>
          <label className="flex items-center gap-1 text-[10px] text-slate-400">
            Du <input type="date" value={filters.from} max={filters.to || undefined} onChange={e => set({ from: e.target.value })} className={input} />
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-400">
            au <input type="date" value={filters.to} min={filters.from || undefined} onChange={e => set({ to: e.target.value })} className={input} />
          </label>
          <select aria-label="Tri" value={filters.sort} onChange={e => set({ sort: e.target.value })} className={input}>
            <option value="recent">Plus récents</option>
            <option value="oldest">Plus anciens</option>
            <option value="name">Nom (A→Z)</option>
            <option value="size">Plus lourds</option>
            <option value="task">Tâche (A→Z)</option>
            {isAdmin && <option value="uploader">Personne (A→Z)</option>}
          </select>
          {active && (
            <button onClick={() => { setFilters(EMPTY); setQuery(''); }} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white">
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading && !docs.length ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : docs.length === 0 ? (
        <p className="p-6 rounded-lg border border-dashed border-[#1E293B] text-center text-xs text-slate-500">
          {active ? 'Aucun document ne correspond à ces filtres.' : "Aucun document pour l'instant. Importe des fichiers depuis l'onglet Fichiers d'une tâche."}
        </p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => {
            const cat = DOC_CATEGORIES[d.category] || DOC_CATEGORIES.autre;
            const Icon = cat.icon;
            return (
              <li key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F172A] border border-[#1E293B]">
                <Icon className={`w-4 h-4 shrink-0 ${cat.color}`} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => onDownload(d)} className="text-left text-xs font-semibold text-slate-100 break-all hover:text-[#60A5FA]">
                    {d.file_name}
                  </button>
                  <p className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5">
                    <button onClick={() => setSelectedTaskId(d.task_id)} title="Ouvrir la tâche" className="text-slate-300 hover:text-[#60A5FA] underline-offset-2 hover:underline">
                      {d.task_title}
                    </button>
                    <StatusBadge status={d.task_status} />
                    <span>· {d.workspace_name} / {d.project_name}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isAdmin && `${d.uploader_name} · `}
                    {new Date(d.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                    {d.file_size ? ` · ${formatSize(d.file_size)}` : ''} · {cat.label}
                  </p>
                </div>
                <button onClick={() => onDownload(d)} title="Télécharger" className="p-1.5 rounded text-slate-300 hover:bg-[#1E293B] hover:text-white">
                  <Download className="w-4 h-4" />
                </button>
                {(isAdmin || d.uploader_id === user?.id) && (
                  <button onClick={() => onDelete(d)} title="Supprimer" className="p-1.5 rounded text-slate-400 hover:bg-rose-500/10 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <button onClick={() => load(docs.length)} disabled={loading} className="w-full py-2 rounded border border-[#1E293B] text-xs text-slate-300 hover:border-[#334155]">
          {loading ? 'Chargement…' : 'Charger plus'}
        </button>
      )}
    </div>
  );
};
