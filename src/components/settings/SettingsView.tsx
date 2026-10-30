import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useToast } from '../../context/ToastContext';
import { SOUND_TYPES, SOUND_LABELS } from '../../lib/sound';
import { api } from '../../lib/api';
import { resizeImageToDataUrl } from '../../lib/image';
import { WorkspaceMember, ProjectMember, Tag, WorkspaceRole, User as UserType, JobFunction, Project } from '../../types';
import { Avatar } from '../common/Avatar';
import { ConfirmDialog, useConfirm } from '../common/ConfirmDialog';
import { RoleBadge } from '../common/Badge';
import { EditProjectModal } from '../common/EditModal';
import {
  Settings,
  Users,
  Tag as TagIcon,
  UserPlus,
  Trash2,
  Shield,
  Plus,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Search,
  KeyRound,
  ShieldCheck,
  UserX,
  Volume2,
  VolumeX,
  Play,
  Sliders,
  BellRing,
  Layers,
  FolderGit2,
  Edit2,
  ArrowRight
} from 'lucide-react';

const PRESET_COLORS = [
  '#2563EB', '#3B82F6', '#60A5FA', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
];

const ONLINE_WINDOW_MS = 90_000;

function isUserOnline(u?: Pick<UserType, 'last_seen_at'>): boolean {
  if (!u?.last_seen_at) return false;
  return Date.now() - new Date(u.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

export const SettingsView: React.FC = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const {
    currentWorkspace,
    workspaces,
    refreshWorkspaces,
    setCurrentWorkspaceId,
    setIsCreateWorkspaceModalOpen,
    setIsCreateProjectModalOpen,
    bumpProjectVersion,
  } = useWorkspace();
  const {
    notify,
    soundEnabled,
    soundType,
    toggleSound,
    selectSoundType,
    playTestSound
  } = useToast();
  const { confirmProps, confirm } = useConfirm();

  // Shows an inline success/error message, then clears it after 3s so it
  // never lingers on screen.
  const flash = (setter: (v: string) => void, message: string, ms = 3000) => {
    setter(message);
    if (message) setTimeout(() => setter(''), ms);
  };

  const isGlobalAdmin = user?.role === 'admin';
  const isWorkspaceAdmin = isGlobalAdmin || currentWorkspace?.my_role === 'admin';
  // Whether this user administers at least one workspace — gates the
  // "Espaces" and "Projets" management tabs independently of whichever
  // workspace happens to be selected right now.
  const canManageAnyWorkspace = isGlobalAdmin || workspaces.some(w => w.my_role === 'admin');

  const [activeTab, setActiveTab] = useState<'profile' | 'members' | 'tags' | 'espaces' | 'projects' | 'all_users' | 'notifications'>(
    isGlobalAdmin ? 'all_users' : 'members'
  );


  // Personal profile state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Members state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Global All Users state (Admin feature)
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('password123');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [newUserFunctionId, setNewUserFunctionId] = useState('');
  const [userAdminError, setUserAdminError] = useState('');
  const [userAdminSuccess, setUserAdminSuccess] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#2563EB');

  // Projects state (scoped to currentWorkspace)
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Project members panel (add/remove members on one specific project)
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loadingProjectMembers, setLoadingProjectMembers] = useState(false);
  const [addProjectMemberUserId, setAddProjectMemberUserId] = useState('');

  // Workspace edit state
  const [wsName, setWsName] = useState('');
  const [wsColor, setWsColor] = useState('#2563EB');
  const [isUpdatingWs, setIsUpdatingWs] = useState(false);
  const [isUploadingWsPhoto, setIsUploadingWsPhoto] = useState(false);

  // Avatar upload
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Job functions state (admin only)
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [newFunctionName, setNewFunctionName] = useState('');

  const loadData = async () => {
    if (!currentWorkspace) return;
    try {
      setLoadingMembers(true);
      setLoadingProjects(true);
      const [mems, tgs, prjs] = await Promise.all([
        api.getWorkspaceMembers(currentWorkspace.id),
        api.getWorkspaceTags(currentWorkspace.id),
        api.getWorkspaceProjects(currentWorkspace.id),
      ]);
      setMembers(mems);
      setTags(tgs);
      setProjects(prjs);
      setWsName(currentWorkspace.name);
      setWsColor(currentWorkspace.color);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
      setLoadingProjects(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const list = await api.getUsers();
      setAllUsers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadData();
    setManagingProject(null);
    setEditingProject(null);
  }, [currentWorkspace?.id]);

  const loadJobFunctions = async () => {
    try {
      const list = await api.getJobFunctions();
      setJobFunctions(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Every user (not just admins) can see the app-wide user directory —
    // admins additionally get management controls rendered around it.
    loadAllUsers();
    loadJobFunctions();
  }, []);

  // Profile: upload & compress an avatar image, then save it immediately
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    const ok = await confirm({
      title: 'Photo de profil',
      message: `Remplacer votre photo de profil par "${file.name}" ?`,
      confirmLabel: 'Valider',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      setIsUploadingAvatar(true);
      const dataUrl = await resizeImageToDataUrl(file, 400, 0.82);
      await updateProfile(profileName.trim() || user.name, undefined, dataUrl);
      flash(setProfileSuccess, 'Photo de profil mise à jour.');
    } catch (err: any) {
      flash(setProfileError, err.message || "Erreur lors de l'envoi de la photo.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Workspace: upload & compress a workspace photo (admin only)
  const handleWorkspacePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setIsUploadingWsPhoto(true);
      const dataUrl = await resizeImageToDataUrl(file, 500, 0.85);
      await api.updateWorkspace(currentWorkspace.id, { photo_url: dataUrl });
      await refreshWorkspaces();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingWsPhoto(false);
    }
  };

  // Admin: job functions CRUD
  const handleCreateFunction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFunctionName.trim()) return;
    try {
      await api.createJobFunction(newFunctionName.trim());
      setNewFunctionName('');
      loadJobFunctions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFunction = async (id: string) => {
    try {
      await api.deleteJobFunction(id);
      loadJobFunctions();
      loadAllUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignFunction = async (userId: string, functionId: string) => {
    try {
      await api.setUserFunction(userId, functionId || null);
      loadAllUsers();
    } catch (err) {
      console.error(err);
    }
  };

  // Save personal profile (name + email)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    if (!profileName.trim() || !profileEmail.trim()) {
      flash(setProfileError, 'Le nom et l\'email ne peuvent pas être vides.');
      return;
    }
    try {
      setIsSavingProfile(true);
      await updateProfile(profileName.trim(), profileEmail.trim());
      flash(setProfileSuccess, 'Vos informations ont été mises à jour.');
    } catch (err: any) {
      flash(setProfileError, err.message || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword.length < 6) {
      flash(setPasswordError, 'Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      flash(setPasswordError, 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    try {
      setIsChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      flash(setPasswordSuccess, 'Votre mot de passe a été changé avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      flash(setPasswordError, err.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Invite member to workspace
  const handleInviteMember = async (target: UserType) => {
    setInviteError('');
    setInviteSuccess('');
    if (!currentWorkspace) return;

    try {
      await api.addWorkspaceMember(currentWorkspace.id, target.id, inviteRole);
      flash(setInviteSuccess, `${target.name} ajouté à l'espace !`);
      loadData();
    } catch (err: any) {
      flash(setInviteError, err.message || "Erreur lors de l'ajout du membre.");
    }
  };

  // Change workspace member role
  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    const ok = await confirm({
      title: 'Changer le rôle',
      message: `Changer le rôle de ce membre en "${newRole}" ?`,
      confirmLabel: 'Valider',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await api.updateWorkspaceMember(memberId, newRole);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Remove member from workspace
  const handleRemoveMember = async (memberId: string) => {
    const ok = await confirm({
      title: 'Retirer le membre',
      message: "Voulez-vous retirer ce membre de l'espace de travail ?\n\nIl perdra l'accès à tous les projets de cet espace.",
      confirmLabel: 'Retirer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.removeWorkspaceMember(memberId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Admin: Create new user profile
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserAdminError('');
    setUserAdminSuccess('');
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      await api.createUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword || 'password123',
        role: newUserRole,
        function_id: newUserFunctionId || null,
      });
      flash(setUserAdminSuccess, `Utilisateur ${newUserName} créé avec succès !`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('password123');
      setNewUserRole('member');
      setNewUserFunctionId('');
      loadAllUsers();
      loadData();
    } catch (err: any) {
      flash(setUserAdminError, err.message || 'Erreur lors de la création du profil.');
    }
  };

  // Admin: Change user global role
  const handleUserRoleChange = async (userId: string, role: 'admin' | 'member') => {
    const ok = await confirm({
      title: 'Changer le rôle global',
      message: `Passer cet utilisateur en "${role === 'admin' ? 'Administrateur' : 'Membre'}" ?`,
      confirmLabel: 'Valider',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await api.updateUserRole(userId, role);
      loadAllUsers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du changement de rôle.');
    }
  };

  // Admin: Delete user profile
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      setIsDeletingUser(true);
      setUserAdminError('');
      await api.deleteUser(userToDelete.id);
      flash(setUserAdminSuccess, `Le profil utilisateur de ${userToDelete.name} a été supprimé avec succès.`);
      setUserToDelete(null);
      await loadAllUsers();
      await loadData();
    } catch (err: any) {
      flash(setUserAdminError, err.message || 'Erreur lors de la suppression du profil.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Create Tag
  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !currentWorkspace) return;
    try {
      await api.createWorkspaceTag(currentWorkspace.id, newTagName.trim(), newTagColor);
      setNewTagName('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Tag
  const handleDeleteTag = async (tagId: string) => {
    try {
      await api.deleteWorkspaceTag(tagId);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Save edits made to a project (name, description, status, dates)
  const handleSaveProjectEdit = async (data: { name: string; description: string; start_at?: string; end_at?: string; status: string; link: string | null }) => {
    if (!editingProject) return;
    await api.updateProject(editingProject.id, {
      name: data.name,
      description: data.description || undefined,
      start_at: data.start_at,
      end_at: data.end_at,
      status: data.status as any,
      link: data.link,
    });
    setEditingProject(null);
    loadData();
    bumpProjectVersion();
  };

  // Delete a project (workspace admin only)
  const handleDeleteProject = async (project: Project) => {
    const ok = await confirm({
      title: `Supprimer le projet "${project.name}"`,
      message: 'Cette action est DÉFINITIVE.\n\nToutes les tâches de ce projet seront détruites définitivement.',
      confirmLabel: 'Supprimer définitivement',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteProject(project.id);
      loadData();
      bumpProjectVersion();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression du projet.');
    }
  };

  // Switch the app-wide current workspace, then jump to a given Settings tab
  const handleManageWorkspace = (workspaceId: string, tab: 'espaces' | 'projects' | 'members' | 'tags' = 'espaces') => {
    setCurrentWorkspaceId(workspaceId);
    setActiveTab(tab);
  };

  // Delete any workspace by id (admin of that workspace only — used from the
  // "Espaces" directory, not just the currently selected one)
  const handleDeleteWorkspaceById = async (workspaceId: string, workspaceName: string) => {
    const ok = await confirm({
      title: `Supprimer l'espace "${workspaceName}"`,
      message: 'Cette action est DÉFINITIVE.\n\nTous les projets, tâches et données associés seront détruits définitivement.',
      confirmLabel: 'Supprimer définitivement',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteWorkspace(workspaceId);
      await refreshWorkspaces();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de l'espace.");
    }
  };

  // Project members: open the panel and load its current roster
  const handleOpenProjectMembers = async (project: Project) => {
    setManagingProject(project);
    setAddProjectMemberUserId('');
    try {
      setLoadingProjectMembers(true);
      const list = await api.getProjectMembers(project.id);
      setProjectMembers(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProjectMembers(false);
    }
  };

  const handleAddProjectMember = async () => {
    if (!managingProject || !addProjectMemberUserId) return;
    try {
      await api.addProjectMember(managingProject.id, addProjectMemberUserId);
      setAddProjectMemberUserId('');
      handleOpenProjectMembers(managingProject);
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'ajout du membre au projet.");
    }
  };

  const handleRemoveProjectMember = async (userId: string) => {
    if (!managingProject) return;
    try {
      await api.removeProjectMember(managingProject.id, userId);
      handleOpenProjectMembers(managingProject);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du retrait du membre du projet.');
    }
  };

  // Update Workspace
  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !wsName.trim()) return;
    try {
      setIsUpdatingWs(true);
      await api.updateWorkspace(currentWorkspace.id, { name: wsName.trim(), color: wsColor });
      refreshWorkspaces();
      alert('Espace mis à jour avec succès !');
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingWs(false);
    }
  };

  // Delete Workspace
  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    const ok = await confirm({
      title: `Supprimer l'espace "${currentWorkspace.name}"`,
      message: `Cette action est DÉFINITIVE.\n\nTous les projets, tâches et données associés seront détruits définitivement.`,
      confirmLabel: 'Supprimer définitivement',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      setIsUpdatingWs(true);
      await api.deleteWorkspace(currentWorkspace.id);
      await refreshWorkspaces();
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de l'espace.");
    } finally {
      setIsUpdatingWs(false);
    }
  };

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const memberIds = new Set(members.map(m => m.user_id));
  const invitableUsers = allUsers.filter(u =>
    !memberIds.has(u.id) &&
    (u.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  const noWorkspaceNotice = (
    <div className="p-8 text-center text-slate-400 text-xs">
      Veuillez sélectionner un espace de travail pour gérer ses projets, membres, tags ou détails.
    </div>
  );

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5 animate-in fade-in duration-150 font-mono">
      <ConfirmDialog {...confirmProps} />
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#60A5FA] uppercase tracking-wider mb-1">
          <Settings className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Configuration & Gouvernance</span>
        </div>
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">
          {currentWorkspace ? `Paramètres — ${currentWorkspace.name}` : 'Paramètres'}
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Gérez vos espaces de travail, projets, membres, tags et votre profil.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1.5 border-b border-[#1E293B] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Mon Profil</span>
        </button>

        {canManageAnyWorkspace && (
          <button
            onClick={() => setActiveTab('espaces')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'espaces'
                ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Espaces ({workspaces.length})</span>
          </button>
        )}

        {isWorkspaceAdmin && currentWorkspace && (
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'projects'
                ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Projets ({projects.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Membres de l'Espace ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tags')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'tags'
              ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TagIcon className="w-3.5 h-3.5" />
          <span>Tags & Labels ({tags.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('all_users')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'all_users'
              ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Utilisateurs ({allUsers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'notifications'
              ? 'bg-[#2563EB]/20 text-[#60A5FA] border border-[#2563EB]/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BellRing className="w-3.5 h-3.5 text-[#3B82F6]" />
          <span>Sons & Alertes</span>
        </button>
      </div>

      {/* TAB: MY PROFILE (everyone, no workspace required) */}
      {activeTab === 'profile' && (
        <div className="max-w-lg space-y-4">
          {profileError && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-between">
              <span>{profileError}</span>
              <button onClick={() => setProfileError('')} className="text-rose-400 hover:text-white font-bold ml-2">×</button>
            </div>
          )}
          {profileSuccess && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between">
              <span>{profileSuccess}</span>
              <button onClick={() => setProfileSuccess('')} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
            </div>
          )}

          <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-3.5">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#3B82F6]" />
              <span>Mes informations personnelles</span>
            </h3>

            <div className="flex items-center gap-3 pb-1">
              <label className="relative cursor-pointer group">
                <Avatar name={profileName || user?.name} avatarUrl={user?.avatar_url} size="lg" />
                <div className="absolute inset-0 rounded bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-[9px] font-bold text-white uppercase">
                    {isUploadingAvatar ? '...' : 'Modifier'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={isUploadingAvatar}
                  className="hidden"
                />
              </label>
              <div className="text-[10px] text-slate-500">
                Cliquez sur la photo pour la changer.
                {user?.job_function && (
                  <p className="text-slate-400 font-semibold mt-0.5">Fonction : {user.job_function.name}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Adresse email</label>
                <input
                  type="email"
                  required
                  value={profileEmail}
                  onChange={e => setProfileEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all disabled:opacity-60"
                >
                  {isSavingProfile ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>

          <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-3.5">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#3B82F6]" />
              <span>Changer le mot de passe</span>
            </h3>

            {passwordError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    placeholder="6 caractères minimum"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Confirmer</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all disabled:opacity-60"
                >
                  {isChangingPassword ? 'Changement...' : 'Changer le mot de passe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: GLOBAL USERS ADMINISTRATION (ADMIN ONLY) */}
      {activeTab === 'all_users' && !isGlobalAdmin && (
        <div className="space-y-4">
          {/* Read-only directory: every member can see who works in the app,
              their function and whether they're currently online. */}
          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            <div className="p-3 border-b border-[#1E293B] bg-[#0B1120] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Répertoire des utilisateurs ({filteredUsers.length} / {allUsers.length})
                </h3>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="divide-y divide-[#1E293B]">
              {loadingUsers ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chargement des profils...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun profil trouvé correspondant à votre recherche.
                </div>
              ) : (
                filteredUsers.map(profile => {
                  const isCurrentSessionUser = profile.id === user?.id;
                  const online = isUserOnline(profile);

                  return (
                    <div key={profile.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1E293B]/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar user={profile} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {profile.name}
                            </span>
                            {isCurrentSessionUser && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] font-bold">
                                Vous
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">{profile.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                          <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                          {profile.job_function?.name || 'Aucune fonction'}
                        </span>

                        <span
                          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase px-2 py-1 rounded border ${
                            online
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {online ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'all_users' && isGlobalAdmin && (
        <div className="space-y-4">
          {/* Notification Alerts */}
          {userAdminError && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center justify-between">
              <span>{userAdminError}</span>
              <button onClick={() => setUserAdminError('')} className="text-rose-400 hover:text-white font-bold ml-2">×</button>
            </div>
          )}
          {userAdminSuccess && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-between">
              <span>{userAdminSuccess}</span>
              <button onClick={() => setUserAdminSuccess('')} className="text-emerald-400 hover:text-white font-bold ml-2">×</button>
            </div>
          )}

          {/* Add New Profile Card */}
          <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#3B82F6]" />
              <span>Créer un nouveau compte / profil utilisateur</span>
            </h3>
            <p className="text-xs text-slate-400">
              En tant qu'administrateur, vous pouvez enregistrer directement de nouveaux profils avec leur rôle système.
            </p>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              <div className="min-w-0">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Jean Dupont"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="jean@axetask.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mot de passe</label>
                <input
                  type="text"
                  placeholder="password123"
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50 font-mono"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Rôle global</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as 'admin' | 'member')}
                  className="w-full min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                >
                  <option value="member">Membre</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fonction</label>
                <select
                  value={newUserFunctionId}
                  onChange={e => setNewUserFunctionId(e.target.value)}
                  className="w-full min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                >
                  <option value="">Aucune</option>
                  {jobFunctions.map(fn => (
                    <option key={fn.id} value={fn.id}>{fn.name}</option>
                  ))}
                </select>
              </div>

              <div className="min-w-0 flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
                >
                  Créer le compte
                </button>
              </div>
            </form>
          </div>

          {/* Job Functions Card */}
          <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
              <span>Fonctions / Postes de l'entreprise</span>
            </h3>
            <p className="text-xs text-slate-400">
              Gérez la liste des fonctions assignables aux membres depuis le répertoire ci-dessous.
            </p>
            <div className="flex flex-wrap gap-2">
              {jobFunctions.map(fn => (
                <span
                  key={fn.id}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-slate-200"
                >
                  {fn.name}
                  <button
                    onClick={() => handleDeleteFunction(fn.id)}
                    className="text-slate-500 hover:text-rose-400"
                    title="Supprimer cette fonction"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleCreateFunction} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newFunctionName}
                onChange={e => setNewFunctionName(e.target.value)}
                placeholder="ex: Chef de projet"
                className="flex-1 max-w-xs px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] border border-[#1E293B] font-bold text-xs transition-colors"
              >
                Ajouter
              </button>
            </form>
          </div>

          {/* User Profiles Directory Table */}
          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            <div className="p-3 border-b border-[#1E293B] bg-[#0B1120] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Répertoire des profils ({filteredUsers.length} / {allUsers.length})
                </h3>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50 w-full sm:w-64"
                />
              </div>
            </div>

            <div className="divide-y divide-[#1E293B]">
              {loadingUsers ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chargement des profils...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun profil trouvé correspondant à votre recherche.
                </div>
              ) : (
                filteredUsers.map(profile => {
                  const isCurrentSessionUser = profile.id === user?.id;
                  const online = isUserOnline(profile);

                  return (
                    <div key={profile.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1E293B]/20 transition-colors">
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        <Avatar user={profile} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100">
                              {profile.name}
                            </span>
                            {isCurrentSessionUser && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2563EB]/20 border border-[#2563EB]/40 text-[#60A5FA] font-bold">
                                Vous (Session Active)
                              </span>
                            )}
                            <span
                              className={`flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                online
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-slate-500/10 border-slate-500/30 text-slate-400'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                              {online ? 'En ligne' : 'Hors ligne'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">{profile.email}</p>
                          {profile.created_at && (
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Controls & Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {/* Function selector — admin-only control; members cannot self-edit */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Fonction :</label>
                          <select
                            value={profile.function_id || ''}
                            onChange={e => handleAssignFunction(profile.id, e.target.value)}
                            className="px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-300 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                          >
                            <option value="">Aucune</option>
                            {jobFunctions.map(fn => (
                              <option key={fn.id} value={fn.id}>{fn.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Role selector */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-400 uppercase font-bold">Rôle :</label>
                          <select
                            disabled={isCurrentSessionUser}
                            value={profile.role}
                            onChange={e => handleUserRoleChange(profile.id, e.target.value as 'admin' | 'member')}
                            className="px-2.5 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-300 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="member">Membre</option>
                            <option value="admin">Administrateur</option>
                          </select>
                        </div>

                        {/* Delete Profile Button */}
                        {isCurrentSessionUser ? (
                          <span className="text-[10px] text-slate-500 italic px-2">
                            Protégé
                          </span>
                        ) : (
                          <button
                            onClick={() => setUserToDelete(profile)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 text-xs font-bold transition-colors"
                            title="Supprimer définitivement ce profil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: WORKSPACE MEMBERS MANAGEMENT */}
      {activeTab === 'members' && !currentWorkspace && noWorkspaceNotice}
      {activeTab === 'members' && currentWorkspace && (
        <div className="space-y-4">
          {/* Invite Form Card (Admin Only) */}
          {isWorkspaceAdmin ? (
            <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-2.5">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#3B82F6]" />
                <span>Inviter ou assigner un collaborateur dans cet espace</span>
              </h3>
              <p className="text-xs text-slate-400">
                L'utilisateur aura accès à tous les projets et tâches de <strong>{currentWorkspace.name}</strong>.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <input
                  type="text"
                  placeholder="Filtrer par nom ou email..."
                  value={inviteSearch}
                  onChange={e => setInviteSearch(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as WorkspaceRole)}
                  className="px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                >
                  <option value="member">Membre standard</option>
                  <option value="admin">Administrateur d'espace</option>
                </select>
              </div>

              <div className="max-h-72 overflow-y-auto rounded border border-[#1E293B] divide-y divide-[#1E293B]">
                {invitableUsers.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500">Tous les utilisateurs sont déjà membres de cet espace.</p>
                ) : invitableUsers.map(u => (
                  <div key={u.id} className="p-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar user={u} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-100 truncate">{u.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{u.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInviteMember(u)}
                      className="px-3 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all whitespace-nowrap"
                    >
                      Ajouter à l'espace
                    </button>
                  </div>
                ))}
              </div>

              {inviteError && (
                <p className="text-xs text-rose-400 mt-1 font-medium">{inviteError}</p>
              )}
              {inviteSuccess && (
                <p className="text-xs text-emerald-400 mt-1 font-medium">{inviteSuccess}</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded bg-[#0F172A] border border-[#1E293B] text-xs text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#3B82F6]" />
              <span>Seuls les administrateurs de cet espace peuvent inviter ou modifier les rôles.</span>
            </div>
          )}

          {/* Members List Box */}
          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            <div className="p-3 border-b border-[#1E293B] bg-[#0B1120]">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Collaborateurs de l'espace ({members.length})
              </h3>
            </div>

            <div className="divide-y divide-[#1E293B]">
              {members.map(member => (
                <div key={member.id} className="p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={member.user} size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100">
                          {member.user?.name}
                        </span>
                        {member.user_id === user?.id && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#090D16] border border-[#1E293B] text-slate-400 font-medium">
                            Vous
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">{member.user?.email}</p>
                      <p className="text-[11px] text-slate-500">
                        Fonction : <span className="text-slate-400 font-semibold">{member.user?.job_function?.name || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Role selector — workspace admins only; plain members
                        only ever see the read-only RoleBadge below. */}
                    {isWorkspaceAdmin && member.user_id !== user?.id ? (
                      <select
                        value={member.role}
                        onChange={e => handleRoleChange(member.id, e.target.value as WorkspaceRole)}
                        className="px-2 py-1 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-300 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                      >
                        <option value="member">Membre</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}

                    {/* Remove from workspace button */}
                    {isWorkspaceAdmin && member.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        title="Retirer cet utilisateur de l'espace"
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: TAGS MANAGEMENT */}
      {activeTab === 'tags' && !currentWorkspace && noWorkspaceNotice}
      {activeTab === 'tags' && currentWorkspace && (
        <div className="space-y-4">
          {/* Add Tag Card */}
          <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-2.5">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#3B82F6]" />
              <span>Créer un nouveau tag</span>
            </h3>

            <form onSubmit={handleCreateTag} className="flex flex-col sm:flex-row items-center gap-2.5">
              <input
                type="text"
                required
                placeholder="Nom du tag (ex: Bug, Marketing, Urgent, Backend)..."
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#2563EB]/50"
              />

              {/* Color Presets */}
              <div className="flex items-center gap-1.5 p-1 rounded bg-[#090D16] border border-[#1E293B]">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded transition-transform ${newTagColor === c ? 'scale-110 ring-2 ring-[#3B82F6]' : 'opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-colors whitespace-nowrap"
              >
                Créer le tag
              </button>
            </form>
          </div>

          {/* Tags list */}
          <div className="bg-[#0F172A] border border-[#1E293B] rounded p-4 space-y-2.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Tags existants dans {currentWorkspace.name}
            </h3>

            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-semibold group"
                  style={{
                    backgroundColor: `${tag.color}15`,
                    color: tag.color,
                    borderColor: `${tag.color}40`,
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors ml-1 opacity-60 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {tags.length === 0 && (
                <p className="text-xs text-slate-500 italic">Aucun tag créé pour l'instant.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ESPACES — directory of every accessible workspace + detail
          panel for whichever one is currently selected app-wide. */}
      {activeTab === 'espaces' && canManageAnyWorkspace && (
        <div className="space-y-4">
          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            <div className="p-3 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Tous les espaces ({workspaces.length})
              </h3>
              {isGlobalAdmin && (
                <button
                  onClick={() => setIsCreateWorkspaceModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouvel espace</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#1E293B]">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className={`p-3 flex items-center justify-between gap-3 transition-colors ${currentWorkspace?.id === ws.id ? 'bg-[#2563EB]/5' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: `${ws.color}20`, border: `1px solid ${ws.color}40` }}
                    >
                      {ws.photo_url ? (
                        <img src={ws.photo_url} alt={ws.name} className="w-full h-full object-cover" />
                      ) : (
                        <Briefcase className="w-4 h-4" style={{ color: ws.color }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">{ws.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {ws.member_count || 0} membre{(ws.member_count || 0) > 1 ? 's' : ''} · {ws.projects_count || 0} projet{(ws.projects_count || 0) > 1 ? 's' : ''} · {ws.my_role === 'admin' ? 'Admin' : 'Membre'}
                      </p>
                    </div>
                  </div>

                  {ws.my_role === 'admin' && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => handleManageWorkspace(ws.id, 'espaces')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] text-xs font-bold transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Gérer</span>
                      </button>
                      <button
                        onClick={() => handleManageWorkspace(ws.id, 'members')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] text-xs font-bold transition-colors"
                      >
                        <Users className="w-3 h-3" />
                        <span>Membres</span>
                      </button>
                      <button
                        onClick={() => handleManageWorkspace(ws.id, 'projects')}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] text-xs font-bold transition-colors"
                      >
                        <FolderGit2 className="w-3 h-3" />
                        <span>Projets</span>
                      </button>
                      <button
                        onClick={() => handleDeleteWorkspaceById(ws.id, ws.name)}
                        title="Supprimer cet espace"
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {workspaces.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucun espace de travail pour l'instant.
                </div>
              )}
            </div>
          </div>

          {/* Detail panel for the currently selected workspace */}
          {currentWorkspace && isWorkspaceAdmin ? (
            <>
              <form onSubmit={handleSaveWorkspace} className="space-y-4">
                <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>Modifier « {currentWorkspace.name} »</span>
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Photo de l'espace</label>
                    <label className="relative cursor-pointer group inline-block">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#1E293B] border border-[#2563EB]/30 flex items-center justify-center">
                        {currentWorkspace.photo_url ? (
                          <img src={currentWorkspace.photo_url} alt={currentWorkspace.name} className="w-full h-full object-cover" />
                        ) : (
                          <Briefcase className="w-6 h-6 text-[#93C5FD]" />
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-[9px] font-bold text-white uppercase">
                          {isUploadingWsPhoto ? '...' : 'Modifier'}
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleWorkspacePhotoChange}
                        disabled={isUploadingWsPhoto}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom de l'espace</label>
                    <input
                      type="text"
                      required
                      value={wsName}
                      onChange={e => setWsName(e.target.value)}
                      className="w-full sm:w-80 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs text-slate-200 focus:outline-none focus:border-[#2563EB]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Couleur thématique</label>
                    <div className="flex items-center gap-2">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setWsColor(c)}
                          className={`w-7 h-7 rounded transition-transform ${wsColor === c ? 'scale-110 ring-2 ring-[#3B82F6] shadow-sm' : 'opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isUpdatingWs}
                      className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all"
                    >
                      {isUpdatingWs ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Danger Zone */}
              <div className="p-5 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-4">
                <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wide flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Zone dangereuse
                </h3>
                <p className="text-xs text-rose-300/80 max-w-2xl leading-relaxed">
                  La suppression d'un espace de travail est définitive. Tous les projets, tâches, tags et membres qui y sont rattachés perdront accès à ces données, et elles seront détruites de manière permanente.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDeleteWorkspace}
                    disabled={isUpdatingWs}
                    className="px-4 py-2 rounded bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 hover:border-rose-500 font-bold text-xs shadow-sm transition-all"
                  >
                    Supprimer l'espace de travail
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 rounded bg-[#0F172A] border border-[#1E293B] text-xs text-slate-400">
              Cliquez sur « Gérer » sur un espace ci-dessus pour modifier ses détails.
            </div>
          )}
        </div>
      )}

      {/* TAB: PROJETS (of the currently selected workspace) */}
      {activeTab === 'projects' && !currentWorkspace && noWorkspaceNotice}
      {activeTab === 'projects' && currentWorkspace && (
        <div className="space-y-4">
          <EditProjectModal
            isOpen={!!editingProject}
            initialName={editingProject?.name || ''}
            initialDescription={editingProject?.description || ''}
            initialStartAt={editingProject?.start_at || null}
            initialEndAt={editingProject?.end_at || null}
            initialStatus={editingProject?.status || 'active'}
            initialLink={editingProject?.link}
            onSave={handleSaveProjectEdit}
            onClose={() => setEditingProject(null)}
          />

          <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
            <div className="p-3 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Projets de {currentWorkspace.name} ({projects.length})
              </h3>
              {isWorkspaceAdmin && (
                <button
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau projet</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#1E293B]">
              {loadingProjects ? (
                <div className="p-6 text-center text-xs text-slate-400">Chargement des projets...</div>
              ) : projects.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">Aucun projet dans cet espace pour l'instant.</div>
              ) : (
                projects.map(prj => (
                  <div key={prj.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderGit2 className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-100 truncate">{prj.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {prj.tasks_count || 0} tâche{(prj.tasks_count || 0) > 1 ? 's' : ''} · {prj.completed_tasks_count || 0} terminée{(prj.completed_tasks_count || 0) > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {isWorkspaceAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenProjectMembers(prj)}
                          title="Gérer les membres du projet"
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#334155] text-[#60A5FA] text-xs font-bold transition-colors"
                        >
                          <Users className="w-3 h-3" />
                          <span className="hidden sm:inline">Membres</span>
                        </button>
                        <button
                          onClick={() => setEditingProject(prj)}
                          title="Modifier le projet"
                          className="p-1.5 rounded text-slate-400 hover:text-[#60A5FA] hover:bg-[#1E293B] transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(prj)}
                          title="Supprimer le projet"
                          className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Project members panel — add/remove members on the project
              selected via the "Membres" button above */}
          {managingProject && (
            <div className="bg-[#0F172A] border border-[#1E293B] rounded overflow-hidden">
              <div className="p-3 border-b border-[#1E293B] bg-[#0B1120] flex items-center justify-between gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate">
                  Membres du projet « {managingProject.name} » ({projectMembers.length})
                </h3>
                <button
                  onClick={() => setManagingProject(null)}
                  className="px-2 py-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors shrink-0 text-xs font-bold"
                >
                  Fermer
                </button>
              </div>

              <div className="p-3 border-b border-[#1E293B] flex flex-col sm:flex-row gap-2">
                <select
                  value={addProjectMemberUserId}
                  onChange={e => setAddProjectMemberUserId(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded bg-[#090D16] border border-[#1E293B] text-xs font-semibold text-slate-200 focus:outline-none focus:border-[#2563EB]/50 cursor-pointer"
                >
                  <option value="">Sélectionner un membre de l'espace...</option>
                  {members
                    .filter(m => !projectMembers.some(pm => pm.user_id === m.user_id))
                    .map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user?.name || m.user?.email}</option>
                    ))}
                </select>
                <button
                  onClick={handleAddProjectMember}
                  disabled={!addProjectMemberUserId}
                  className="px-4 py-1.5 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Ajouter au projet
                </button>
              </div>

              <div className="divide-y divide-[#1E293B]">
                {loadingProjectMembers ? (
                  <div className="p-6 text-center text-xs text-slate-400">Chargement...</div>
                ) : projectMembers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Aucun membre assigné à ce projet pour l'instant.</div>
                ) : (
                  projectMembers.map(pm => (
                    <div key={pm.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar user={pm.user} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-100 truncate">{pm.user?.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{pm.user?.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveProjectMember(pm.user_id)}
                        title="Retirer du projet"
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SONS & ALERTES (AUDIO ENGINE & NOTIFICATIONS) */}
      {activeTab === 'notifications' && (
        <div className="p-5 rounded-xl bg-[#0F172A] border border-[#1E293B] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Son des notifications</h3>
              <p className="text-xs text-slate-400 mt-0.5">Touche un son pour l'écouter et le choisir.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleSound(!soundEnabled)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 ${
                soundEnabled ? 'bg-[#2563EB] text-white' : 'bg-[#1E293B] text-slate-400 hover:text-slate-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Activé' : 'Désactivé'}</span>
            </button>
          </div>

          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${soundEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
            {SOUND_TYPES.map(id => {
              const isSelected = soundType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => { selectSoundType(id); playTestSound(id); }}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-left text-xs font-semibold transition-all ${
                    isSelected ? 'border-[#2563EB] bg-[#2563EB]/15 text-white' : 'border-[#1E293B] text-slate-300 hover:border-[#334155]'
                  }`}
                >
                  <span className="flex items-center gap-2"><Play className="w-3 h-3 text-[#3B82F6] fill-current" />{SOUND_LABELS[id]}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#60A5FA]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE USER MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-rose-500/40 rounded-lg p-5 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wide">
                Suppression définitive de profil
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le compte utilisateur de{' '}
              <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email}) ?
            </p>

            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
              ⚠️ Cette action est irréversible. Toutes ses assignations et accès seront automatiquement désolidarisés.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-3.5 py-1.5 rounded bg-[#1E293B] hover:bg-[#334155] text-slate-300 text-xs font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                disabled={isDeletingUser}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-600/30 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'Suppression...' : 'Confirmer la suppression'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
