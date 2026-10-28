import React, { useState, useEffect } from 'react';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Task, TaskStatus, TaskPriority, Tag, User } from '../../types';
import { StatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { ChronoWidget } from '../common/ChronoWidget';
import { CalendarPicker } from '../common/CalendarPicker';
import { combineDateAndTime, splitISOToDateAndTime } from '../../lib/datetime';
import { readFileAsDataUrl } from '../../lib/file';

// Grow a textarea to fit its content so long text is always fully readable.
const autoGrow = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  X,
  Trash2,
  Calendar,
  User as UserIcon,
  Tag as TagIcon,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Plus,
  Check,
  Send,
  FolderGit2,
  ExternalLink,
  Upload,
  Download,
  AlertCircle
} from 'lucide-react';

export const TaskDetailDrawer: React.FC = () => {
  const { user } = useAuth();
  const {
    selectedTaskId,
    setSelectedTaskId,
    currentWorkspace,
    bumpTaskVersion
  } = useWorkspace();
  const { confirmProps, confirm } = useConfirm();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Form edit states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('a_faire');
  const [priority, setPriority] = useState<TaskPriority>('normale');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endDate, setEndDate] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Subtasks & Comments & Attachments & Time Logging inputs
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');

  // Available options
  const [workspaceMembers, setWorkspaceMembers] = useState<User[]>([]);
  const [workspaceTags, setWorkspaceTags] = useState<Tag[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'subtasks' | 'comments' | 'attachments'>('subtasks');

  // Form values as they are saved on the server — edits stay local until "Valider".
  const formOf = (t: Task) => {
    const s = splitISOToDateAndTime(t.start_at);
    const en = splitISOToDateAndTime(t.end_at);
    return {
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      assigneeId: t.assignee_id || '',
      startDate: s.date,
      startTime: s.time || '09:00',
      endDate: en.date,
      endTime: en.time || '18:00',
      tagIds: (t.tags?.map(x => x.id) || []).sort(),
    };
  };

  const resetForm = (t: Task) => {
    const f = formOf(t);
    setTitle(f.title);
    setDescription(f.description);
    setStatus(f.status);
    setPriority(f.priority);
    setAssigneeId(f.assigneeId);
    setStartDate(f.startDate);
    setStartTime(f.startTime);
    setEndDate(f.endDate);
    setEndTime(f.endTime);
    setTagIds(f.tagIds);
  };

  // `resetFields` only on first load: refreshing after a subtask/comment
  // must not wipe edits the user hasn't validated yet.
  const loadTask = async (resetFields = false) => {
    if (!selectedTaskId) return;
    try {
      setLoading(true);
      const data = await api.getTask(selectedTaskId);
      setTask(data);
      if (resetFields) resetForm(data);

      // Assignee list intentionally includes every platform user, not just
      // existing workspace members — assigning someone new auto-grants them
      // workspace access server-side (see ensureWorkspaceMembership).
      const [allUsers, tags] = await Promise.all([
        api.getUsers(),
        data.workspace_id ? api.getWorkspaceTags(data.workspace_id) : Promise.resolve([]),
      ]);
      setWorkspaceMembers(allUsers);
      setWorkspaceTags(tags);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask(true);
  }, [selectedTaskId]);

  const saved = task ? formOf(task) : null;
  const current = {
    title, description, status, priority, assigneeId,
    startDate, startTime, endDate, endTime,
    tagIds: [...tagIds].sort(),
  };
  const isDirty = !!saved && JSON.stringify(saved) !== JSON.stringify(current);

  const handleSaveEdits = async () => {
    if (!task || !saved) return;
    const updates: Record<string, unknown> = {};
    if (current.title !== saved.title) updates.title = current.title;
    if (current.description !== saved.description) updates.description = current.description;
    if (current.status !== saved.status) updates.status = current.status;
    if (current.priority !== saved.priority) updates.priority = current.priority;
    if (current.assigneeId !== saved.assigneeId) updates.assignee_id = current.assigneeId || null;
    if (current.startDate !== saved.startDate || current.startTime !== saved.startTime)
      updates.start_at = combineDateAndTime(startDate, startTime) || null;
    if (current.endDate !== saved.endDate || current.endTime !== saved.endTime)
      updates.end_at = combineDateAndTime(endDate, endTime) || null;
    if (current.tagIds.join() !== saved.tagIds.join()) updates.tag_ids = tagIds;
    try {
      setSaving(true);
      await api.updateTask(task.id, updates as Partial<Task>);
      bumpTaskVersion();
      const fresh = await api.getTask(task.id);
      setTask(fresh);
      resetForm(fresh);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (isDirty) {
      const ok = await confirm({
        title: 'Modifications non validées',
        message: 'Vos modifications ne sont pas validées et seront perdues.\n\nFermer quand même ?',
        confirmLabel: 'Fermer sans valider',
        variant: 'warning',
      });
      if (!ok) return;
    }
    setSelectedTaskId(null);
  };

  // Subtasks
  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !task) return;
    try {
      await api.addSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, currentCompleted: boolean) => {
    try {
      await api.updateSubtask(subtaskId, { completed: !currentCompleted });
      if (!currentCompleted) {
        confetti({
          particleCount: 20,
          spread: 40,
          origin: { y: 0.8 },
          colors: ['#F59E0B', '#10B981']
        });
      }
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const ok = await confirm({
      title: 'Supprimer la sous-tâche',
      message: 'Voulez-vous vraiment supprimer la sous-tâche ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteSubtask(subtaskId);
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  // Comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim() || !task) return;
    try {
      await api.addComment(task.id, newCommentContent.trim());
      setNewCommentContent('');
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await confirm({
      title: 'Supprimer le commentaire',
      message: 'Voulez-vous vraiment supprimer le commentaire ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteComment(commentId);
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  // Attachments
  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim() || !task) return;
    try {
      await api.addAttachment(task.id, {
        file_name: newAttachmentName.trim(),
        file_url: newAttachmentUrl.trim(),
        file_size: 150000,
        file_type: 'document',
      });
      setNewAttachmentName('');
      setNewAttachmentUrl('');
      setIsAddingAttachment(false);
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !task) return;
    try {
      setIsUploadingFile(true);
      setAttachmentError('');
      const dataUrl = await readFileAsDataUrl(file);
      await api.addAttachment(task.id, {
        file_name: file.name,
        file_url: dataUrl,
        file_size: file.size,
        file_type: file.type || undefined,
      });
      loadTask();
      bumpTaskVersion();
    } catch (err: any) {
      setAttachmentError(err.message || "Erreur lors de l'import du fichier.");
      setTimeout(() => setAttachmentError(''), 3000);
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const ok = await confirm({
      title: 'Supprimer la pièce jointe',
      message: 'Voulez-vous vraiment supprimer la pièce jointe ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteAttachment(attachmentId);
      loadTask();
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  // Tags toggle
  const handleToggleTag = (tagId: string) => {
    setTagIds(ids => ids.includes(tagId) ? ids.filter(id => id !== tagId) : [...ids, tagId]);
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'Supprimer la tâche',
      message: `Voulez-vous vraiment supprimer "${task.title}" ?\n\nCette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteTask(task.id);
      setSelectedTaskId(null);
      bumpTaskVersion();
    } catch (err) {
      console.error(err);
    }
  };

  if (!selectedTaskId) return null;

  const totalSubtasks = task?.subtasks?.length || 0;
  const completedSubtasks = task?.subtasks?.filter(s => s.completed).length || 0;
  const subtasksProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />

      <div className="w-full max-w-2xl bg-[#090D16] border border-[#1E293B] rounded-lg max-h-[calc(100dvh-2rem)] my-auto flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-3.5 border-b border-[#1E293B] bg-[#0B1120] flex items-center gap-3">
          <button
            onClick={handleClose}
            title="Retour"
            aria-label="Retour"
            className="flex items-center justify-center w-8 h-8 rounded bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-slate-200 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 truncate min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-slate-300 truncate">
              <FolderGit2 className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
              <span className="truncate">{task?.project?.name || 'Projet'}</span>
            </span>
            <span className="text-slate-600 shrink-0">/</span>
            <span className="text-[#60A5FA] font-mono text-[11px] shrink-0">#{task?.id.slice(-4)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chronométrage — entièrement automatique : démarre quand le
                statut passe à "En cours" (task.start_at posé côté serveur),
                passe au rouge si l'échéance est dépassée, se fige quand la
                tâche passe à "Terminé". */}
            {task && (
              <ChronoWidget startAt={task.start_at} endAt={task.end_at} completedAt={task.completed_at} />
            )}

            <button
              onClick={handleDeleteTask}
              title="Supprimer la tâche"
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleClose}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body — min-w-0 so this flex-column child can actually
            shrink to the drawer's width instead of growing to fit its
            widest descendant (the tabs row below), which otherwise pushed
            the whole drawer into horizontal overflow on narrow screens. */}
        <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="text-center py-20 text-xs text-slate-400">
              Synchronisation des données de la tâche...
            </div>
          ) : task ? (
            <>
              {/* Title input */}
              <div>
                <textarea
                  ref={autoGrow}
                  rows={1}
                  value={title}
                  onChange={e => { setTitle(e.target.value.replace(/\n/g, ' ')); autoGrow(e.target); }}
                  onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
                  className="w-full resize-none overflow-hidden break-words text-lg font-bold bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none focus:bg-[#0F172A] p-1.5 rounded transition-colors border border-transparent focus:border-[#2563EB]/50"
                  placeholder="Titre de la tâche..."
                />
              </div>

              {/* Status, Priority, Assignee & Due Date Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded bg-[#0F172A] border border-[#1E293B]">
                {/* Status */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Statut
                  </label>
                  <select
                    value={status}
                    onChange={e => {
                      const val = e.target.value as TaskStatus;
                      setStatus(val);
                    }}
                    className="w-full px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
                  >
                    <option value="a_faire">À faire</option>
                    <option value="en_cours">En cours</option>
                    <option value="en_revision">En révision</option>
                    <option value="termine">Terminé</option>
                    <option value="bloque">Bloqué</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Priorité
                  </label>
                  <select
                    value={priority}
                    onChange={e => {
                      const val = e.target.value as TaskPriority;
                      setPriority(val);
                    }}
                    className="w-full px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer"
                  >
                    <option value="basse">Basse</option>
                    <option value="normale">Normale</option>
                    <option value="haute">Haute</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                {/* Assignee */}
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Assigné à
                  </label>
                  <select
                    value={assigneeId}
                    onChange={e => {
                      const val = e.target.value;
                      setAssigneeId(val);
                    }}
                    className="w-full px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/60 cursor-pointer truncate"
                  >
                    <option value="">Non assigné</option>
                    {workspaceMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Start / End date & time — drives the task chrono */}
              <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded bg-[#0F172A] border border-[#1E293B]">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Début (date et heure)
                  </label>
                  <div className="space-y-1.5">
                    <CalendarPicker
                      value={startDate}
                      onChange={val => {
                        setStartDate(val);
                      }}
                      placeholder="Date de début"
                    />
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => {
                        setStartTime(e.target.value);
                      }}
                      className="w-full px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Fin (date et heure)
                  </label>
                  <div className="space-y-1.5">
                    <CalendarPicker
                      value={endDate}
                      onChange={val => {
                        setEndDate(val);
                      }}
                      placeholder="Date de fin"
                    />
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => {
                        setEndTime(e.target.value);
                      }}
                      className="w-full px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/60"
                    />
                  </div>
                </div>
              </div>

              {/* Tags Selector */}
              {workspaceTags.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                    <TagIcon className="w-3 h-3 text-[#3B82F6]" />
                    <span>Tags</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {workspaceTags.map(tag => {
                      const isSelected = tagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleToggleTag(tag.id)}
                          className={`max-w-[200px] text-xs px-2 py-0.5 rounded font-medium transition-all flex items-center gap-1.5 ${
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
                          <span className="truncate">{tag.name}</span>
                          {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description & Spécifications
                </label>
                <textarea
                  ref={autoGrow}
                  value={description}
                  onChange={e => { setDescription(e.target.value); autoGrow(e.target); }}
                  placeholder="Spécifications, paramètres et détails techniques..."
                  rows={4}
                  className="w-full resize-none overflow-hidden p-2.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60 leading-relaxed"
                />
              </div>

              {/* Tabs Navigation: Subtasks, Comments, Attachments, Time Logged */}
              <div className="border-t border-[#1E293B] pt-3">
                <div className="flex items-center gap-1.5 border-b border-[#1E293B] pb-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('subtasks')}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-bold transition-colors shrink-0 ${
                      activeTab === 'subtasks'
                        ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sous-tâches </span>
                    <span>({task.subtasks?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-bold transition-colors shrink-0 ${
                      activeTab === 'comments'
                        ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Commentaires </span>
                    <span>({task.comments?.length || 0})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('attachments')}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-bold transition-colors shrink-0 ${
                      activeTab === 'attachments'
                        ? 'bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Fichiers </span>
                    <span>({task.attachments?.length || 0})</span>
                  </button>
                </div>

                {/* TAB 1: SUBTASKS */}
                {activeTab === 'subtasks' && (
                  <div className="pt-3 space-y-2.5">
                    {totalSubtasks > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Progression</span>
                          <span className="font-mono font-bold text-[#60A5FA]">{completedSubtasks}/{totalSubtasks} ({subtasksProgress}%)</span>
                        </div>
                        <div className="w-full h-1 rounded bg-[#1E293B] overflow-hidden">
                          <div
                            className="h-full rounded bg-[#2563EB]"
                            style={{ width: `${subtasksProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {task.subtasks?.map(sub => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between p-2 rounded bg-[#0F172A] border border-[#1E293B] group hover:border-[#334155]"
                        >
                          <label className="flex items-start gap-2 flex-1 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={sub.completed}
                              onChange={() => handleToggleSubtask(sub.id, sub.completed)}
                              className="w-3.5 h-3.5 mt-0.5 shrink-0 rounded border-[#1E293B] text-[#2563EB] focus:ring-0 accent-[#2563EB]"
                            />
                            <span className={`text-xs whitespace-pre-wrap break-words min-w-0 ${sub.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {sub.title}
                            </span>
                          </label>
                          <button
                            onClick={() => handleDeleteSubtask(sub.id)}
                            className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Subtask Form */}
                    <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={e => setNewSubtaskTitle(e.target.value)}
                        placeholder="Ajouter une sous-tâche..."
                        className="flex-1 px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] border border-[#1E293B] font-bold text-xs rounded transition-colors"
                      >
                        Ajouter
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 2: COMMENTS */}
                {activeTab === 'comments' && (
                  <div className="pt-3 space-y-3">
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {task.comments?.map(cmt => (
                        <div key={cmt.id} className="p-2.5 rounded bg-[#0F172A] border border-[#1E293B] space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar user={cmt.user} size="xs" />
                              <span className="text-xs font-bold text-slate-200">{cmt.user?.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(cmt.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {cmt.user_id === user?.id && (
                              <button
                                onClick={() => handleDeleteComment(cmt.id)}
                                className="text-slate-600 hover:text-rose-400 text-xs"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 pl-5 leading-relaxed whitespace-pre-wrap">
                            {cmt.content}
                          </p>
                        </div>
                      ))}

                      {(!task.comments || task.comments.length === 0) && (
                        <div className="p-6 text-center text-xs text-slate-500">
                          Aucun commentaire pour le moment.
                        </div>
                      )}
                    </div>

                    {/* New Comment Input */}
                    <form onSubmit={handleAddComment} className="flex items-center gap-2">
                      <Avatar user={user} size="sm" />
                      <input
                        type="text"
                        value={newCommentContent}
                        onChange={e => setNewCommentContent(e.target.value)}
                        placeholder="Écrire une note ou commentaire..."
                        className="flex-1 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/60"
                      />
                      <button
                        type="submit"
                        className="p-1.5 bg-[#2563EB] text-white rounded hover:bg-[#1D4ED8] transition-colors shadow-sm shadow-blue-500/25"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}

                {/* TAB 3: ATTACHMENTS */}
                {activeTab === 'attachments' && (
                  <div className="pt-3 space-y-2.5">
                    <div className="space-y-1.5">
                      {task.attachments?.map(att => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2.5 rounded bg-[#0F172A] border border-[#1E293B]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">{att.file_name}</p>
                              <p className="text-[10px] text-slate-500">Ajouté par {att.uploader?.name}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-[#3B82F6]"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-slate-600 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {(!task.attachments || task.attachments.length === 0) && (
                        <div className="p-6 text-center text-xs text-slate-500">
                          Aucune pièce jointe liée à cette tâche.
                        </div>
                      )}
                    </div>

                    {attachmentError && (
                      <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-medium">
                        {attachmentError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <label className="cursor-pointer py-1.5 border border-dashed border-[#1E293B] rounded text-xs font-semibold text-[#60A5FA] hover:bg-[#0F172A] transition-colors flex items-center justify-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isUploadingFile ? 'Import...' : 'Importer un fichier'}</span>
                        <input type="file" onChange={handleFileUpload} disabled={isUploadingFile} className="hidden" />
                      </label>
                      <button
                        onClick={() => setIsAddingAttachment(!isAddingAttachment)}
                        className="py-1.5 border border-dashed border-[#1E293B] rounded text-xs font-semibold text-slate-400 hover:bg-[#0F172A] hover:text-[#60A5FA] transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Attacher un lien</span>
                      </button>
                    </div>

                    {isAddingAttachment && (
                      <form onSubmit={handleAddAttachment} className="p-2.5 rounded bg-[#0F172A] border border-[#1E293B] space-y-2">
                        <input
                          type="text"
                          value={newAttachmentName}
                          onChange={e => setNewAttachmentName(e.target.value)}
                          placeholder="Nom du fichier (ex: spec.pdf)"
                          className="w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={newAttachmentUrl}
                          onChange={e => setNewAttachmentUrl(e.target.value)}
                          placeholder="Lien URL (https://...)"
                          className="w-full px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsAddingAttachment(false)}
                            className="px-2 py-0.5 text-xs text-slate-400"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            className="px-2.5 py-0.5 bg-[#2563EB] text-white font-bold rounded text-xs"
                          >
                            Attacher
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

              </div>
            </>
          ) : (
            <div className="text-center py-20 text-xs text-slate-400">
              Tâche introuvable.
            </div>
          )}
        </div>

        {task && !loading && (
          <div className="p-3 border-t border-[#1E293B] bg-[#0B1120] flex items-center justify-end gap-2">
            {isDirty && (
              <span className="mr-auto text-[11px] font-semibold text-amber-400">Modifications non validées</span>
            )}
            <button
              onClick={() => resetForm(task)}
              disabled={!isDirty || saving}
              className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-300 bg-[#0F172A] border border-[#1E293B] hover:bg-[#1E293B] hover:text-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveEdits}
              disabled={!isDirty || saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-bold bg-[#2563EB] hover:bg-[#3B82F6] text-white border border-[#3B82F6]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Validation...' : 'Valider'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
