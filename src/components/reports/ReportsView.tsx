import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { readFileAsDataUrl, downloadDataUrl, MAX_UPLOAD_BYTES } from '../../lib/file';
import { Report, ReportKind } from '../../types';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { FileText, Upload, Download, Trash2, Search, X, Mic, Shield } from 'lucide-react';
import { MeetingRecorder } from './MeetingRecorder';
import { SummaryModal } from './MeetingSummary';

export const REPORT_KINDS: Record<ReportKind, string> = {
  journalier: 'Journalier',
  hebdomadaire: 'Hebdomadaire',
  mensuel: 'Mensuel',
  mission: 'Mission / Projet',
  reunion: 'Réunion',
  autre: 'Autre',
};

const PAGE = 50;

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const day = (d: Date) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time

// Quick date ranges for the filter.
function range(preset: string): { from?: string; to?: string } {
  const now = new Date();
  if (preset === 'today') return { from: day(now), to: day(now) };
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: day(monday), to: day(now) };
  }
  if (preset === 'month') return { from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) };
  return {};
}

const EMPTY = { q: '', author: '', kind: '', from: '', to: '', sort: 'recent' };

const input = 'px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:border-[#2563EB] outline-none';

export const ReportsView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const { confirmProps, confirm } = useConfirm();
  const isAdmin = user?.role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string }[]>([]);
  const [filters, setFilters] = useState(EMPTY);
  const [query, setQuery] = useState(''); // typed text, applied after a short pause
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [pending, setPending] = useState<{ file: File; title: string; kind: ReportKind } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [summaryId, setSummaryId] = useState<string | null>(null);

  const set = (patch: Partial<typeof EMPTY>) => setFilters(f => ({ ...f, ...patch }));
  const active = JSON.stringify(filters) !== JSON.stringify(EMPTY);

  useEffect(() => {
    const id = setTimeout(() => set({ q: query.trim() }), 300);
    return () => clearTimeout(id);
  }, [query]);

  const load = (offset = 0) => {
    setLoading(true);
    return api.getReports({ ...filters, limit: PAGE, offset })
      .then(rows => {
        setReports(prev => (offset ? [...prev, ...rows] : rows));
        setHasMore(rows.length === PAGE);
      })
      .catch(err => notify({ type: 'error', title: 'Rapports indisponibles', message: err.message, sound: false }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [filters]);
  useEffect(() => { api.getReportAuthors().then(setAuthors).catch(() => {}); }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      notify({ type: 'error', title: "Échec de l'import", message: 'Fichier trop volumineux (max 3 Mo).', sound: false });
      return;
    }
    setPending({ file, title: file.name.replace(/\.[a-z0-9]{2,5}$/i, ''), kind: 'hebdomadaire' });
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    const { file, title, kind } = pending;
    setUploading(true);
    try {
      const file_data = await readFileAsDataUrl(file, MAX_UPLOAD_BYTES);
      await api.uploadReport({ file_name: file.name, file_data, file_size: file.size, file_type: file.type || undefined, title: title.trim(), kind });
      notify({ type: 'success', title: 'Rapport importé', message: title, sound: false });
      setPending(null);
      load();
      api.getReportAuthors().then(setAuthors).catch(() => {});
    } catch (err: any) {
      notify({ type: 'error', title: "Échec de l'import", message: err.message, sound: false });
    } finally {
      setUploading(false);
    }
  };

  const onOpen = async (r: Report) => {
    if (!r.has_file) return setSummaryId(r.id);
    try {
      const { file_name, file_data } = await api.getReportFile(r.id);
      if (file_data) await downloadDataUrl(file_data, file_name);
    } catch (err: any) {
      notify({ type: 'error', title: 'Téléchargement impossible', message: err.message, sound: false });
    }
  };

  const onDelete = async (r: Report) => {
    const ok = await confirm({ title: 'Supprimer le rapport', message: `Supprimer « ${r.title} » ?`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    await api.deleteReport(r.id).catch(() => {});
    load();
  };

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-4 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />
      {recording && (
        <MeetingRecorder
          onClose={() => setRecording(false)}
          onSaved={() => { setRecording(false); notify({ type: 'success', title: 'Compte rendu publié', sound: false }); load(); }}
        />
      )}
      {summaryId && <SummaryModal id={summaryId} onClose={() => setSummaryId(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#60A5FA]" /> Rapports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? "Les rapports de toute l'équipe." : 'Tes rapports, ceux des admins et tous les comptes rendus de réunion. Word, Excel, PDF…, 3 Mo max.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {typeof navigator !== 'undefined' && navigator.mediaDevices && (
            <button
              onClick={() => setRecording(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 whitespace-nowrap text-white font-bold text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
            >
              <Mic className="w-3.5 h-3.5" /> Enregistrer une réunion
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" /> Importer un rapport
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.pdf,.odt,.ods,.odp,.txt"
          onChange={onFile}
        />
      </div>

      {pending && (
        <form onSubmit={upload} className="p-3 rounded-lg bg-[#0F172A] border border-[#2563EB]/50 flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-48 space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">Titre</span>
            <input autoFocus required value={pending.title} onChange={e => setPending({ ...pending, title: e.target.value })} className={`${input} w-full`} />
          </label>
          <label className="space-y-1">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">Type</span>
            <select value={pending.kind} onChange={e => setPending({ ...pending, kind: e.target.value as ReportKind })} className={input}>
              {Object.entries(REPORT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <span className="text-[10px] text-slate-500 self-center">{pending.file.name} · {formatSize(pending.file.size)}</span>
          <button type="submit" disabled={uploading} className="px-3 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-bold text-xs">
            {uploading ? 'Import…' : 'Importer'}
          </button>
          <button type="button" onClick={() => setPending(null)} className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white">Annuler</button>
        </form>
      )}

      {/* Filters */}
      <div className="p-3 rounded-lg bg-[#0F172A] border border-[#1E293B] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un titre, un fichier ou un mot du contenu…"
            className={`${input} w-full pl-8`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Auteur" value={filters.author} onChange={e => set({ author: e.target.value })} className={input}>
            <option value="">Tous les auteurs</option>
            {authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Type" value={filters.kind} onChange={e => set({ kind: e.target.value })} className={input}>
            <option value="">Tous les types</option>
            {Object.entries(REPORT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
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
            <option value="title">Titre (A→Z)</option>
            <option value="author">Auteur (A→Z)</option>
          </select>
          {active && (
            <button onClick={() => { setFilters(EMPTY); setQuery(''); }} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white">
              <X className="w-3 h-3" /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {loading && !reports.length ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : reports.length === 0 ? (
        <p className="p-6 rounded-lg border border-dashed border-[#1E293B] text-center text-xs text-slate-500">
          {active ? 'Aucun rapport ne correspond à ces filtres.' : "Aucun rapport pour l'instant."}
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map(r => (
            <li key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F172A] border border-[#1E293B]">
              {r.kind === 'reunion' ? <Mic className="w-4 h-4 text-rose-400 shrink-0" /> : <FileText className="w-4 h-4 text-[#60A5FA] shrink-0" />}
              <button onClick={() => onOpen(r)} className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold text-slate-100 break-words flex flex-wrap items-center gap-1.5">
                  {r.title}
                  {r.kind && <span className="px-1.5 py-0.5 rounded bg-[#1E293B] text-[9px] uppercase tracking-wider text-slate-300">{REPORT_KINDS[r.kind]}</span>}
                </p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  {r.author.role === 'admin' && <Shield className="w-3 h-3 text-amber-400" aria-label="Admin" />}
                  {r.author.name} · {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.file_size ? ` · ${formatSize(r.file_size)}` : ''}
                </p>
              </button>
              <button onClick={() => onOpen(r)} title={r.has_file ? 'Télécharger' : 'Lire le résumé'} className="p-1.5 rounded text-slate-300 hover:bg-[#1E293B] hover:text-white">
                {r.has_file ? <Download className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </button>
              {(isAdmin || r.author.id === user?.id) && (
                <button onClick={() => onDelete(r)} title="Supprimer" className="p-1.5 rounded text-slate-400 hover:bg-rose-500/10 hover:text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button onClick={() => load(reports.length)} disabled={loading} className="w-full py-2 rounded border border-[#1E293B] text-xs text-slate-300 hover:border-[#334155]">
          {loading ? 'Chargement…' : 'Charger plus'}
        </button>
      )}
    </div>
  );
};
