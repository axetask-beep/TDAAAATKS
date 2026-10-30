import {
  User,
  Workspace,
  WorkspaceMember,
  ProjectMember,
  Project,
  Task,
  Subtask,
  Comment,
  Attachment,
  TimeEntry,
  Tag,
  TaskStatus,
  TaskPriority,
  Conversation,
  Message,
  AppNotification,
  JobFunction,
  TimeAllocationWorkspace,
  Announcement,
  Report,
  ActivityLog
} from '../types';
import type { Scope } from './insights';

const TOKEN_KEY = 'axetask_jwt_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeStoredToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const isAuthEndpoint = url.startsWith('/api/auth/login') || url.startsWith('/api/auth/signup');
    
    // Only treat 401 as an expired session for authenticated routes (not login/signup)
    if (response.status === 401 && !isAuthEndpoint) {
      removeStoredToken();
      window.dispatchEvent(new Event('auth_expired'));
      throw new Error(data.error || 'Votre session a expiré. Veuillez vous reconnecter.');
    }

    throw new Error(data.error || `Erreur de communication (${response.status})`);
  }

  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchWithAuth<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  signup: (name: string, email: string, password: string) =>
    fetchWithAuth<{ user: User; token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  getMe: () => fetchWithAuth<{ user: User }>('/api/auth/me'),

  updateProfile: (name: string, email?: string, avatar_url?: string) =>
    fetchWithAuth<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email, avatar_url }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    fetchWithAuth<{ success: boolean }>('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    }),

  getUsers: () => fetchWithAuth<User[]>('/api/users'),

  createUser: (data: { name: string; email: string; password?: string; role?: 'admin' | 'member'; function_id?: string | null }) =>
    fetchWithAuth<{ user: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUserRole: (userId: string, role: 'admin' | 'member') =>
    fetchWithAuth<{ user: User }>(`/api/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  deleteUser: (userId: string) =>
    fetchWithAuth<{ success: boolean; message?: string }>(`/api/users/${userId}`, {
      method: 'DELETE',
    }),

  // Workspaces
  getWorkspaces: () => fetchWithAuth<Workspace[]>('/api/workspaces'),

  createWorkspace: (data: { name: string; color?: string; icon?: string; photo_url?: string } | string, color?: string, icon?: string) => {
    const payload = typeof data === 'string'
      ? { name: data, color: color || '#F59E0B', icon: icon || 'Briefcase' }
      : { name: data.name, color: data.color || '#F59E0B', icon: data.icon || 'Briefcase', photo_url: data.photo_url };
    return fetchWithAuth<Workspace>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateWorkspace: (id: string, updates: Partial<Workspace>) =>
    fetchWithAuth<Workspace>(`/api/workspaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteWorkspace: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/workspaces/${id}`, {
      method: 'DELETE',
    }),

  // Workspace Members
  getWorkspaceMembers: (workspaceId: string) =>
    fetchWithAuth<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`),

  addWorkspaceMember: (workspaceId: string, emailOrUserId: string, role: 'admin' | 'member' = 'member') =>
    fetchWithAuth<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(
        emailOrUserId.includes('@')
          ? { email: emailOrUserId, role }
          : { user_id: emailOrUserId, role }
      ),
    }),

  updateWorkspaceMember: (memberId: string, role: 'admin' | 'member') =>
    fetchWithAuth<WorkspaceMember>(`/api/workspace-members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  removeWorkspaceMember: (memberId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/workspace-members/${memberId}`, {
      method: 'DELETE',
    }),

  // Workspace Tags
  getWorkspaceTags: (workspaceId: string) =>
    fetchWithAuth<Tag[]>(`/api/workspaces/${workspaceId}/tags`),

  createWorkspaceTag: (workspaceId: string, name: string, color: string) =>
    fetchWithAuth<Tag>(`/api/workspaces/${workspaceId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  deleteWorkspaceTag: (tagId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/tags/${tagId}`, {
      method: 'DELETE',
    }),

  // Projects
  getWorkspaceProjects: (workspaceId: string) =>
    fetchWithAuth<Project[]>(`/api/workspaces/${workspaceId}/projects`),

  getProject: (projectId: string) =>
    fetchWithAuth<Project>(`/api/projects/${projectId}`),

  createProject: (workspaceId: string, data: { name: string; description?: string; start_at?: string; end_at?: string; status?: string; link?: string }) =>
    fetchWithAuth<Project>(`/api/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProject: (projectId: string, updates: Partial<Project>) =>
    fetchWithAuth<Project>(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteProject: (projectId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

  // Project Members
  getProjectMembers: (projectId: string) =>
    fetchWithAuth<ProjectMember[]>(`/api/projects/${projectId}/members`),

  addProjectMember: (projectId: string, userId: string) =>
    fetchWithAuth<ProjectMember>(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  removeProjectMember: (projectId: string, userId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Tasks
  getProjectTasks: (projectId: string) =>
    fetchWithAuth<Task[]>(`/api/projects/${projectId}/tasks`),

  getDashboardTasks: () =>
    fetchWithAuth<Task[]>('/api/tasks/dashboard'),

  getTask: (taskId: string) =>
    fetchWithAuth<Task>(`/api/tasks/${taskId}`),

  createTask: (projectId: string, data: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignee_id?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    estimated_minutes?: number | null;
    tag_ids?: string[];
  }) =>
    fetchWithAuth<Task>(`/api/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTask: (taskId: string, updates: Partial<Task> & { tag_ids?: string[] }) =>
    fetchWithAuth<Task>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  reorderTasks: (items: { id: string; status: TaskStatus; position: number }[]) =>
    fetchWithAuth<{ success: boolean }>('/api/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  deleteTask: (taskId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  // Subtasks
  addSubtask: (taskId: string, title: string) =>
    fetchWithAuth<Subtask>(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  updateSubtask: (subtaskId: string, updates: Partial<Subtask>) =>
    fetchWithAuth<Subtask>(`/api/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteSubtask: (subtaskId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/subtasks/${subtaskId}`, {
      method: 'DELETE',
    }),

  // Comments
  addComment: (taskId: string, content: string) =>
    fetchWithAuth<Comment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (commentId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    }),

  // Attachments
  addAttachment: (taskId: string, data: { file_name: string; file_url: string; file_size?: number; file_type?: string }) =>
    fetchWithAuth<Attachment>(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAttachment: (attachmentId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  // Time Entries
  logTime: (taskId: string, duration_minutes: number, note?: string, date?: string) =>
    fetchWithAuth<TimeEntry>(`/api/tasks/${taskId}/time-entries`, {
      method: 'POST',
      body: JSON.stringify({ duration_minutes, note, date }),
    }),

  deleteTimeEntry: (entryId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/time-entries/${entryId}`, {
      method: 'DELETE',
    }),

  getTimeEntries: (params?: { workspace_id?: string; project_id?: string; user_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.workspace_id) query.set('workspace_id', params.workspace_id);
    if (params?.project_id) query.set('project_id', params.project_id);
    if (params?.user_id) query.set('user_id', params.user_id);
    const qs = query.toString();
    return fetchWithAuth<TimeEntry[]>(`/api/time-entries${qs ? `?${qs}` : ''}`);
  },

  // Time Allocation ("Mon Temps")
  getMyTimeAllocation: () => fetchWithAuth<TimeAllocationWorkspace[]>('/api/time/allocation'),

  getAllMembersTimeAllocation: () =>
    fetchWithAuth<{ user: User; workspaces: TimeAllocationWorkspace[] }[]>('/api/time/allocation/all'),

  // Job Functions
  getJobFunctions: () => fetchWithAuth<JobFunction[]>('/api/job-functions'),

  createJobFunction: (name: string) =>
    fetchWithAuth<JobFunction>('/api/job-functions', { method: 'POST', body: JSON.stringify({ name }) }),

  deleteJobFunction: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/job-functions/${id}`, { method: 'DELETE' }),

  setUserFunction: (userId: string, functionId: string | null) =>
    fetchWithAuth<{ user: User }>(`/api/users/${userId}/function`, {
      method: 'PATCH',
      body: JSON.stringify({ function_id: functionId }),
    }),

  // Messaging
  getConversations: () => fetchWithAuth<Conversation[]>('/api/conversations'),

  startConversation: (userId: string) =>
    fetchWithAuth<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  getMessages: (conversationId: string, before?: string) => {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    return fetchWithAuth<Message[]>(`/api/conversations/${conversationId}/messages${qs}`);
  },

  sendMessage: (conversationId: string, content: string, replyToId?: string | null) =>
    fetchWithAuth<Message>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, reply_to_id: replyToId }),
    }),

  markConversationRead: (conversationId: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
    }),

  // Activity log (global admins only)
  getActivityLogs: (params: { q?: string; userId?: string; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.userId) qs.set('user_id', params.userId);
    if (params.offset) qs.set('offset', String(params.offset));
    const s = qs.toString();
    return fetchWithAuth<ActivityLog[]>(`/api/activity${s ? `?${s}` : ''}`);
  },

  // Announcements
  getReports: () => fetchWithAuth<Report[]>('/api/reports'),
  getReportFile: (id: string) => fetchWithAuth<{ file_name: string; file_data: string }>(`/api/reports/${id}`),
  uploadReport: (data: { file_name: string; file_data: string; file_size?: number; file_type?: string }) =>
    fetchWithAuth<{ id: string }>('/api/reports', { method: 'POST', body: JSON.stringify(data) }),
  deleteReport: (id: string) => fetchWithAuth<{ success: boolean }>(`/api/reports/${id}`, { method: 'DELETE' }),

  getAnnouncements: (search?: string) => {
    const qs = search?.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
    return fetchWithAuth<Announcement[]>(`/api/announcements${qs}`);
  },

  createAnnouncement: (title: string, content: string) =>
    fetchWithAuth<Announcement>('/api/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),

  deleteAnnouncement: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/announcements/${id}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: () => fetchWithAuth<AppNotification[]>('/api/notifications'),

  getUnreadNotificationCount: () => fetchWithAuth<{ count: number }>('/api/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),

  markAllNotificationsRead: () =>
    fetchWithAuth<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  deleteNotification: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }),

  clearAllNotifications: () =>
    fetchWithAuth<{ success: boolean }>('/api/notifications', { method: 'DELETE' }),

  // Command Center / AXP
  getInsightsScope: () => fetchWithAuth<Scope>('/api/insights/scope'),

  search: (q: string) =>
    fetchWithAuth<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`),

  getXpSummary: () => fetchWithAuth<XpSummary>('/api/xp/me'),

  getLeaderboards: (days: number) => fetchWithAuth<Leaderboards>(`/api/xp/leaderboard?days=${days}`),

  setLeaderboardVisibility: (show_in_leaderboard: boolean) =>
    fetchWithAuth<{ success: boolean }>('/api/xp/privacy', { method: 'PATCH', body: JSON.stringify({ show_in_leaderboard }) }),

  giveKudos: (to_user_id: string, message: string, task_id?: string | null) =>
    fetchWithAuth<unknown>('/api/xp/kudos', { method: 'POST', body: JSON.stringify({ to_user_id, message, task_id }) }),

  addXpCorrection: (user_id: string, points: number, reason: string) =>
    fetchWithAuth<unknown>('/api/xp/corrections', { method: 'POST', body: JSON.stringify({ user_id, points, reason }) }),

  getChallenges: () => fetchWithAuth<Challenge[]>('/api/challenges'),

  createChallenge: (data: { workspace_id: string; title: string; metric: string; target: number; reward?: string; start_at: string; end_at: string }) =>
    fetchWithAuth<unknown>('/api/challenges', { method: 'POST', body: JSON.stringify(data) }),

  deleteChallenge: (id: string) =>
    fetchWithAuth<{ success: boolean }>(`/api/challenges/${id}`, { method: 'DELETE' }),
};

export interface SearchResults {
  tasks: { id: string; title: string; status: string; project_id: string; project_name: string; workspace_id: string }[];
  projects: { id: string; name: string; workspace_id: string }[];
}

export interface XpSummary {
  total: number;
  level: { level: number; name: string; min: number; next: { level: number; name: string; min: number } | null; progress: number; toNext: number };
  streak: { current: number; best: number };
  badges: { id: string; name: string; rule: string; earned: boolean; progress: [number, number] }[];
  weekly: { key: string; value: number }[];
  period: { last30: number; prev30: number };
  today: { blockersResolved: number; earned: number };
  show_in_leaderboard: boolean;
  validated_this_week: number;
  events: { id: string; kind: string; points: number; reason: string | null; task_id: string | null; revoked: boolean; revoked_reason: string | null; created_at: string }[];
}

export interface Leaderboards {
  teams: { id: string; name: string; color: string; xp: number; validated: number; blockers: number; members: number }[];
  people: { id: string; name: string; avatar_url: string | null; xp: number; validated: number; blockers: number }[];
  recognitions: { id: string; reason: string; created_at: string; task_id: string | null; task_title: string | null; to_id: string; to_name: string; from_id: string | null; from_name: string | null }[];
}

export interface Challenge {
  id: string; workspace_id: string; title: string; metric: string; metric_label: string; unit: string; target: number;
  baseline: number | null; reward: string | null; start_at: string; end_at: string; value: number; detail: string;
  success: boolean; state: 'a_venir' | 'en_cours' | 'termine';
}
