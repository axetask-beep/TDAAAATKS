import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Task, TaskStatus, TaskPriority, Tag, User, STATUS_LABELS } from '../../types';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { StatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { EditProjectModal } from '../common/EditModal';
import confetti from 'canvas-confetti';
import {
  Kanban as KanbanIcon,
  List,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckSquare,
  Paperclip,
  MessageSquare,
  ArrowLeft,
  MoreVertical,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';

const KANBAN_COLUMNS: { id: TaskStatus; title: string; color: string; border: string }[] = [
  { id: 'a_faire', title: 'À faire', color: 'text-slate-300', border: 'border-[#1E293B]' },
  { id: 'en_cours', title: 'En cours', color: 'text-[#60A5FA]', border: 'border-[#2563EB]/40' },
  { id: 'en_revision', title: 'En révision', color: 'text-indigo-400', border: 'border-indigo-500/40' },
  { id: 'termine', title: 'Terminé', color: 'text-emerald-400', border: 'border-emerald-500/40' },
  { id: 'bloque', title: 'Bloqué', color: 'text-rose-400', border: 'border-rose-500/40' },
];

interface ProjectViewProps {
  onBackToWorkspace: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ onBackToWorkspace }) => {
  const { user } = useAuth();
  const { confirmProps, confirm } = useConfirm();
  const {
    currentProject,
    currentWorkspace,
    setSelectedTaskId,
    setIsCreateTaskModalOpen,
    taskVersion,
    bumpTaskVersion,
    bumpProjectVersion,
    setCurrentProjectId
  } = useWorkspace();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');

  const isWorkspaceAdmin = user?.role === 'admin' || currentWorkspace?.my_role === 'admin';

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<User[]>([]);

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Quick inline task creation in column
  const [quickAddColumn, setQuickAddColumn] = useState<TaskStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  const loadProjectData = async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const [tsks, tags, members] = await Promise.all([
        api.getProjectTasks(currentProject.id),
        currentWorkspace ? api.getWorkspaceTags(currentWorkspace.id) : Promise.resolve([]),
        currentWorkspace ? api.getWorkspaceMembers(currentWorkspace.id) : Promise.resolve([]),
      ]);
      setTasks(tsks);
      setWorkspaceTags(tags);
      setWorkspaceUsers(members.map(m => m.user).filter(Boolean) as User[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProject = async (data: { name: string; description: string; start_at?: string; end_at?: string; status: string; link: string | null }) => {
    if (!currentProject) return;
    await api.updateProject(currentProject.id, {
      name: data.name,
      description: data.description || undefined,
      start_at: data.start_at,
      end_at: data.end_at,
      status: data.status as any,
      link: data.link,
    });
    // Re-fetch the project itself so the header shows the new name/description
    await setCurrentProjectId(currentProject.id);
    bumpProjectVersion();
  };

  useEffect(() => {
    loadProjectData();
  }, [currentProject?.id, taskVersion]);

  const handleSaveLink = async () => {
    if (!currentProject) return;
    try {
      await api.updateProject(currentProject.id, { link: linkDraft.trim() || null });
      setIsEditingLink(false);
      await setCurrentProjectId(currentProject.id);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'enregistrement du lien.");
    }
  };

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  // Handle Drop
  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === targetStatus) {
      setDraggedTaskId(null);
      return;
    }

    setDraggedTaskId(null);
    const ok = await confirm({
      title: 'Changer le statut',
      message: `Passer "${task.title}" en "${STATUS_LABELS[targetStatus]}" ?`,
      confirmLabel: 'Valider',
      variant: 'warning',
    });
    if (!ok) return;

    // Celebration confetti if dropped in "Terminé"
    if (targetStatus === 'termine') {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#2563EB', '#10B981', '#60A5FA']
      });
    }

    // Optimistic update
    const previousTasks = [...tasks];
    const updatedTasks = tasks.map(t => {
      if (t.id === taskId) {
        return { ...t, status: targetStatus, updated_at: new Date().toISOString() };
      }
      return t;
    });
    setTasks(updatedTasks);
    setDraggedTaskId(null);

    try {
      await api.updateTask(taskId, { status: targetStatus });
      bumpTaskVersion();
    } catch (err) {
      console.error('Failed to update task status on drop:', err);
      setTasks(previousTasks); // Revert on failure
    }
  };

  // Quick inline add task
  const handleQuickAddSubmit = async (status: TaskStatus) => {
    if (!quickAddTitle.trim() || !currentProject) return;
    try {
      const newTask = await api.createTask(currentProject.id, {
        title: quickAddTitle.trim(),
        status,
        priority: 'normale',
        assignee_id: user?.id,
      });
      setTasks(prev => [...prev, newTask]);
      setQuickAddTitle('');
      setQuickAddColumn(null);
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned' && t.assignee_id) return false;
      if (assigneeFilter !== 'unassigned' && t.assignee_id !== assigneeFilter) return false;
    }
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (tagFilter !== 'all' && !t.tags?.some(tag => tag.id === tagFilter)) return false;
    return true;
  });

  if (!currentProject) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        Aucun projet sélectionné.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />
      {/* Edit Project Modal */}
      {currentProject && (
        <EditProjectModal
          isOpen={isEditProjectOpen}
          initialName={currentProject.name}
          initialDescription={currentProject.description || ''}
          initialStartAt={currentProject.start_at || null}
          initialEndAt={currentProject.end_at || null}
          initialStatus={currentProject.status}
          initialLink={currentProject.link}
          onSave={handleSaveProject}
          onClose={() => setIsEditProjectOpen(false)}
        />
      )}
      {/* Project link — set by an admin at any time, shown front and center */}
      {(currentProject.link || isWorkspaceAdmin) && (
        <div className="flex justify-center">
          {isEditingLink ? (
            <form
              onSubmit={e => { e.preventDefault(); handleSaveLink(); }}
              className="w-full max-w-xl flex items-center gap-2 p-2 rounded bg-[#0F172A] border border-[#2563EB]/40"
            >
              <LinkIcon className="w-4 h-4 text-[#60A5FA] shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="https://..."
                value={linkDraft}
                onChange={e => setLinkDraft(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
              />
              <button type="submit" className="px-3 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold">OK</button>
              <button type="button" onClick={() => setIsEditingLink(false)} className="px-2 py-1 rounded text-slate-400 hover:text-slate-200 text-xs">Annuler</button>
            </form>
          ) : currentProject.link ? (
            <div className="flex items-center gap-2 max-w-full">
              <a
                href={currentProject.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB]/15 border border-[#2563EB]/50 text-[#60A5FA] hover:bg-[#2563EB]/25 text-sm font-bold transition-colors min-w-0"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="truncate">{currentProject.link}</span>
              </a>
              {isWorkspaceAdmin && (
                <button
                  onClick={() => { setLinkDraft(currentProject.link || ''); setIsEditingLink(true); }}
                  title="Modifier le lien"
                  className="p-2 rounded text-slate-400 hover:text-[#60A5FA] hover:bg-[#1E293B]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setLinkDraft(''); setIsEditingLink(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#1E293B] text-slate-400 hover:text-[#60A5FA] hover:border-[#2563EB]/50 text-xs font-bold transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Ajouter le lien du projet</span>
            </button>
          )}
        </div>
      )}

      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E293B] pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 mb-1">
            <button
              onClick={onBackToWorkspace}
              className="flex items-center gap-1 hover:text-[#60A5FA] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{currentWorkspace?.name || 'Workspace'}</span>
            </button>
            <span>/</span>
            <span className="text-[#60A5FA] font-bold">{currentProject.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">
              {currentProject.name}
            </h1>
            <span className="px-2 py-0.2 rounded text-[11px] font-bold bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30">
              {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
            </span>
          </div>
          {currentProject.description && (
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {currentProject.description}
            </p>
          )}
        </div>

        {/* Action Controls: View Switcher & Add Task */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Edit project button - admins only */}
          {isWorkspaceAdmin && (
            <button
              onClick={() => setIsEditProjectOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-slate-300 hover:text-slate-100 border border-[#1E293B] text-xs font-bold transition-all"
              title="Modifier le projet"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Modifier</span>
            </button>
          )}
          {/* View Mode Toggle — icon-only below `sm`, matching the navbar's
              own task button so this row never outgrows a 320px viewport. */}
          <div className="p-0.5 rounded bg-[#0F172A] border border-[#1E293B] flex items-center gap-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grille</span>
            </button>
          </div>

          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Tâche</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar / Data Grid Filter */}
      <div className="p-2.5 rounded bg-[#0F172A] border border-[#1E293B] flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search bar */}
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrer les tâches..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
            />
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="max-w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-slate-300 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
          >
            <option value="all">Toutes priorités</option>
            <option value="urgente">Urgente</option>
            <option value="haute">Haute</option>
            <option value="normale">Normale</option>
            <option value="basse">Basse</option>
          </select>

          {/* Assignee filter */}
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="max-w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-slate-300 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
          >
            <option value="all">Tous les assignés</option>
            <option value="unassigned">Non assigné</option>
            {workspaceUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          {/* Tag filter */}
          {workspaceTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="max-w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-slate-300 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
            >
              <option value="all">Tous les tags</option>
              {workspaceTags.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {/* Status filter (in List view) */}
          {viewMode === 'list' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="max-w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-slate-300 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
            >
              <option value="all">Tous statuts</option>
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="en_revision">En révision</option>
              <option value="termine">Terminé</option>
              <option value="bloque">Bloqué</option>
            </select>
          )}
        </div>

        {/* Active counter */}
        <span className="text-slate-400 font-medium">
          {filteredTasks.length} résultat{filteredTasks.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* View Container: Kanban or List */}
      {viewMode === 'kanban' ? (
        /* --- KANBAN BOARD --- */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-6">
          {KANBAN_COLUMNS.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            const isDragTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded bg-[#0F172A] border transition-all duration-100 flex flex-col min-h-[500px] ${
                  isDragTarget
                    ? 'border-[#2563EB] bg-[#2563EB]/5 ring-1 ring-[#2563EB]/40'
                    : 'border-[#1E293B]'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-[#1E293B] flex items-center justify-between bg-[#0B1120]">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${col.color}`}>
                      {col.title}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1E293B] text-slate-300">
                      {colTasks.length}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setQuickAddColumn(quickAddColumn === col.id ? null : col.id);
                      setQuickAddTitle('');
                    }}
                    title="Ajouter une tâche"
                    className="p-1 rounded text-slate-400 hover:text-[#60A5FA] hover:bg-[#1E293B] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Inline Add Task Composer */}
                {quickAddColumn === col.id && (
                  <div className="p-2.5 bg-[#0B1120] border-b border-[#1E293B] animate-in fade-in duration-100">
                    <textarea
                      autoFocus
                      value={quickAddTitle}
                      onChange={e => setQuickAddTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleQuickAddSubmit(col.id);
                        }
                        if (e.key === 'Escape') {
                          setQuickAddColumn(null);
                        }
                      }}
                      placeholder="Nom de la tâche... (Entrée)"
                      rows={2}
                      className="w-full p-2 text-xs bg-[#090D16] border border-[#1E293B] rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button
                        onClick={() => setQuickAddColumn(null)}
                        className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleQuickAddSubmit(col.id)}
                        className="px-2.5 py-0.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-[10px] rounded shadow-sm"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                )}

                {/* Task Cards in Column */}
                <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[700px]">
                  {colTasks.map(task => {
                    const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
                    const totalSubtasks = task.subtasks?.length || 0;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="p-3 rounded bg-[#0B1120] hover:bg-[#1E293B]/60 border border-[#1E293B] hover:border-[#2563EB]/40 transition-all cursor-grab active:cursor-grabbing shadow-sm group select-none space-y-2 relative"
                      >
                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.tags.map(t => (
                              <span
                                key={t.id}
                                className="max-w-[140px] truncate text-[10px] font-semibold px-1.5 py-0.2 rounded"
                                style={{ backgroundColor: `${t.color}15`, color: t.color, border: `1px solid ${t.color}35` }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Title */}
                        <h4 className="text-xs font-bold text-slate-100 group-hover:text-[#60A5FA] transition-colors leading-relaxed line-clamp-2">
                          {task.title}
                        </h4>

                        {/* Badges / Meta Info */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1E293B] text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <PriorityBadge priority={task.priority} size="sm" showLabel={false} />

                            {task.end_at && (
                              <span className="flex items-center gap-1 text-slate-400 font-medium">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {new Date(task.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            )}

                            {totalSubtasks > 0 && (
                              <span className="flex items-center gap-1 text-slate-400 font-mono">
                                <CheckSquare className="w-3 h-3 text-slate-500" />
                                {subtasksDone}/{totalSubtasks}
                              </span>
                            )}

                            {task.comments && task.comments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <MessageSquare className="w-3 h-3 text-slate-500" />
                                {task.comments.length}
                              </span>
                            )}
                          </div>

                          {/* Assignee Avatar */}
                          <Avatar user={task.assignee} size="xs" showTooltip />
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="h-20 border border-dashed border-[#1E293B] rounded flex items-center justify-center text-[10px] text-slate-600">
                      Zone de dépôt
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* --- LIST TABLE VIEW / DATA GRID --- */
        <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden shadow-lg shadow-black/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E293B] bg-[#0B1120] text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-3 pl-4">Tâche</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Priorité</th>
                  <th className="p-3">Assigné</th>
                  <th className="p-3">Échéance</th>
                  <th className="p-3">Sous-tâches</th>
                  <th className="p-3 pr-4">Temps loggé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]">
                {filteredTasks.map(task => {
                  const subtasksDone = task.subtasks?.filter(s => s.completed).length || 0;
                  const totalSubtasks = task.subtasks?.length || 0;

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="hover:bg-[#1E293B]/70 transition-colors cursor-pointer group"
                    >
                      <td className="p-3 pl-4 font-semibold text-slate-100 group-hover:text-[#60A5FA] transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{task.title}</span>
                          {task.tags?.map(t => (
                            <span
                              key={t.id}
                              className="text-[10px] px-1.5 py-0.2 rounded font-medium"
                              style={{ backgroundColor: `${t.color}15`, color: t.color }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-3">
                        <StatusBadge status={task.status} />
                      </td>

                      <td className="p-3">
                        <PriorityBadge priority={task.priority} />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Avatar user={task.assignee} size="xs" />
                          <span className="text-slate-300 font-medium">
                            {task.assignee?.name || 'Non assigné'}
                          </span>
                        </div>
                      </td>

                      <td className="p-3 text-slate-400 font-medium">
                        {task.end_at ? (
                          new Date(task.end_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="p-3 text-slate-400 font-mono">
                        {totalSubtasks > 0 ? `${subtasksDone}/${totalSubtasks}` : '—'}
                      </td>

                      <td className="p-3 pr-4 font-mono text-[#60A5FA] font-semibold">
                        {task.total_time_minutes ? `${Math.floor(task.total_time_minutes / 60)}h ${task.total_time_minutes % 60}m` : '0m'}
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Aucune tâche ne correspond aux critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
