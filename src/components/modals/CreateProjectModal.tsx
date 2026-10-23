import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { FolderGit2, X, Plus } from 'lucide-react';
import { CalendarPicker } from '../common/CalendarPicker';
import { combineDateAndTime } from '../../lib/datetime';

export const CreateProjectModal: React.FC = () => {
  const { notify } = useToast();
  const {
    isCreateProjectModalOpen,
    setIsCreateProjectModalOpen,
    currentWorkspace,
    setCurrentProjectId,
    bumpProjectVersion
  } = useWorkspace();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isCreateProjectModalOpen || !currentWorkspace) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Veuillez renseigner le nom du projet.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const newProject = await api.createProject(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        link: link.trim() || undefined,
        start_at: combineDateAndTime(startDate, startTime),
        end_at: combineDateAndTime(endDate, endTime),
      });

      setIsCreateProjectModalOpen(false);
      setCurrentProjectId(newProject.id);
      bumpProjectVersion();
      notify({
        type: 'success',
        title: 'Projet créé',
        message: `Le projet « ${newProject.name} » a été initialisé.`,
      });
      setName('');
      setDescription('');
      setLink('');
      setStartDate('');
      setEndDate('');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du projet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-mono">
      <div className="w-full max-w-md bg-[#0F172A] border border-[#1E293B] rounded shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA]">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Nouveau Projet</h3>
              <p className="text-[10px] text-slate-400">Workspace: {currentWorkspace.name}</p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateProjectModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Nom du projet *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Refonte Dashboard, Campagne Q3..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Objectifs et cadre du projet..."
              className="w-full p-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Lien du projet (facultatif)
            </label>
            <input
              type="text"
              inputMode="url"
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
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
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Fin (date et heure)
              </label>
              <div className="space-y-1.5">
                <CalendarPicker value={endDate} onChange={setEndDate} placeholder="Date de fin" />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={() => setIsCreateProjectModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
            >
              {submitting ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
