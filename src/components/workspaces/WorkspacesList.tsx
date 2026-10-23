import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Layers, 
  Plus, 
  FolderGit2, 
  CheckCircle2, 
  Users, 
  Clock, 
  ArrowRight, 
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface WorkspacesListProps {
  onSelectWorkspace: (workspaceId: string) => void;
}

export const WorkspacesList: React.FC<WorkspacesListProps> = ({ onSelectWorkspace }) => {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === 'admin';
  const { workspaces, setIsCreateWorkspaceModalOpen, setCurrentWorkspaceId } = useWorkspace();

  const totalActive = workspaces.reduce((acc, w) => acc + (w.active_tasks_count || 0), 0);
  const totalCompleted = workspaces.reduce((acc, w) => acc + (w.completed_tasks_count || 0), 0);
  const totalProjects = workspaces.reduce((acc, w) => acc + (w.projects_count || 0), 0);

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-1">
            <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Portefeuille de Ventures & Projets</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
            Espaces de Travail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Gérez vos différentes ventures et équipes distinctes en toute isolation des données.
          </p>
        </div>

        {isGlobalAdmin && (
          <button
            onClick={() => setIsCreateWorkspaceModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouvel espace</span>
          </button>
        )}
      </div>

      {/* Global Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Espaces Actifs</span>
            <p className="text-2xl font-bold text-slate-100 mt-1 font-mono">{workspaces.length}</p>
          </div>
          <div className="w-10 h-10 rounded bg-[#2563EB]/10 border border-[#2563EB]/30 flex items-center justify-center text-[#60A5FA]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tâches en Cours</span>
            <p className="text-2xl font-bold text-[#60A5FA] mt-1 font-mono">{totalActive}</p>
          </div>
          <div className="w-10 h-10 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projets Répartis</span>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{totalProjects}</p>
          </div>
          <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Workspaces Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {workspaces.map(ws => {
          const totalTasks = (ws.active_tasks_count || 0) + (ws.completed_tasks_count || 0);
          const progress = totalTasks > 0 ? Math.round(((ws.completed_tasks_count || 0) / totalTasks) * 100) : 0;

          return (
            <div
              key={ws.id}
              onClick={() => {
                setCurrentWorkspaceId(ws.id);
                onSelectWorkspace(ws.id);
              }}
              className="p-4 rounded bg-[#0F172A] border border-[#1E293B] hover:border-[#2563EB]/50 transition-all cursor-pointer group flex flex-col justify-between hover:shadow-xl hover:shadow-black/60 relative overflow-hidden"
            >
              {/* Top Accent Line with workspace custom color */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: ws.color }}
              />

              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-lg flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0"
                      style={{ backgroundColor: `${ws.color}20`, border: `1px solid ${ws.color}40` }}
                    >
                      {ws.photo_url ? (
                        <img src={ws.photo_url} alt={ws.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: ws.color }} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-[#60A5FA] transition-colors">
                        {ws.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Rôle : {ws.my_role === 'admin' ? 'Admin' : 'Membre'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 my-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 uppercase">Progression</span>
                    <span className="font-mono font-bold text-[#60A5FA]">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded bg-[#090D16] overflow-hidden border border-[#1E293B]">
                    <div
                      className="h-full transition-all duration-300 bg-[#2563EB]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 font-semibold text-[#60A5FA] text-[11px]">
                    <Clock className="w-3 h-3 text-[#3B82F6]" />
                    {ws.active_tasks_count || 0} en cours
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 text-[11px]">
                    {ws.projects_count || 0} projets
                  </span>
                </div>

                <div className="flex items-center gap-1 font-bold text-[#3B82F6] group-hover:translate-x-0.5 transition-transform text-xs">
                  <span>Ouvrir</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Create workspace button card — admin only */}
        {isGlobalAdmin && (
          <button
            onClick={() => setIsCreateWorkspaceModalOpen(true)}
            className="p-5 rounded border border-dashed border-[#1E293B] hover:border-[#2563EB]/50 bg-[#0F172A]/40 hover:bg-[#0F172A] transition-all flex flex-col items-center justify-center text-center group min-h-[180px]"
          >
            <div className="w-10 h-10 rounded bg-[#2563EB]/10 border border-[#2563EB]/20 group-hover:bg-[#2563EB]/20 flex items-center justify-center text-[#3B82F6] transition-colors mb-2">
              <Plus className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-200 group-hover:text-[#60A5FA]">
              Ajouter un espace de travail
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
              Créez une nouvelle venture avec ses propres membres et projets.
            </p>
          </button>
        )}
      </div>
    </div>
  );
};
