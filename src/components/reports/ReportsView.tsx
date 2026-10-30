import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { readFileAsDataUrl } from '../../lib/file';
import { Report } from '../../types';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { FileText, Upload, Download, Trash2 } from 'lucide-react';

// The request goes through Vercel (4.5 Mo max, base64 adds a third), so 3 Mo per file.
const MAX_BYTES = 3 * 1024 * 1024;

function formatSize(bytes?: number | null) {
  if (!bytes) return '';
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export const ReportsView: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const { confirmProps, confirm } = useConfirm();
  const isAdmin = user?.role === 'admin';
  const inputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = () => api.getReports().then(setReports).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const file_data = await readFileAsDataUrl(file, MAX_BYTES);
      await api.uploadReport({ file_name: file.name, file_data, file_size: file.size, file_type: file.type || undefined });
      notify({ type: 'success', title: 'Rapport importé', message: file.name, sound: false });
      load();
    } catch (err: any) {
      notify({ type: 'error', title: "Échec de l'import", message: err.message, sound: false });
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (r: Report) => {
    try {
      const { file_name, file_data } = await api.getReportFile(r.id);
      const a = document.createElement('a');
      a.href = file_data;
      a.download = file_name;
      a.click();
    } catch (err: any) {
      notify({ type: 'error', title: 'Téléchargement impossible', message: err.message, sound: false });
    }
  };

  const onDelete = async (r: Report) => {
    const ok = await confirm({ title: 'Supprimer le rapport', message: `Supprimer « ${r.file_name} » ?`, confirmLabel: 'Supprimer', variant: 'danger' });
    if (!ok) return;
    await api.deleteReport(r.id).catch(() => {});
    load();
  };

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#60A5FA]" /> Rapports
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? 'Les rapports importés par toute l\'équipe.' : 'Importe tes rapports (Word, Excel, PDF…), 3 Mo max par fichier.'}
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Import…' : 'Importer un rapport'}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          accept=".doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.pdf,.odt,.ods,.odp,.txt"
          onChange={onFile}
        />
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Chargement…</p>
      ) : reports.length === 0 ? (
        <p className="p-6 rounded-lg border border-dashed border-[#1E293B] text-center text-xs text-slate-500">Aucun rapport pour l'instant.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map(r => (
            <li key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0F172A] border border-[#1E293B]">
              <FileText className="w-4 h-4 text-[#60A5FA] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 break-words">{r.file_name}</p>
                <p className="text-[10px] text-slate-500">
                  {isAdmin && `${r.author.name} · `}
                  {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.file_size ? ` · ${formatSize(r.file_size)}` : ''}
                </p>
              </div>
              <button onClick={() => onDownload(r)} title="Télécharger" className="p-1.5 rounded text-slate-300 hover:bg-[#1E293B] hover:text-white">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(r)} title="Supprimer" className="p-1.5 rounded text-slate-400 hover:bg-rose-500/10 hover:text-rose-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
