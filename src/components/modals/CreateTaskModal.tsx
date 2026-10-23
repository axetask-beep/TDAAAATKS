import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { Project, User, Tag, TaskPriority, TaskStatus } from '../../types';
import { X, Plus, Tag as TagIcon, Check } from 'lucide-react';
import { CalendarPicker } from '../common/CalendarPicker';
import { combineDateAndTime } from '../../lib/datetime';

export const CreateTaskModal: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const {
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    currentWorkspace,
    currentProject,
    setSelectedTaskId,
    bumpTaskVersion
  } = useWorkspace();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('a_faire');
  const [priority, setPriority] = useState<TaskPriority>('normale');
  const [projectId, setProjectId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isCreateTaskModalOpen && currentWorkspace) {
      setTitle('');
      setDescription('');
      setStatus('a_faire');
      setPriority('normale');
      setProjectId(currentProject?.id || '');
      setAssigneeId(user?.id || '');
      setStartDate(new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndDate('');
      setEndTime('18:00');
      setSelectedTagIds([]);
      setError('');

      // Fetch workspace projects, tags, and every platform user for the
      // assignee list — assigning someone new auto-grants them workspace
      // access server-side (see ensureWorkspaceMembership).
      Promise.all([
        api.getWorkspaceProjects(currentWorkspace.id),
        api.getUsers(),
        api.getWorkspaceTags(currentWorkspace.id),
      ]).then(([prjs, allUsers, tgs]) => {
        setProjects(prjs);
        setMembers(allUsers);
        setTags(tgs);
        if (!currentProject && prjs.length > 0) {
          setProjectId(prjs[0].id);
        }
      }).catch(console.error);
    }
  }, [isCreateTaskModalOpen, currentWorkspace?.id, currentProject?.id]);

  if (!isCreateTaskModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Veuillez spécifier un titre pour la tâche.');
      return;
    }
    if (!projectId) {
      setError('Veuillez sélectionner un projet.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const newTask = await api.createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assignee_id: assigneeId || undefined,
        start_at: combineDateAndTime(startDate, startTime),
        end_at: combineDateAndTime(endDate, endTime),
        tag_ids: selectedTagIds,
      });

      setIsCreateTaskModalOpen(false);
      setSelectedTaskId(newTask.id);
      bumpTaskVersion();
      notify({
        type: 'success',
        title: 'Tâche créée avec succès',
        message: `« ${newTask.title} » a été ajoutée au projet.`,
      });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de la tâche.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-mono">
      <div className="w-full max-w-xl bg-[#0F172A] border border-[#1E293B] rounded shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Nouvelle Tâche</h3>
              <p className="text-[10px] text-slate-400">Workspace: {currentWorkspace?.name}</p>
            </div>
          </div>

          <button
            onClick={() => setIsCreateTaskModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Project & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Projet *
              </label>
              <select
                required
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Assigner à
              </label>
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
              >
                <option value="">Non assigné</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} {m.id === user?.id ? '(Moi)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Titre de la tâche *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Rédiger la roadmap Q3, Intégrer l'API Stripe..."
              className="w-full px-3 py-2 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Description / Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Spécifications, contexte, liens utiles..."
              className="w-full p-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 leading-relaxed"
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="w-full px-2 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
              >
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="en_revision">En révision</option>
                <option value="termine">Terminé</option>
                <option value="bloque">Bloqué</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Priorité
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
              >
                <option value="basse">Basse</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Start / End date & time */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <TagIcon className="w-3 h-3 text-[#3B82F6]" />
                <span>Tags associés</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`text-xs px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'ring-1 ring-[#2563EB] shadow-sm'
                          : 'opacity-50 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: `${tag.color}15`,
                        color: tag.color,
                        border: `1px solid ${tag.color}45`,
                      }}
                    >
                      <span>{tag.name}</span>
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-[#1E293B]">
            <button
              type="button"
              onClick={() => setIsCreateTaskModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
            >
              {submitting ? 'Création...' : 'Créer la tâche'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
