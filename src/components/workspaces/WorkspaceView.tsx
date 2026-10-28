import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { resizeImageToDataUrl } from '../../lib/image';
import { Project, WorkspaceMember } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { EditWorkspaceModal } from '../common/EditModal';
import { 
  FolderGit2,
  Plus,
  Users,
  Calendar,
  Clock,
  ArrowRight, 
  CheckCircle2, 
  Briefcase, 
  Settings, 
  Sparkles,
  ArrowLeft,
  Trash2,
  Edit2
} from 'lucide-react';

interface WorkspaceViewProps {
  onSelectProject: (projectId: string) => void;
  onOpenSettings: () => void;
  onBackToWorkspaces: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  onSelectProject,
  onOpenSettings,
  onBackToWorkspaces,
}) => {
  const { user } = useAuth();
  const {
    currentWorkspace,
    setCurrentProjectId,
    setIsCreateProjectModalOpen,
    refreshWorkspaces,
    taskVersion,
    projectVersion,
    bumpProjectVersion
  } = useWorkspace();
  const { confirmProps, confirm } = useConfirm();

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const isWorkspaceAdmin = user?.role === 'admin' || currentWorkspace?.my_role === 'admin';

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentWorkspace) return;
    const ok = await confirm({
      title: 'Photo de l\'espace',
      message: `Remplacer la photo de l'espace par "${file.name}" ?`,
      confirmLabel: 'Valider',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      setIsUploadingPhoto(true);
      const dataUrl = await resizeImageToDataUrl(file, 500, 0.85);
      await api.updateWorkspace(currentWorkspace.id, { photo_url: dataUrl });
      await refreshWorkspaces();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoading(true);
      const [prjs, mems] = await Promise.all([
        api.getWorkspaceProjects(currentWorkspace.id),
        api.getWorkspaceMembers(currentWorkspace.id),
      ]);
      setProjects(prjs);
      setMembers(mems);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    const ok = await confirm({
      title: `Supprimer l'espace "${currentWorkspace.name}"`,
      message: `Cette action est DÉFINITIVE.\n\nTous les projets, tâches et données associés à cet espace seront détruits définitivement.`,
      confirmLabel: 'Supprimer définitivement',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteWorkspace(currentWorkspace.id);
      await refreshWorkspaces();
      onBackToWorkspaces();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de l'espace.");
    }
  };

  const handleSaveWorkspace = async (data: { name: string; color: string }) => {
    if (!currentWorkspace) return;
    await api.updateWorkspace(currentWorkspace.id, { name: data.name, color: data.color });
    await refreshWorkspaces();
    await loadData();
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace?.id, taskVersion, projectVersion]);

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Supprimer le projet',
      message: 'Voulez-vous vraiment supprimer ce projet ?\n\nToutes les tâches associées seront supprimées définitivement.',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteProject(projectId);
      bumpProjectVersion();
    } catch (err) {
      console.error(err);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-12 text-center text-slate-400">
        Aucun espace de travail sélectionné.
      </div>
    );
  }

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />
      {currentWorkspace && (
        <EditWorkspaceModal
          isOpen={isEditModalOpen}
          initialName={currentWorkspace.name}
          initialColor={currentWorkspace.color}
          onSave={handleSaveWorkspace}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
      {/* Back button & Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <button
          onClick={onBackToWorkspaces}
          className="flex items-center gap-1 text-slate-400 hover:text-[#60A5FA] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Tous les espaces</span>
        </button>
        <span>/</span>
        <span className="text-slate-200">{currentWorkspace.name}</span>
      </div>

      {/* Header Banner */}
      <div className="p-5 rounded bg-[#0B1120] border border-[#1E293B] shadow-xl relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-80 h-80 opacity-5 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: currentWorkspace.color }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-3.5">
            {isWorkspaceAdmin ? (
              <label
                className="relative w-16 h-16 rounded-lg flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0 cursor-pointer group"
                style={{ backgroundColor: `${currentWorkspace.color}20`, border: `1px solid ${currentWorkspace.color}50` }}
                title="Modifier la photo de l'espace"
              >
                {currentWorkspace.photo_url ? (
                  <img src={currentWorkspace.photo_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
                ) : (
                  <Briefcase className="w-7 h-7" style={{ color: currentWorkspace.color }} />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[9px] font-bold text-white uppercase">
                    {isUploadingPhoto ? '...' : 'Modifier'}
                  </span>
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isUploadingPhoto} className="hidden" />
              </label>
            ) : (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0"
                style={{ backgroundColor: `${currentWorkspace.color}20`, border: `1px solid ${currentWorkspace.color}50` }}
              >
                {currentWorkspace.photo_url ? (
                  <img src={currentWorkspace.photo_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
                ) : (
                  <Briefcase className="w-7 h-7" style={{ color: currentWorkspace.color }} />
                )}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
                  {currentWorkspace.name}
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40">
                  {currentWorkspace.my_role === 'admin' ? 'Admin' : 'Membre'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Espace dédié à la gestion des projets, des membres et des sprints.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            {isWorkspaceAdmin && (
              <>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-slate-300 hover:text-slate-100 border border-[#1E293B] hover:border-[#334155] text-xs font-bold transition-all shadow-sm"
                  title="Modifier l'espace"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modifier</span>
                </button>

                <button
                  onClick={handleDeleteWorkspace}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 hover:border-rose-500 text-xs font-bold transition-all shadow-sm"
                  title="Supprimer l'espace"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Supprimer</span>
                </button>
              </>
            )}

            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] hover:bg-[#0F172A] text-xs font-semibold text-slate-300 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Gérer les membres ({members.length})</span>
              <span className="sm:hidden">{members.length}</span>
            </button>

            {isWorkspaceAdmin && (
              <button
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Nouveau projet</span>
              </button>
            )}
          </div>
        </div>

        {/* Member Avatars Row */}
        <div className="mt-5 pt-3.5 border-t border-[#1E293B] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300 text-[11px]">Équipe active :</span>
            <div className="flex -space-x-1 overflow-hidden">
              {members.map(m => (
                <Avatar
                  key={m.id}
                  user={m.user}
                  size="xs"
                  showTooltip
                  className="ring-1 ring-[#0B1120]"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="font-bold text-slate-200 text-[11px]">
              {projects.length} projet{projects.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Projects Grid Section */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Projets en cours</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {projects.map(prj => {
            const totalTasks = prj.tasks_count || 0;
            const completed = prj.completed_tasks_count || 0;
            const progress = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

            return (
              <div
                key={prj.id}
                onClick={() => {
                  setCurrentProjectId(prj.id);
                  onSelectProject(prj.id);
                }}
                className="p-4 rounded bg-[#0F172A] border border-[#1E293B] hover:border-[#2563EB]/50 transition-all cursor-pointer group flex flex-col justify-between hover:shadow-xl hover:shadow-black/70"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-bold break-words min-w-0 text-slate-100 group-hover:text-[#60A5FA] transition-colors">
                      {prj.name}
                    </h3>
                    {isWorkspaceAdmin && (
                      <button
                        onClick={(e) => handleDeleteProject(prj.id, e)}
                        title="Supprimer le projet"
                        className="p-1 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {prj.description && (
                    <p className="text-xs text-slate-400 break-words whitespace-pre-wrap mb-3 leading-relaxed">
                      {prj.description}
                    </p>
                  )}

                  {/* Progress */}
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400 uppercase">Tâches terminées</span>
                      <span className="font-mono font-bold text-[#60A5FA] text-[11px]">{completed}/{totalTasks} ({progress}%)</span>
                    </div>
                    <div className="w-full h-1.5 rounded bg-[#090D16] overflow-hidden border border-[#1E293B]">
                      <div
                        className="h-full bg-[#2563EB]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-2.5 border-t border-[#1E293B] flex items-center justify-between text-xs">
                  {prj.end_at ? (
                    <span className="flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(prj.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[11px]">Sans échéance</span>
                  )}

                  <div className="flex items-center gap-1 font-bold text-[#3B82F6] group-hover:translate-x-0.5 transition-transform text-xs">
                    <span>Voir Kanban</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Create Project Card */}
          {isWorkspaceAdmin && (
            <button
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="p-5 rounded border border-dashed border-[#1E293B] hover:border-[#2563EB]/50 bg-[#0F172A]/40 hover:bg-[#0F172A] transition-all flex flex-col items-center justify-center text-center group min-h-[170px]"
            >
              <div className="w-9 h-9 rounded bg-[#2563EB]/10 border border-[#2563EB]/20 group-hover:bg-[#2563EB]/20 flex items-center justify-center text-[#3B82F6] transition-colors mb-2">
                <Plus className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-200 group-hover:text-[#60A5FA]">
                Créer un projet
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Ajoutez un tableau Kanban pour cette venture.
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
