import React, { useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';
import { combineDateAndTime, splitISOToDateAndTime, isEndBeforeStart, DATE_ORDER_ERROR } from '../../lib/datetime';
import { CalendarPicker } from './CalendarPicker';

const PRESET_COLORS = [
  '#2563EB', '#3B82F6', '#60A5FA', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

/* ─────────────────────────────────────────────
   EditWorkspaceModal
───────────────────────────────────────────── */
interface EditWorkspaceModalProps {
  isOpen: boolean;
  initialName: string;
  initialColor: string;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  onClose: () => void;
}

export const EditWorkspaceModal: React.FC<EditWorkspaceModalProps> = ({
  isOpen,
  initialName,
  initialColor,
  onSave,
  onClose,
}) => {
  const [name, setName] = React.useState(initialName);
  const [color, setColor] = React.useState(initialColor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setColor(initialColor);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialName, initialColor]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSave({ name: name.trim(), color });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0B1120] border border-[#1E293B] rounded-lg shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-150 font-mono"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Modifier l'espace de travail</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Nom et couleur thématique</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-[#1E293B] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nom de l'espace
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Produit, Marketing, Dev..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Couleur thématique
            </label>
            <div className="flex flex-wrap gap-2 p-2 rounded bg-[#090D16] border border-[#1E293B]">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded transition-all ${color === c ? 'ring-2 ring-white/60 ring-offset-1 ring-offset-[#090D16] scale-110' : 'opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {/* Preview */}
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>Aperçu : <span className="font-bold" style={{ color }}>{name || 'Nom...'}</span></span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   EditProjectModal
───────────────────────────────────────────── */
interface EditProjectModalProps {
  isOpen: boolean;
  initialName: string;
  initialDescription: string;
  initialStartAt: string | null;
  initialEndAt: string | null;
  initialStatus: 'active' | 'archived' | 'planned' | 'completed';
  initialLink?: string | null;
  onSave: (data: { name: string; description: string; start_at?: string; end_at?: string; status: string; link: string | null }) => Promise<void>;
  onClose: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  initialName,
  initialDescription,
  initialStartAt,
  initialEndAt,
  initialStatus,
  initialLink,
  onSave,
  onClose,
}) => {
  const [name, setName] = React.useState(initialName);
  const [description, setDescription] = React.useState(initialDescription);
  const initialStart = splitISOToDateAndTime(initialStartAt);
  const initialEnd = splitISOToDateAndTime(initialEndAt);
  const [startDate, setStartDate] = React.useState(initialStart.date);
  const [startTime, setStartTime] = React.useState(initialStart.time || '09:00');
  const [endDate, setEndDate] = React.useState(initialEnd.date);
  const [endTime, setEndTime] = React.useState(initialEnd.time || '18:00');
  const [status, setStatus] = React.useState(initialStatus);
  const [link, setLink] = React.useState(initialLink || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      const s = splitISOToDateAndTime(initialStartAt);
      const en = splitISOToDateAndTime(initialEndAt);
      setStartDate(s.date);
      setStartTime(s.time || '09:00');
      setEndDate(en.date);
      setEndTime(en.time || '18:00');
      setStatus(initialStatus);
      setLink(initialLink || '');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialName, initialDescription, initialStartAt, initialEndAt, initialStatus, initialLink]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (isEndBeforeStart(startDate, startTime, endDate, endTime)) {
      setError(DATE_ORDER_ERROR);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        start_at: combineDateAndTime(startDate, startTime),
        end_at: combineDateAndTime(endDate, endTime),
        status,
        link: link.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#0B1120] border border-[#1E293B] rounded-lg shadow-2xl shadow-black/60 animate-in zoom-in-95 duration-150 font-mono"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">Modifier le projet</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Nom, description, lien, statut et échéance</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-[#1E293B] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Nom du projet *
            </label>
            <input
              ref={inputRef}
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Refonte v2, Sprint Q3..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Objectifs, périmètre, notes..."
              rows={3}
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 leading-relaxed resize-none transition-colors"
            />
          </div>

          {/* Link */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Lien du projet
            </label>
            <input
              type="text"
              inputMode="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 transition-colors"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Statut
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-2.5 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer transition-colors"
            >
              <option value="planned">Planifié</option>
              <option value="active">Actif</option>
              <option value="completed">Terminé</option>
              <option value="archived">Archivé</option>
            </select>
          </div>

          {/* Start / End date & time — chrono schedule (admin only) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Début (date et heure)
              </label>
              <div className="space-y-1.5">
                <CalendarPicker value={startDate} onChange={setStartDate} placeholder="Date de début" />
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Fin (date et heure)
              </label>
              <div className="space-y-1.5">
                <CalendarPicker value={endDate} onChange={setEndDate} placeholder="Date de fin" min={startDate} />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
