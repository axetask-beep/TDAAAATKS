import { eq, and, desc, asc, inArray, ne, isNull, sql, ilike } from 'drizzle-orm';
import { db } from './index.ts';
import * as schema from './schema.ts';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import webpush from 'web-push';
import { initializeApp as initFirebaseAdmin, cert, getApps as getFirebaseApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { onTaskStatusChange, revokeTaskEvents, onProjectCompleted } from './gamification.ts';
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
  Report,
  TimeEntry,
  Tag,
  TaskStatus,
  TaskPriority,
  WorkspaceMemberRole,
  Conversation,
  Message,
  AppNotification,
  NotificationType,
  Announcement,
  TimeAllocationTask,
  TimeAllocationProject,
  TimeAllocationWorkspace,
  ActivityLog
} from '../types.ts';

function generateId(prefix: string = ''): string {
  return prefix ? `${prefix}_${crypto.randomBytes(8).toString('hex')}` : crypto.randomUUID();
}

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

// Legacy unsalted SHA-256 hashes (pre-bcrypt migration) are 64 hex chars.
function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false;
  if (isLegacySha256Hash(hash)) {
    return crypto.createHash('sha256').update(password).digest('hex') === hash;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

// ----------------- USERS -----------------

export async function getAllUsers(): Promise<User[]> {
  try {
    const rows = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      avatar_url: schema.users.avatar_url,
      function_id: schema.users.function_id,
      last_seen_at: schema.users.last_seen_at,
      created_at: schema.users.created_at,
    }).from(schema.users);

    const functions = await db.select().from(schema.jobFunctions);

    return rows.map(r => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role as 'admin' | 'member',
      avatar_url: r.avatar_url || undefined,
      function_id: r.function_id,
      job_function: r.function_id ? functions.find(f => f.id === r.function_id) || null : null,
      last_seen_at: r.last_seen_at ? r.last_seen_at.toISOString() : null,
      created_at: r.created_at ? r.created_at.toISOString() : undefined,
    }));
  } catch (error) {
    console.error('Failed to get users:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserById(id: string) {
  try {
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get user by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserByEmail(email: string) {
  try {
    const rows = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim())).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get user by email:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  try {
    const id = generateId('usr');
    const password_hash = hashPassword(password);
    const [created] = await db.insert(schema.users).values({
      id,
      uid: id,
      email: email.toLowerCase().trim(),
      name,
      role: 'member',
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563EB`,
      password_hash,
    }).returning();

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role as 'admin' | 'member',
      avatar_url: created.avatar_url || undefined,
      created_at: created.created_at ? created.created_at.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Failed to create user:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserProfile(id: string, updates: { name?: string; avatar_url?: string; email?: string }): Promise<User> {
  try {
    const [updated] = await db.update(schema.users)
      .set({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.avatar_url !== undefined ? { avatar_url: updates.avatar_url } : {}),
        ...(updates.email ? { email: updates.email.toLowerCase().trim() } : {}),
      })
      .where(eq(schema.users.id, id))
      .returning();

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as 'admin' | 'member',
      avatar_url: updated.avatar_url || undefined,
      created_at: updated.created_at ? updated.created_at.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function changeUserPassword(id: string, newPassword: string): Promise<void> {
  try {
    const password_hash = hashPassword(newPassword);
    await db.update(schema.users)
      .set({ password_hash })
      .where(eq(schema.users.id, id));
  } catch (error) {
    console.error('Failed to change user password:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateUserRole(id: string, role: 'admin' | 'member'): Promise<User> {
  try {
    const [updated] = await db.update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, id))
      .returning();

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as 'admin' | 'member',
      avatar_url: updated.avatar_url || undefined,
      created_at: updated.created_at ? updated.created_at.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createUserWithRole(email: string, password: string, name: string, role: 'admin' | 'member' = 'member', functionId?: string | null): Promise<User> {
  try {
    const id = generateId('usr');
    const password_hash = hashPassword(password);
    const [created] = await db.insert(schema.users).values({
      id,
      uid: id,
      email: email.toLowerCase().trim(),
      name,
      role,
      function_id: functionId || null,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563EB`,
      password_hash,
    }).returning();

    const jobFunction = created.function_id
      ? (await db.select().from(schema.jobFunctions).where(eq(schema.jobFunctions.id, created.function_id)).limit(1))[0]
      : undefined;

    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role as 'admin' | 'member',
      avatar_url: created.avatar_url || undefined,
      function_id: created.function_id,
      job_function: jobFunction ? { id: jobFunction.id, name: jobFunction.name } : null,
      created_at: created.created_at ? created.created_at.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Failed to create user with role:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    // 1. Nullify created_by on workspaces
    await db.update(schema.workspaces)
      .set({ created_by: null })
      .where(eq(schema.workspaces.created_by, id));

    // 1b. Nullify created_by on announcements (keep the announcement, drop the authorship)
    await db.update(schema.announcements)
      .set({ created_by: null })
      .where(eq(schema.announcements.created_by, id));

    // 2. Nullify created_by and assignee_id on tasks
    await db.update(schema.tasks)
      .set({ created_by: null })
      .where(eq(schema.tasks.created_by, id));

    await db.update(schema.tasks)
      .set({ assignee_id: null })
      .where(eq(schema.tasks.assignee_id, id));

    // 3. Delete comments by this user
    await db.delete(schema.comments).where(eq(schema.comments.user_id, id));

    // 4. Delete attachments uploaded by this user
    await db.delete(schema.attachments).where(eq(schema.attachments.user_id, id));

    // 5. Delete time entries logged by this user
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.user_id, id));

    // 6. Delete all workspace memberships for this user
    await db.delete(schema.workspaceMembers).where(eq(schema.workspaceMembers.user_id, id));

    // 7. Delete messages sent by this user, then their conversation memberships
    await db.delete(schema.messages).where(eq(schema.messages.sender_id, id));
    await db.delete(schema.conversationParticipants).where(eq(schema.conversationParticipants.user_id, id));

    // 8. Delete the user record
    await db.delete(schema.users).where(eq(schema.users.id, id));

    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function touchUserLastSeen(userId: string): Promise<void> {
  try {
    await db.update(schema.users).set({ last_seen_at: new Date() }).where(eq(schema.users.id, userId));
  } catch (error) {
    console.error('Failed to touch user last_seen_at:', error);
  }
}

// ----------------- JOB FUNCTIONS -----------------

export async function getJobFunctions(): Promise<{ id: string; name: string }[]> {
  try {
    const rows = await db.select().from(schema.jobFunctions).orderBy(asc(schema.jobFunctions.created_at));
    return rows.map(r => ({ id: r.id, name: r.name }));
  } catch (error) {
    console.error('Failed to get job functions:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createJobFunction(name: string): Promise<{ id: string; name: string }> {
  try {
    const [created] = await db.insert(schema.jobFunctions).values({ id: generateId('jf'), name }).returning();
    return { id: created.id, name: created.name };
  } catch (error) {
    console.error('Failed to create job function:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteJobFunction(id: string): Promise<boolean> {
  try {
    await db.delete(schema.jobFunctions).where(eq(schema.jobFunctions.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete job function:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function setUserFunction(userId: string, functionId: string | null): Promise<User> {
  try {
    const [updated] = await db.update(schema.users)
      .set({ function_id: functionId })
      .where(eq(schema.users.id, userId))
      .returning();

    const functions = functionId ? await db.select().from(schema.jobFunctions).where(eq(schema.jobFunctions.id, functionId)).limit(1) : [];

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as 'admin' | 'member',
      avatar_url: updated.avatar_url || undefined,
      function_id: updated.function_id,
      job_function: functions[0] ? { id: functions[0].id, name: functions[0].name } : null,
      created_at: updated.created_at ? updated.created_at.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Failed to set user function:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- WORKSPACES -----------------

export async function getUserWorkspaces(userId: string, isGlobalAdmin: boolean = false): Promise<Workspace[]> {
  try {
    let wsList: typeof schema.workspaces.$inferSelect[] = [];
    let memberships: typeof schema.workspaceMembers.$inferSelect[] = [];

    if (isGlobalAdmin) {
      wsList = await db.select().from(schema.workspaces);
      memberships = await db.select().from(schema.workspaceMembers);
    } else {
      memberships = await db.select().from(schema.workspaceMembers).where(eq(schema.workspaceMembers.user_id, userId));
      const wsIds = memberships.map(m => m.workspace_id);
      if (wsIds.length === 0) return [];
      wsList = await db.select().from(schema.workspaces).where(inArray(schema.workspaces.id, wsIds));
    }

    const allProjects = await db.select().from(schema.projects);
    const allTasks = await db.select().from(schema.tasks);
    const allMembers = await db.select().from(schema.workspaceMembers);

    return wsList.map(ws => {
      const wsMembers = allMembers.filter(m => m.workspace_id === ws.id);
      const wsProjects = allProjects.filter(p => p.workspace_id === ws.id);
      const projectIds = wsProjects.map(p => p.id);
      const wsTasks = allTasks.filter(t => projectIds.includes(t.project_id));
      
      const userMembership = wsMembers.find(m => m.user_id === userId);
      const myRole: WorkspaceMemberRole = isGlobalAdmin ? 'admin' : (userMembership?.role as WorkspaceMemberRole || 'member');

      return {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        photo_url: ws.photo_url,
        created_at: ws.created_at ? ws.created_at.toISOString() : new Date().toISOString(),
        member_count: wsMembers.length,
        projects_count: wsProjects.length,
        total_tasks_count: wsTasks.length,
        active_tasks_count: wsTasks.filter(t => t.status !== 'termine').length,
        completed_tasks_count: wsTasks.filter(t => t.status === 'termine').length,
        my_role: myRole,
      };
    });
  } catch (error) {
    console.error('Failed to get user workspaces:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  try {
    const rows = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, id)).limit(1);
    const ws = rows[0];
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      icon: ws.icon,
      photo_url: ws.photo_url,
      created_at: ws.created_at ? ws.created_at.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to get workspace by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createWorkspace(name: string, color: string = '#2563EB', icon: string = 'Briefcase', creatorId: string, photoUrl?: string): Promise<Workspace> {
  try {
    const id = generateId('ws');
    const [ws] = await db.insert(schema.workspaces).values({
      id,
      name,
      color,
      icon,
      photo_url: photoUrl || null,
      created_by: creatorId,
    }).returning();

    // Add creator as workspace admin
    await db.insert(schema.workspaceMembers).values({
      id: generateId('wm'),
      workspace_id: id,
      user_id: creatorId,
      role: 'admin',
    });

    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      icon: ws.icon,
      photo_url: ws.photo_url,
      created_at: ws.created_at ? ws.created_at.toISOString() : new Date().toISOString(),
      member_count: 1,
      projects_count: 0,
      total_tasks_count: 0,
      active_tasks_count: 0,
      completed_tasks_count: 0,
      my_role: 'admin',
    };
  } catch (error) {
    console.error('Failed to create workspace:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateWorkspace(id: string, updates: Partial<{ name: string; color: string; icon: string; photo_url: string | null }>): Promise<Workspace | null> {
  try {
    const [updated] = await db.update(schema.workspaces)
      .set({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.color ? { color: updates.color } : {}),
        ...(updates.icon ? { icon: updates.icon } : {}),
        ...(updates.photo_url !== undefined ? { photo_url: updates.photo_url } : {}),
      })
      .where(eq(schema.workspaces.id, id))
      .returning();

    if (!updated) return null;
    return {
      id: updated.id,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      photo_url: updated.photo_url,
      created_at: updated.created_at ? updated.created_at.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to update workspace:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  try {
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- WORKSPACE MEMBERS -----------------

export async function userCanAccessWorkspace(userId: string, workspaceId: string, isGlobalAdmin: boolean = false): Promise<boolean> {
  if (isGlobalAdmin) return true;
  try {
    const rows = await db.select().from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspace_id, workspaceId), eq(schema.workspaceMembers.user_id, userId)))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check workspace access:', error);
    return false;
  }
}

export async function userIsWorkspaceAdmin(userId: string, workspaceId: string, isGlobalAdmin: boolean = false): Promise<boolean> {
  if (isGlobalAdmin) return true;
  try {
    const rows = await db.select().from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspace_id, workspaceId), eq(schema.workspaceMembers.user_id, userId), eq(schema.workspaceMembers.role, 'admin')))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check workspace admin:', error);
    return false;
  }
}

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  try {
    const members = await db.select().from(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.workspace_id, workspaceId));

    const allUsers = await getAllUsers();

    return members.map(m => {
      const u = allUsers.find(user => user.id === m.user_id);
      return {
        id: m.id,
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        role: m.role as WorkspaceMemberRole,
        joined_at: m.joined_at ? m.joined_at.toISOString() : new Date().toISOString(),
        user: u,
      };
    });
  } catch (error) {
    console.error('Failed to get workspace members:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function addWorkspaceMember(workspaceId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<WorkspaceMember> {
  try {
    const existing = await db.select().from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspace_id, workspaceId), eq(schema.workspaceMembers.user_id, userId)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(schema.workspaceMembers)
        .set({ role })
        .where(eq(schema.workspaceMembers.id, existing[0].id))
        .returning();
      const u = await getUserById(userId);
      return {
        id: updated.id,
        workspace_id: updated.workspace_id,
        user_id: updated.user_id,
        role: updated.role as WorkspaceMemberRole,
        joined_at: updated.joined_at ? updated.joined_at.toISOString() : new Date().toISOString(),
        user: u ? {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role as 'admin' | 'member',
          avatar_url: u.avatar_url || undefined,
        } : undefined,
      };
    }

    const [created] = await db.insert(schema.workspaceMembers).values({
      id: generateId('wm'),
      workspace_id: workspaceId,
      user_id: userId,
      role,
    }).returning();

    const u = await getUserById(userId);

    return {
      id: created.id,
      workspace_id: created.workspace_id,
      user_id: created.user_id,
      role: created.role as WorkspaceMemberRole,
      joined_at: created.joined_at ? created.joined_at.toISOString() : new Date().toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to add workspace member:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Assigning a task to someone lets the assignee picker list every platform
// user, not just existing workspace members — so that a fresh assignment
// actually grants access (and shows up on their dashboard), silently add
// them to the workspace as a regular member if they aren't already in it.
// A no-op when they're already a member (whatever their role there).
export async function ensureWorkspaceMembership(workspaceId: string, userId: string): Promise<void> {
  try {
    const existing = await db.select({ id: schema.workspaceMembers.id }).from(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspace_id, workspaceId), eq(schema.workspaceMembers.user_id, userId)))
      .limit(1);
    if (existing.length === 0) {
      await addWorkspaceMember(workspaceId, userId, 'member');
    }
  } catch (error) {
    console.error('Failed to ensure workspace membership:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function removeWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
  try {
    await db.delete(schema.workspaceMembers)
      .where(and(eq(schema.workspaceMembers.workspace_id, workspaceId), eq(schema.workspaceMembers.user_id, userId)));
    return true;
  } catch (error) {
    console.error('Failed to remove workspace member:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getWorkspaceMemberById(memberId: string): Promise<{ id: string; workspace_id: string; user_id: string } | null> {
  try {
    const rows = await db.select({
      id: schema.workspaceMembers.id,
      workspace_id: schema.workspaceMembers.workspace_id,
      user_id: schema.workspaceMembers.user_id,
    }).from(schema.workspaceMembers).where(eq(schema.workspaceMembers.id, memberId)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get workspace member by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateWorkspaceMemberById(memberId: string, role: 'admin' | 'member'): Promise<WorkspaceMember | null> {
  try {
    const [updated] = await db.update(schema.workspaceMembers)
      .set({ role })
      .where(eq(schema.workspaceMembers.id, memberId))
      .returning();

    if (!updated) return null;
    const u = await getUserById(updated.user_id);
    return {
      id: updated.id,
      workspace_id: updated.workspace_id,
      user_id: updated.user_id,
      role: updated.role as WorkspaceMemberRole,
      joined_at: updated.joined_at ? updated.joined_at.toISOString() : new Date().toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to update workspace member by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function removeWorkspaceMemberById(memberId: string): Promise<{ user_id: string; workspace_id: string } | null> {
  try {
    const [removed] = await db.delete(schema.workspaceMembers)
      .where(eq(schema.workspaceMembers.id, memberId))
      .returning();
    return removed ? { user_id: removed.user_id, workspace_id: removed.workspace_id } : null;
  } catch (error) {
    console.error('Failed to remove workspace member by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- PROJECTS -----------------

export async function getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
  try {
    const prjs = await db.select().from(schema.projects)
      .where(eq(schema.projects.workspace_id, workspaceId))
      .orderBy(desc(schema.projects.created_at));

    const prjIds = prjs.map(p => p.id);
    let allTasks: typeof schema.tasks.$inferSelect[] = [];
    if (prjIds.length > 0) {
      allTasks = await db.select().from(schema.tasks).where(inArray(schema.tasks.project_id, prjIds));
    }

    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).limit(1);

    return prjs.map(p => {
      const pTasks = allTasks.filter(t => t.project_id === p.id);
      return {
        id: p.id,
        workspace_id: p.workspace_id,
        name: p.name,
        description: p.description || undefined,
        status: p.status as 'active' | 'archived' | 'planned' | 'completed',
        start_at: p.start_at ? p.start_at.toISOString() : null,
        end_at: p.end_at ? p.end_at.toISOString() : null,
        completed_at: p.completed_at ? p.completed_at.toISOString() : null,
        stopped_at: p.stopped_at ? p.stopped_at.toISOString() : null,
        link: p.link || null,
        created_by: p.created_by,
        created_at: p.created_at ? p.created_at.toISOString() : new Date().toISOString(),
        tasks_count: pTasks.length,
        active_tasks_count: pTasks.filter(t => t.status !== 'termine').length,
        completed_tasks_count: pTasks.filter(t => t.status === 'termine').length,
        workspace: ws ? {
          id: ws.id,
          name: ws.name,
          color: ws.color,
          icon: ws.icon,
          photo_url: ws.photo_url,
          created_at: ws.created_at ? ws.created_at.toISOString() : new Date().toISOString(),
        } : undefined,
      };
    });
  } catch (error) {
    console.error('Failed to get workspace projects:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
    if (!p) return null;

    const [ws] = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, p.workspace_id)).limit(1);
    const pTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.project_id, p.id));

    return {
      id: p.id,
      workspace_id: p.workspace_id,
      name: p.name,
      description: p.description || undefined,
      status: p.status as 'active' | 'archived' | 'planned' | 'completed',
      start_at: p.start_at ? p.start_at.toISOString() : null,
      end_at: p.end_at ? p.end_at.toISOString() : null,
      completed_at: p.completed_at ? p.completed_at.toISOString() : null,
      stopped_at: p.stopped_at ? p.stopped_at.toISOString() : null,
      link: p.link || null,
      created_by: p.created_by,
      created_at: p.created_at ? p.created_at.toISOString() : new Date().toISOString(),
      tasks_count: pTasks.length,
      active_tasks_count: pTasks.filter(t => t.status !== 'termine').length,
      completed_tasks_count: pTasks.filter(t => t.status === 'termine').length,
      workspace: ws ? {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        photo_url: ws.photo_url,
        created_at: ws.created_at ? ws.created_at.toISOString() : new Date().toISOString(),
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to get project by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createProject(
  workspaceId: string,
  name: string,
  description?: string,
  start_at?: string,
  end_at?: string,
  status: string = 'en_cours',
  createdBy?: string,
  link?: string
): Promise<Project> {
  try {
    const id = generateId('prj');
    const [created] = await db.insert(schema.projects).values({
      id,
      workspace_id: workspaceId,
      name,
      description,
      start_at: start_at ? new Date(start_at) : undefined,
      end_at: end_at ? new Date(end_at) : undefined,
      status,
      created_by: createdBy,
      link,
    }).returning();

    return {
      id: created.id,
      workspace_id: created.workspace_id,
      name: created.name,
      description: created.description || undefined,
      status: created.status as 'active' | 'archived' | 'planned' | 'completed',
      start_at: created.start_at ? created.start_at.toISOString() : null,
      end_at: created.end_at ? created.end_at.toISOString() : null,
      completed_at: null,
      stopped_at: null,
      link: created.link,
      created_by: created.created_by,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
      tasks_count: 0,
      active_tasks_count: 0,
      completed_tasks_count: 0,
    };
  } catch (error) {
    console.error('Failed to create project:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateProject(id: string, updates: Partial<{ name: string; description: string; status: string; start_at: string | null; end_at: string | null; stopped_at: string | null; link: string | null }>): Promise<Project | null> {
  try {
    const [updated] = await db.update(schema.projects)
      .set({
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.status ? { status: updates.status } : {}),
        ...(updates.start_at !== undefined ? { start_at: updates.start_at ? new Date(updates.start_at) : null } : {}),
        ...(updates.end_at !== undefined ? { end_at: updates.end_at ? new Date(updates.end_at) : null } : {}),
        ...(updates.stopped_at !== undefined ? { stopped_at: updates.stopped_at ? new Date(updates.stopped_at) : null } : {}),
        ...(updates.link !== undefined ? { link: updates.link || null } : {}),
      })
      .where(eq(schema.projects.id, id))
      .returning();

    if (!updated) return null;
    return getProjectById(id);
  } catch (error) {
    console.error('Failed to update project:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Recomputes whether a project should be marked completed (all its tasks are
// 'termine') or reopened (a task was moved back out of 'termine' after the
// project had been marked complete). Called after any task status
// change/create/delete. Fires the project_completed / project_playbook_reminder
// notifications the first time a project newly becomes complete.
export async function recalcProjectCompletion(projectId: string): Promise<void> {
  try {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).limit(1);
    if (!project) return;

    const projectTasks = await db.select().from(schema.tasks).where(eq(schema.tasks.project_id, projectId));
    const allDone = projectTasks.length > 0 && projectTasks.every(t => t.status === 'termine');

    if (allDone && !project.completed_at) {
      await db.update(schema.projects).set({ completed_at: new Date() }).where(eq(schema.projects.id, projectId));
      await onProjectCompleted(projectId, project.workspace_id, project.name);

      const recipients = new Set<string>();
      if (project.created_by) {
        recipients.add(project.created_by);
      } else {
        const admins = await db.select().from(schema.workspaceMembers)
          .where(and(eq(schema.workspaceMembers.workspace_id, project.workspace_id), eq(schema.workspaceMembers.role, 'admin')));
        admins.forEach(a => recipients.add(a.user_id));
      }
      for (const recipientId of recipients) {
        await createNotification({
          user_id: recipientId,
          type: 'project_completed',
          title: 'Projet terminé',
          message: `Le projet "${project.name}" est terminé : toutes ses tâches sont passées à "Terminé".`,
          workspace_id: project.workspace_id,
        }).catch(err => console.error('Failed to create project_completed notification:', err));
      }

      const assigneeIds = new Set(projectTasks.map(t => t.assignee_id).filter(Boolean) as string[]);
      for (const assigneeId of assigneeIds) {
        await createNotification({
          user_id: assigneeId,
          type: 'project_playbook_reminder',
          title: 'Playbook à rédiger',
          message: `Le projet "${project.name}" est terminé. Pense à rédiger le playbook et à mettre à jour la stack.`,
          workspace_id: project.workspace_id,
        }).catch(err => console.error('Failed to create project_playbook_reminder notification:', err));
      }
    } else if (!allDone && project.completed_at) {
      await db.update(schema.projects).set({ completed_at: null }).where(eq(schema.projects.id, projectId));
    }
  } catch (error) {
    console.error('Failed to recalc project completion:', error);
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  try {
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- PROJECT MEMBERS -----------------
// A project's own team roster — distinct from workspace membership (which
// governs access). Adding someone to a project also grants them workspace
// access if they didn't already have it, mirroring task-assignment.

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  try {
    const rows = await db.select().from(schema.projectMembers).where(eq(schema.projectMembers.project_id, projectId));
    const allUsers = await getAllUsers();
    return rows.map(r => ({
      id: r.id,
      project_id: r.project_id,
      user_id: r.user_id,
      added_at: r.added_at ? r.added_at.toISOString() : new Date().toISOString(),
      user: allUsers.find(u => u.id === r.user_id),
    }));
  } catch (error) {
    console.error('Failed to get project members:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function addProjectMember(projectId: string, userId: string): Promise<ProjectMember> {
  try {
    const existing = await db.select().from(schema.projectMembers)
      .where(and(eq(schema.projectMembers.project_id, projectId), eq(schema.projectMembers.user_id, userId)))
      .limit(1);

    const u = await getUserById(userId);
    const userEcho = u ? {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as 'admin' | 'member',
      avatar_url: u.avatar_url || undefined,
    } : undefined;

    if (existing.length > 0) {
      return {
        id: existing[0].id,
        project_id: projectId,
        user_id: userId,
        added_at: existing[0].added_at ? existing[0].added_at.toISOString() : new Date().toISOString(),
        user: userEcho,
      };
    }

    const [created] = await db.insert(schema.projectMembers).values({
      id: generateId('pm'),
      project_id: projectId,
      user_id: userId,
    }).returning();

    return {
      id: created.id,
      project_id: created.project_id,
      user_id: created.user_id,
      added_at: created.added_at ? created.added_at.toISOString() : new Date().toISOString(),
      user: userEcho,
    };
  } catch (error) {
    console.error('Failed to add project member:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  try {
    await db.delete(schema.projectMembers)
      .where(and(eq(schema.projectMembers.project_id, projectId), eq(schema.projectMembers.user_id, userId)));
    return true;
  } catch (error) {
    console.error('Failed to remove project member:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- TAGS -----------------

export async function getWorkspaceTags(workspaceId: string): Promise<Tag[]> {
  try {
    const rows = await db.select().from(schema.tags).where(eq(schema.tags.workspace_id, workspaceId));
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      workspace_id: r.workspace_id,
    }));
  } catch (error) {
    console.error('Failed to get workspace tags:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createTag(workspaceId: string, name: string, color: string = '#2563EB'): Promise<Tag> {
  try {
    const id = generateId('tag');
    const [created] = await db.insert(schema.tags).values({
      id,
      workspace_id: workspaceId,
      name,
      color,
    }).returning();

    return {
      id: created.id,
      name: created.name,
      color: created.color,
      workspace_id: created.workspace_id,
    };
  } catch (error) {
    console.error('Failed to create tag:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getTagById(id: string): Promise<{ id: string; workspace_id: string } | null> {
  try {
    const rows = await db.select({ id: schema.tags.id, workspace_id: schema.tags.workspace_id })
      .from(schema.tags).where(eq(schema.tags.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get tag by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteTag(id: string): Promise<boolean> {
  try {
    await db.delete(schema.tags).where(eq(schema.tags.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete tag:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- TASKS -----------------

// Hydrates many tasks with a fixed number of queries (one per related table)
// instead of ~13 queries per task. Same output shape as before.
async function populateTasks(rows: typeof schema.tasks.$inferSelect[]): Promise<Task[]> {
  if (rows.length === 0) return [];
  const ids = rows.map(t => t.id);
  const prjIds = [...new Set(rows.map(t => t.project_id))];
  const [projectsList, subtasksAll, commentsAll, attachmentsAll, timeEntriesAll, taskTagsAll, allUsers] = await Promise.all([
    db.select().from(schema.projects).where(inArray(schema.projects.id, prjIds)),
    db.select().from(schema.subtasks).where(inArray(schema.subtasks.task_id, ids)).orderBy(asc(schema.subtasks.created_at)),
    db.select().from(schema.comments).where(inArray(schema.comments.task_id, ids)).orderBy(desc(schema.comments.created_at)),
    db.select().from(schema.attachments).where(inArray(schema.attachments.task_id, ids)).orderBy(desc(schema.attachments.created_at)),
    db.select().from(schema.timeEntries).where(inArray(schema.timeEntries.task_id, ids)).orderBy(desc(schema.timeEntries.created_at)),
    db.select().from(schema.taskTags).where(inArray(schema.taskTags.task_id, ids)),
    getAllUsers(),
  ]);
  const wsIds = [...new Set(projectsList.map(p => p.workspace_id))];
  const tagIds = [...new Set(taskTagsAll.map(tt => tt.tag_id))];
  const [workspacesList, tagsAll] = await Promise.all([
    wsIds.length ? db.select().from(schema.workspaces).where(inArray(schema.workspaces.id, wsIds)) : Promise.resolve([]),
    tagIds.length ? db.select().from(schema.tags).where(inArray(schema.tags.id, tagIds)) : Promise.resolve([]),
  ]);
  const usersById = new Map(allUsers.map(u => [u.id, u]));
  const by = <T extends { task_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) { const a = m.get(x.task_id); if (a) a.push(x); else m.set(x.task_id, [x]); }
    return m;
  };
  const subBy = by(subtasksAll), comBy = by(commentsAll), attBy = by(attachmentsAll), teBy = by(timeEntriesAll), ttBy = by(taskTagsAll);
  const lite = (id: string | null) => {
    const u = id ? usersById.get(id) : undefined;
    return u ? { id: u.id, email: u.email, name: u.name, role: u.role, avatar_url: u.avatar_url } : null;
  };

  return rows.map(t => {
    const project = projectsList.find(p => p.id === t.project_id);
    const workspace = project ? workspacesList.find(w => w.id === project.workspace_id) : undefined;
    const subtasksList = subBy.get(t.id) || [];
    const commentsList = comBy.get(t.id) || [];
    const attachmentsList = attBy.get(t.id) || [];
    const timeEntriesList = teBy.get(t.id) || [];
    const tagsList: Tag[] = (ttBy.get(t.id) || []).map(tt => tagsAll.find(tg => tg.id === tt.tag_id)).filter(Boolean)
      .map(rt => ({ id: rt!.id, name: rt!.name, color: rt!.color, workspace_id: rt!.workspace_id }));
    const assignee = lite(t.assignee_id);
    const creator = lite(t.created_by);
    const totalMinutes = timeEntriesList.reduce((sum, te) => sum + te.duration_minutes, 0);
    return {
      id: t.id,
      project_id: t.project_id,
      workspace_id: project?.workspace_id,
      title: t.title,
      description: t.description || undefined,
      status: t.status as TaskStatus,
      priority: t.priority as TaskPriority,
      assignee_id: t.assignee_id,
      start_at: t.start_at ? t.start_at.toISOString() : null,
      end_at: t.end_at ? t.end_at.toISOString() : null,
      completed_at: t.completed_at ? t.completed_at.toISOString() : null,
      stopped_at: t.stopped_at ? t.stopped_at.toISOString() : null,
      estimated_minutes: t.estimated_minutes ?? null,
      created_by: t.created_by || '',
      position: t.position || 0,
      created_at: t.created_at ? t.created_at.toISOString() : new Date().toISOString(),
      updated_at: t.created_at ? t.created_at.toISOString() : new Date().toISOString(),
      assignee: assignee ? {
        id: assignee.id,
        email: assignee.email,
        name: assignee.name,
        role: assignee.role as 'admin' | 'member',
        avatar_url: assignee.avatar_url || undefined,
      } : null,
      creator: creator ? {
        id: creator.id,
        email: creator.email,
        name: creator.name,
        role: creator.role as 'admin' | 'member',
        avatar_url: creator.avatar_url || undefined,
      } : null,
      project: project ? {
        id: project.id,
        workspace_id: project.workspace_id,
        name: project.name,
        description: project.description || undefined,
        status: project.status as any,
        start_at: project.start_at ? project.start_at.toISOString() : null,
        end_at: project.end_at ? project.end_at.toISOString() : null,
        completed_at: project.completed_at ? project.completed_at.toISOString() : null,
        stopped_at: project.stopped_at ? project.stopped_at.toISOString() : null,
        created_by: project.created_by,
        created_at: project.created_at ? project.created_at.toISOString() : new Date().toISOString(),
      } : undefined,
      workspace: workspace ? {
        id: workspace.id,
        name: workspace.name,
        color: workspace.color,
        icon: workspace.icon,
        photo_url: workspace.photo_url,
        created_at: workspace.created_at ? workspace.created_at.toISOString() : new Date().toISOString(),
      } : undefined,
      subtasks: subtasksList.map(s => ({
        id: s.id,
        task_id: s.task_id,
        title: s.title,
        completed: !!s.completed,
        created_at: s.created_at ? s.created_at.toISOString() : new Date().toISOString(),
      })),
      comments: commentsList.map(c => ({
        id: c.id,
        task_id: c.task_id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at ? c.created_at.toISOString() : new Date().toISOString(),
        user: usersById.get(c.user_id),
      })),
      attachments: attachmentsList.map(a => ({
        id: a.id,
        task_id: a.task_id,
        file_url: a.file_url,
        file_name: a.file_name,
        file_size: a.file_size || undefined,
        file_type: a.file_type || undefined,
        uploaded_by: a.user_id,
        created_at: a.created_at ? a.created_at.toISOString() : new Date().toISOString(),
        uploader: usersById.get(a.user_id),
      })),
      time_entries: timeEntriesList.map(te => ({
        id: te.id,
        task_id: te.task_id,
        user_id: te.user_id,
        duration_minutes: te.duration_minutes,
        note: te.note || undefined,
        date: te.date,
        created_at: te.created_at ? te.created_at.toISOString() : new Date().toISOString(),
        user: usersById.get(te.user_id),
      })),
      tags: tagsList,
      total_time_minutes: totalMinutes,
    };
  });
}

async function populateTaskDetails(t: typeof schema.tasks.$inferSelect): Promise<Task> {
  return (await populateTasks([t]))[0];
}

export async function getProjectTasks(projectId: string): Promise<Task[]> {
  try {
    const rawTasks = await db.select().from(schema.tasks)
      .where(eq(schema.tasks.project_id, projectId))
      .orderBy(asc(schema.tasks.position), desc(schema.tasks.created_at));

    return populateTasks(rawTasks);
  } catch (error) {
    console.error('Failed to get project tasks:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserDashboardTasks(userId: string, isGlobalAdmin: boolean = false): Promise<Task[]> {
  try {
    const allWorkspaces = await getUserWorkspaces(userId, isGlobalAdmin);
    const wsIds = allWorkspaces.map(w => w.id);
    if (wsIds.length === 0) return [];

    const wsProjects = await db.select().from(schema.projects).where(inArray(schema.projects.workspace_id, wsIds));
    const prjIds = wsProjects.map(p => p.id);
    if (prjIds.length === 0) return [];

    let rawTasks: typeof schema.tasks.$inferSelect[] = [];
    if (isGlobalAdmin) {
      rawTasks = await db.select().from(schema.tasks).where(inArray(schema.tasks.project_id, prjIds)).orderBy(desc(schema.tasks.created_at));
    } else {
      rawTasks = await db.select().from(schema.tasks)
        .where(and(inArray(schema.tasks.project_id, prjIds), eq(schema.tasks.assignee_id, userId)))
        .orderBy(desc(schema.tasks.created_at));
    }

    return populateTasks(rawTasks);
  } catch (error) {
    console.error('Failed to get dashboard tasks:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getTaskById(id: string): Promise<Task | null> {
  try {
    const [t] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (!t) return null;
    return populateTaskDetails(t);
  } catch (error) {
    console.error('Failed to get task by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createTask(data: {
  project_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  estimated_minutes?: number | null;
  created_by: string;
  tag_ids?: string[];
}): Promise<Task> {
  try {
    const id = generateId('tsk');
    const existing = await db.select().from(schema.tasks).where(eq(schema.tasks.project_id, data.project_id));
    const maxPosition = existing.reduce((max, t) => Math.max(max, t.position || 0), -1);
    const status = data.status || 'a_faire';
    // The task chrono ("Chronométrer") starts automatically the moment a
    // task is 'en_cours' — if no explicit start_at was given, anchor it to
    // creation time rather than leaving it unset.
    const autoStartAt = status === 'en_cours' && !data.start_at ? new Date() : (data.start_at ? new Date(data.start_at) : null);

    const [created] = await db.insert(schema.tasks).values({
      id,
      project_id: data.project_id,
      title: data.title,
      description: data.description,
      status,
      priority: data.priority || 'normale',
      assignee_id: data.assignee_id || null,
      start_at: autoStartAt,
      end_at: data.end_at ? new Date(data.end_at) : null,
      completed_at: status === 'termine' ? new Date() : null,
      blocked_at: status === 'bloque' ? new Date() : null,
      estimated_minutes: data.estimated_minutes ?? null,
      position: maxPosition + 1,
      created_by: data.created_by,
    }).returning();

    if (data.tag_ids && data.tag_ids.length > 0) {
      for (const tagId of data.tag_ids) {
        await db.insert(schema.taskTags).values({
          id: generateId('tt'),
          task_id: id,
          tag_id: tagId,
        });
      }
    }

    await recalcProjectCompletion(data.project_id);

    const fullTask = await getTaskById(id);
    if (!fullTask) throw new Error('Task created but could not be retrieved');
    return fullTask;
  } catch (error) {
    console.error('Failed to create task:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateTask(id: string, updates: Partial<{
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  start_at: string | null;
  end_at: string | null;
  stopped_at: string | null;
  estimated_minutes: number | null;
  tag_ids: string[];
  position: number;
}>, actorId: string | null = null): Promise<Task | null> {
  try {
    const [existingTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (!existingTask) return null;

    const setPayload: any = {};
    if (updates.title !== undefined) setPayload.title = updates.title;
    if (updates.description !== undefined) setPayload.description = updates.description;
    if (updates.status !== undefined) {
      setPayload.status = updates.status;
      if (updates.status === 'termine' && existingTask.status !== 'termine') {
        setPayload.completed_at = new Date();
      } else if (updates.status !== 'termine' && existingTask.status === 'termine') {
        setPayload.completed_at = null;
      }
      // The task chrono ("Chronométrer") starts automatically the first time
      // a task becomes 'en_cours' — only fills start_at if it isn't already
      // set, so this never overwrites a schedule the task already has.
      if (updates.status === 'en_cours' && existingTask.status !== 'en_cours' && !existingTask.start_at && updates.start_at === undefined) {
        setPayload.start_at = new Date();
      }
      Object.assign(setPayload, blockedAtPatch(existingTask.status, updates.status));
    }
    if (updates.priority !== undefined) setPayload.priority = updates.priority;
    if (updates.assignee_id !== undefined) setPayload.assignee_id = updates.assignee_id;
    if (updates.start_at !== undefined) setPayload.start_at = updates.start_at ? new Date(updates.start_at) : null;
    if (updates.end_at !== undefined) setPayload.end_at = updates.end_at ? new Date(updates.end_at) : null;
    if (updates.stopped_at !== undefined) setPayload.stopped_at = updates.stopped_at ? new Date(updates.stopped_at) : null;
    if (updates.estimated_minutes !== undefined) setPayload.estimated_minutes = updates.estimated_minutes;
    if (updates.position !== undefined) setPayload.position = updates.position;

    if (Object.keys(setPayload).length > 0) {
      await db.update(schema.tasks).set(setPayload).where(eq(schema.tasks.id, id));
    }

    if (updates.tag_ids !== undefined) {
      await db.delete(schema.taskTags).where(eq(schema.taskTags.task_id, id));
      for (const tagId of updates.tag_ids) {
        await db.insert(schema.taskTags).values({
          id: generateId('tt'),
          task_id: id,
          tag_id: tagId,
        });
      }
    }

    if (updates.status !== undefined) {
      await onTaskStatusChange(existingTask, updates.status, actorId);
      await recalcProjectCompletion(existingTask.project_id);
    }

    return getTaskById(id);
  } catch (error) {
    console.error('Failed to update task:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// blocked_at follows the 'bloque' status (used for "bloquée depuis" and blocker rewards).
function blockedAtPatch(from: string, to: string): { blocked_at?: Date | null } {
  if (to === 'bloque' && from !== 'bloque') return { blocked_at: new Date() };
  if (to !== 'bloque' && from === 'bloque') return { blocked_at: null };
  return {};
}

export async function reorderTasks(items: Array<{ id: string; status: TaskStatus; position: number }>, actorId: string | null = null): Promise<void> {
  try {
    const affectedProjectIds = new Set<string>();
    for (const item of items) {
      const [existingTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, item.id)).limit(1);
      if (!existingTask) continue;

      const setPayload: any = { status: item.status, position: item.position };
      if (item.status === 'termine' && existingTask.status !== 'termine') {
        setPayload.completed_at = new Date();
      } else if (item.status !== 'termine' && existingTask.status === 'termine') {
        setPayload.completed_at = null;
      }
      if (item.status === 'en_cours' && existingTask.status !== 'en_cours' && !existingTask.start_at) {
        setPayload.start_at = new Date();
      }
      Object.assign(setPayload, blockedAtPatch(existingTask.status, item.status));

      await db.update(schema.tasks).set(setPayload).where(eq(schema.tasks.id, item.id));
      await onTaskStatusChange(existingTask, item.status, actorId);
      affectedProjectIds.add(existingTask.project_id);
    }

    for (const projectId of affectedProjectIds) {
      await recalcProjectCompletion(projectId);
    }
  } catch (error) {
    console.error('Failed to reorder tasks:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteTask(id: string): Promise<boolean> {
  try {
    const [existingTask] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    await revokeTaskEvents(id, 'Tâche supprimée (annulée)');
    await db.delete(schema.tasks).where(eq(schema.tasks.id, id));
    if (existingTask) {
      await recalcProjectCompletion(existingTask.project_id);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- SUBTASKS -----------------

export async function addSubtask(taskId: string, title: string): Promise<Subtask> {
  try {
    const id = generateId('sub');
    const [created] = await db.insert(schema.subtasks).values({
      id,
      task_id: taskId,
      title,
      completed: false,
    }).returning();

    return {
      id: created.id,
      task_id: created.task_id,
      title: created.title,
      completed: !!created.completed,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to add subtask:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getSubtaskById(id: string): Promise<{ id: string; task_id: string } | null> {
  try {
    const rows = await db.select({ id: schema.subtasks.id, task_id: schema.subtasks.task_id })
      .from(schema.subtasks).where(eq(schema.subtasks.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get subtask by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function updateSubtask(id: string, updates: { completed?: boolean; title?: string }): Promise<Subtask | null> {
  try {
    const [updated] = await db.update(schema.subtasks)
      .set({
        ...(updates.completed !== undefined ? { completed: updates.completed } : {}),
        ...(updates.title ? { title: updates.title } : {}),
      })
      .where(eq(schema.subtasks.id, id))
      .returning();

    if (!updated) return null;
    return {
      id: updated.id,
      task_id: updated.task_id,
      title: updated.title,
      completed: !!updated.completed,
      created_at: updated.created_at ? updated.created_at.toISOString() : new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to update subtask:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteSubtask(id: string): Promise<boolean> {
  try {
    await db.delete(schema.subtasks).where(eq(schema.subtasks.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete subtask:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- COMMENTS -----------------

export async function addComment(taskId: string, userId: string, content: string): Promise<Comment> {
  try {
    const id = generateId('com');
    const [created] = await db.insert(schema.comments).values({
      id,
      task_id: taskId,
      user_id: userId,
      content,
    }).returning();

    const u = await getUserById(userId);

    return {
      id: created.id,
      task_id: created.task_id,
      user_id: created.user_id,
      content: created.content,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to add comment:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getCommentById(id: string): Promise<{ id: string; task_id: string; user_id: string } | null> {
  try {
    const rows = await db.select({ id: schema.comments.id, task_id: schema.comments.task_id, user_id: schema.comments.user_id })
      .from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get comment by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteComment(id: string): Promise<boolean> {
  try {
    await db.delete(schema.comments).where(eq(schema.comments.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete comment:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- ATTACHMENTS -----------------

export async function addAttachment(taskId: string, userId: string, fileName: string, fileUrl: string, fileSize?: number, fileType?: string): Promise<Attachment> {
  try {
    const id = generateId('att');
    const [created] = await db.insert(schema.attachments).values({
      id,
      task_id: taskId,
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      file_type: fileType,
    }).returning();

    const u = await getUserById(userId);

    return {
      id: created.id,
      task_id: created.task_id,
      file_name: created.file_name,
      file_url: created.file_url,
      file_size: created.file_size || undefined,
      file_type: created.file_type || undefined,
      uploaded_by: created.user_id,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
      uploader: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to add attachment:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getAttachmentById(id: string): Promise<{ id: string; task_id: string; user_id: string } | null> {
  try {
    const rows = await db.select({ id: schema.attachments.id, task_id: schema.attachments.task_id, user_id: schema.attachments.user_id })
      .from(schema.attachments).where(eq(schema.attachments.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get attachment by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAttachment(id: string): Promise<boolean> {
  try {
    await db.delete(schema.attachments).where(eq(schema.attachments.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- TIME TRACKING -----------------

export async function logTime(taskId: string, userId: string, durationMinutes: number, note?: string, date?: string): Promise<TimeEntry> {
  try {
    const id = generateId('te');
    const [created] = await db.insert(schema.timeEntries).values({
      id,
      task_id: taskId,
      user_id: userId,
      duration_minutes: durationMinutes,
      note,
      date: date || new Date().toISOString().split('T')[0],
    }).returning();

    const u = await getUserById(userId);

    return {
      id: created.id,
      task_id: created.task_id,
      user_id: created.user_id,
      duration_minutes: created.duration_minutes,
      note: created.note || undefined,
      date: created.date,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to log time:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getTimeEntryById(id: string): Promise<{ id: string; task_id: string; user_id: string } | null> {
  try {
    const rows = await db.select({ id: schema.timeEntries.id, task_id: schema.timeEntries.task_id, user_id: schema.timeEntries.user_id })
      .from(schema.timeEntries).where(eq(schema.timeEntries.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to get time entry by id:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteTimeEntry(id: string): Promise<boolean> {
  try {
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete time entry:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getTimeEntries(
  userId: string, 
  isGlobalAdmin: boolean = false, 
  filters: { workspace_id?: string; project_id?: string; user_id?: string } = {}
): Promise<TimeEntry[]> {
  try {
    const allWorkspaces = await getUserWorkspaces(userId, isGlobalAdmin);
    const accessibleWsIds = allWorkspaces.map(w => w.id);
    if (accessibleWsIds.length === 0) return [];

    const wsFilter = filters.workspace_id && filters.workspace_id !== 'all' 
      ? [filters.workspace_id] 
      : accessibleWsIds;

    const allProjects = await db.select().from(schema.projects).where(inArray(schema.projects.workspace_id, wsFilter));
    const prjFilter = filters.project_id && filters.project_id !== 'all'
      ? allProjects.filter(p => p.id === filters.project_id)
      : allProjects;

    const prjIds = prjFilter.map(p => p.id);
    if (prjIds.length === 0) return [];

    const allTasks = await db.select().from(schema.tasks).where(inArray(schema.tasks.project_id, prjIds));
    const taskIds = allTasks.map(t => t.id);
    if (taskIds.length === 0) return [];

    let entries = await db.select().from(schema.timeEntries)
      .where(inArray(schema.timeEntries.task_id, taskIds))
      .orderBy(desc(schema.timeEntries.date), desc(schema.timeEntries.created_at));

    if (filters.user_id) {
      entries = entries.filter(e => e.user_id === filters.user_id);
    }

    const allUsers = await getAllUsers();

    return entries.map(e => {
      const task = allTasks.find(t => t.id === e.task_id);
      const prj = task ? allProjects.find(p => p.id === task.project_id) : undefined;
      const ws = prj ? allWorkspaces.find(w => w.id === prj.workspace_id) : undefined;

      return {
        id: e.id,
        task_id: e.task_id,
        user_id: e.user_id,
        duration_minutes: e.duration_minutes,
        note: e.note || undefined,
        date: e.date,
        created_at: e.created_at ? e.created_at.toISOString() : new Date().toISOString(),
        user: allUsers.find(u => u.id === e.user_id),
        task: task ? {
          id: task.id,
          title: task.title,
          project_id: task.project_id,
          project_name: prj?.name,
          workspace_id: prj?.workspace_id,
          workspace_name: ws?.name,
          workspace_color: ws?.color,
        } : undefined,
      };
    });
  } catch (error) {
    console.error('Failed to get time entries:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- TIME ALLOCATION ("Mon Temps") -----------------

function minutesBetween(startAt: Date | null, endAt: Date | null): number {
  if (!startAt || !endAt) return 0;
  const diff = endAt.getTime() - startAt.getTime();
  return diff > 0 ? Math.round(diff / 60000) : 0;
}

// Builds the "allocated hours" breakdown for one member: every workspace
// they belong to, the projects within it where they have at least one
// assigned task, and per-task allocated (schedule-derived) vs logged
// (manually tracked) minutes.
export async function getMemberTimeAllocation(userId: string): Promise<TimeAllocationWorkspace[]> {
  try {
    const memberships = await db.select().from(schema.workspaceMembers).where(eq(schema.workspaceMembers.user_id, userId));
    const wsIds = memberships.map(m => m.workspace_id);
    if (wsIds.length === 0) return [];

    const wsList = await db.select().from(schema.workspaces).where(inArray(schema.workspaces.id, wsIds));
    const allProjects = await db.select().from(schema.projects).where(inArray(schema.projects.workspace_id, wsIds));
    const prjIds = allProjects.map(p => p.id);
    const myTasks = prjIds.length > 0
      ? await db.select().from(schema.tasks).where(and(inArray(schema.tasks.project_id, prjIds), eq(schema.tasks.assignee_id, userId)))
      : [];

    return wsList.map(ws => {
      const wsProjects = allProjects.filter(p => p.workspace_id === ws.id);
      const projects: TimeAllocationProject[] = wsProjects
        .map(p => {
          const pTasks = myTasks.filter(t => t.project_id === p.id);
          if (pTasks.length === 0) return null;
          const tasksOut: TimeAllocationTask[] = pTasks.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status as TaskStatus,
            start_at: t.start_at ? t.start_at.toISOString() : null,
            end_at: t.end_at ? t.end_at.toISOString() : null,
            completed_at: t.completed_at ? t.completed_at.toISOString() : null,
            allocated_minutes: minutesBetween(t.start_at, t.end_at),
            // Real time spent = the task's automatic chrono (start → done/stop, or now while running).
            // Manual time entries are no longer created anywhere in the UI.
            logged_minutes: t.start_at && t.start_at.getTime() <= Date.now()
              ? minutesBetween(t.start_at, t.completed_at || t.stopped_at || new Date())
              : 0,
          }));
          return {
            id: p.id,
            name: p.name,
            start_at: p.start_at ? p.start_at.toISOString() : null,
            end_at: p.end_at ? p.end_at.toISOString() : null,
            completed_at: p.completed_at ? p.completed_at.toISOString() : null,
            tasks_count: tasksOut.length,
            allocated_minutes: tasksOut.reduce((sum, t) => sum + t.allocated_minutes, 0),
            logged_minutes: tasksOut.reduce((sum, t) => sum + t.logged_minutes, 0),
            tasks: tasksOut,
          };
        })
        .filter((p): p is TimeAllocationProject => !!p);

      return {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        photo_url: ws.photo_url,
        projects,
      };
    }).filter(ws => ws.projects.length > 0);
  } catch (error) {
    console.error('Failed to get member time allocation:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Admin-only aggregate view: every member who belongs to at least one
// workspace, each with their own getMemberTimeAllocation() breakdown.
export async function getAllMembersTimeAllocation(): Promise<{ user: User; workspaces: TimeAllocationWorkspace[] }[]> {
  try {
    const memberships = await db.select({ user_id: schema.workspaceMembers.user_id }).from(schema.workspaceMembers);
    const userIds = [...new Set(memberships.map(m => m.user_id))];
    const allUsers = await getAllUsers();

    const results = await Promise.all(userIds.map(async userId => {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return null;
      const workspaces = await getMemberTimeAllocation(userId);
      return { user, workspaces };
    }));

    return results.filter((r): r is { user: User; workspaces: TimeAllocationWorkspace[] } => !!r);
  } catch (error) {
    console.error('Failed to get all members time allocation:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Ensures the single owner admin account exists on boot. Never overwrites an
// existing account's password/role — that would silently undo a real password
// change. It only creates the account the first time the database is empty,
// and only if ADMIN_EMAIL/ADMIN_PASSWORD are set — the password is never
// hardcoded in source so it never ends up in git history.
export async function ensureAdminUser(): Promise<void> {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return;
  }

  try {
    const existing = await getUserByEmail(ADMIN_EMAIL);
    if (!existing) {
      await createUserWithRole(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, 'admin');
      console.log(`[AxeTask DB] Created initial admin account ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.warn('[AxeTask DB] Could not ensure admin account:', err);
  }
}

// ----------------- CONVERSATIONS & MESSAGES -----------------

async function hydrateConversation(conversationId: string, currentUserId: string): Promise<Conversation | null> {
  const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1);
  if (!conv) return null;

  const participantRows = await db.select().from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.conversation_id, conversationId));

  const allUsers = await getAllUsers();
  const participants = participantRows
    .map(p => {
      const u = allUsers.find(u => u.id === p.user_id);
      if (!u) return null;
      return { ...u, last_read_at: p.last_read_at ? p.last_read_at.toISOString() : null };
    })
    .filter((u): u is User & { last_read_at: string | null } => !!u);

  const [lastMessageRow] = await db.select().from(schema.messages)
    .where(eq(schema.messages.conversation_id, conversationId))
    .orderBy(desc(schema.messages.created_at))
    .limit(1);

  const myParticipant = participantRows.find(p => p.user_id === currentUserId);
  let unread_count = 0;
  if (myParticipant) {
    const unreadWhere = myParticipant.last_read_at
      ? and(
          eq(schema.messages.conversation_id, conversationId),
          ne(schema.messages.sender_id, currentUserId),
          sql`${schema.messages.created_at} > ${myParticipant.last_read_at}`
        )
      : and(
          eq(schema.messages.conversation_id, conversationId),
          ne(schema.messages.sender_id, currentUserId)
        );
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.messages).where(unreadWhere);
    unread_count = count || 0;
  }

  return {
    id: conv.id,
    is_group: !!conv.is_group,
    name: conv.name,
    created_at: conv.created_at ? conv.created_at.toISOString() : new Date().toISOString(),
    participants,
    last_message: lastMessageRow ? {
      id: lastMessageRow.id,
      conversation_id: lastMessageRow.conversation_id,
      sender_id: lastMessageRow.sender_id,
      content: lastMessageRow.content,
      created_at: lastMessageRow.created_at ? lastMessageRow.created_at.toISOString() : new Date().toISOString(),
    } : null,
    unread_count,
  };
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const myParticipations = await db.select().from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.user_id, userId));

    const conversations = await Promise.all(
      myParticipations.map(p => hydrateConversation(p.conversation_id, userId))
    );

    const valid = conversations.filter((c): c is Conversation => !!c);
    valid.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    return valid;
  } catch (error) {
    console.error('Failed to get user conversations:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function userIsConversationParticipant(userId: string, conversationId: string): Promise<boolean> {
  try {
    const rows = await db.select().from(schema.conversationParticipants)
      .where(and(eq(schema.conversationParticipants.conversation_id, conversationId), eq(schema.conversationParticipants.user_id, userId)))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check conversation membership:', error);
    return false;
  }
}

export async function findOrCreateDirectConversation(userId: string, otherUserId: string): Promise<Conversation> {
  if (userId === otherUserId) {
    throw new Error('Impossible de démarrer une conversation avec soi-même.');
  }
  try {
    const myConvIds = (await db.select().from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.user_id, userId)))
      .map(p => p.conversation_id);

    if (myConvIds.length > 0) {
      const candidateParticipants = await db.select().from(schema.conversationParticipants)
        .where(and(inArray(schema.conversationParticipants.conversation_id, myConvIds), eq(schema.conversationParticipants.user_id, otherUserId)));

      for (const cp of candidateParticipants) {
        const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, cp.conversation_id)).limit(1);
        if (conv && !conv.is_group) {
          const hydrated = await hydrateConversation(conv.id, userId);
          if (hydrated) return hydrated;
        }
      }
    }

    const id = generateId('conv');
    await db.insert(schema.conversations).values({
      id,
      is_group: false,
      created_by: userId,
    });
    await db.insert(schema.conversationParticipants).values([
      { id: generateId('cp'), conversation_id: id, user_id: userId },
      { id: generateId('cp'), conversation_id: id, user_id: otherUserId },
    ]);

    const hydrated = await hydrateConversation(id, userId);
    if (!hydrated) throw new Error('Conversation created but could not be retrieved');
    return hydrated;
  } catch (error) {
    console.error('Failed to find or create direct conversation:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getConversationMessages(conversationId: string, limit: number = 50, before?: string): Promise<Message[]> {
  try {
    const whereClause = before
      ? and(eq(schema.messages.conversation_id, conversationId), sql`${schema.messages.created_at} < ${new Date(before)}`)
      : eq(schema.messages.conversation_id, conversationId);

    const rows = await db.select().from(schema.messages)
      .where(whereClause)
      .orderBy(desc(schema.messages.created_at))
      .limit(limit);

    const allUsers = await getAllUsers();
    const replyToIds = [...new Set(rows.map(r => r.reply_to_id).filter(Boolean))] as string[];
    const repliedRows = replyToIds.length > 0
      ? await db.select().from(schema.messages).where(inArray(schema.messages.id, replyToIds))
      : [];

    return rows.reverse().map(m => {
      const repliedTo = m.reply_to_id ? repliedRows.find(r => r.id === m.reply_to_id) : undefined;
      return {
        id: m.id,
        conversation_id: m.conversation_id,
        sender_id: m.sender_id,
        content: m.content,
        reply_to_id: m.reply_to_id,
        reply_to: repliedTo ? {
          id: repliedTo.id,
          content: repliedTo.content,
          sender_id: repliedTo.sender_id,
          sender_name: allUsers.find(u => u.id === repliedTo.sender_id)?.name,
        } : null,
        created_at: m.created_at ? m.created_at.toISOString() : new Date().toISOString(),
        sender: allUsers.find(u => u.id === m.sender_id),
      };
    });
  } catch (error) {
    console.error('Failed to get conversation messages:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function sendMessage(conversationId: string, senderId: string, content: string, replyToId?: string | null): Promise<Message> {
  try {
    const id = generateId('msg');
    const [created] = await db.insert(schema.messages).values({
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      reply_to_id: replyToId || null,
    }).returning();

    const u = await getUserById(senderId);
    const repliedTo = created.reply_to_id
      ? (await db.select().from(schema.messages).where(eq(schema.messages.id, created.reply_to_id)).limit(1))[0]
      : undefined;
    const replySender = repliedTo ? await getUserById(repliedTo.sender_id) : undefined;

    return {
      id: created.id,
      conversation_id: created.conversation_id,
      sender_id: created.sender_id,
      content: created.content,
      reply_to_id: created.reply_to_id,
      reply_to: repliedTo ? {
        id: repliedTo.id,
        content: repliedTo.content,
        sender_id: repliedTo.sender_id,
        sender_name: replySender?.name,
      } : null,
      created_at: created.created_at ? created.created_at.toISOString() : new Date().toISOString(),
      sender: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as 'admin' | 'member',
        avatar_url: u.avatar_url || undefined,
      } : undefined,
    };
  } catch (error) {
    console.error('Failed to send message:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  try {
    await db.update(schema.conversationParticipants)
      .set({ last_read_at: new Date() })
      .where(and(eq(schema.conversationParticipants.conversation_id, conversationId), eq(schema.conversationParticipants.user_id, userId)));
  } catch (error) {
    console.error('Failed to mark conversation read:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- ANNOUNCEMENTS -----------------

function formatAnnouncement(
  row: typeof schema.announcements.$inferSelect,
  author?: { id: string; name: string; avatar_url: string | null } | null
): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    created_by: row.created_by,
    created_at: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    author: author || undefined,
  };
}

export async function getAnnouncements(search?: string): Promise<Announcement[]> {
  try {
    const rows = await db.select().from(schema.announcements)
      .where(search?.trim() ? ilike(schema.announcements.title, `%${search.trim()}%`) : undefined)
      .orderBy(desc(schema.announcements.created_at));

    const authorIds = [...new Set(rows.map(r => r.created_by).filter(Boolean))] as string[];
    const authors = authorIds.length > 0
      ? await db.select({ id: schema.users.id, name: schema.users.name, avatar_url: schema.users.avatar_url })
          .from(schema.users).where(inArray(schema.users.id, authorIds))
      : [];

    return rows.map(r => formatAnnouncement(r, r.created_by ? authors.find(a => a.id === r.created_by) || null : null));
  } catch (error) {
    console.error('Failed to get announcements:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function createAnnouncement(title: string, content: string, createdBy: string): Promise<Announcement> {
  try {
    const [created] = await db.insert(schema.announcements).values({
      id: generateId('ann'),
      title,
      content,
      created_by: createdBy,
    }).returning();
    const author = await getUserById(createdBy);
    return formatAnnouncement(created, author ? { id: author.id, name: author.name, avatar_url: author.avatar_url } : null);
  } catch (error) {
    console.error('Failed to create announcement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  try {
    const result = await db.delete(schema.announcements).where(eq(schema.announcements.id, id)).returning();
    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete announcement:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ----------------- REPORTS -----------------

// List without file_data: files are fetched one at a time on download.
// userId = null → everyone's reports (admins).
export async function getReports(userId: string | null): Promise<Report[]> {
  const r = schema.reports;
  const rows = await db.select({
    id: r.id, file_name: r.file_name, file_size: r.file_size, file_type: r.file_type,
    created_at: r.created_at, author_id: schema.users.id, author_name: schema.users.name,
  }).from(r)
    .innerJoin(schema.users, eq(schema.users.id, r.user_id))
    .where(userId ? eq(r.user_id, userId) : undefined)
    .orderBy(desc(r.created_at));
  return rows.map(({ author_id, author_name, created_at, ...rest }) => ({
    ...rest,
    created_at: created_at?.toISOString() || new Date().toISOString(),
    author: { id: author_id, name: author_name },
  }));
}

export async function getReportById(id: string) {
  const [row] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
  return row || null;
}

export async function createReport(userId: string, data: { file_name: string; file_data: string; file_size?: number; file_type?: string }) {
  const [row] = await db.insert(schema.reports).values({
    id: crypto.randomUUID(), user_id: userId, file_name: data.file_name, file_data: data.file_data,
    file_size: data.file_size ?? null, file_type: data.file_type ?? null,
  }).returning({ id: schema.reports.id });
  return row;
}

export async function deleteReport(id: string): Promise<boolean> {
  const result = await db.delete(schema.reports).where(eq(schema.reports.id, id)).returning({ id: schema.reports.id });
  return result.length > 0;
}

// ----------------- NOTIFICATIONS -----------------

function formatNotification(
  row: typeof schema.notifications.$inferSelect,
  task?: { id: string; title: string } | null,
  workspace?: { id: string; name: string } | null
): AppNotification {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    task_id: row.task_id,
    workspace_id: row.workspace_id,
    is_read: row.is_read ?? false,
    created_at: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    task: task || undefined,
    workspace: workspace || undefined,
  };
}

// ----------------- WEB PUSH -----------------
// Delivers notifications to the device even when the app tab is closed
// (the service worker in public/push-sw.js displays them). No-op when the
// VAPID keys aren't configured.
let vapidReady: boolean | null = null;
function ensureVapid(): boolean {
  if (vapidReady !== null) return vapidReady;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  vapidReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  if (vapidReady) webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@axetask.app', VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
  return vapidReady;
}

export async function savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await db.insert(schema.pushSubscriptions)
    .values({ endpoint: sub.endpoint, user_id: userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { user_id: userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function deletePushSubscription(endpoint: string, userId: string) {
  await db.delete(schema.pushSubscriptions).where(and(
    eq(schema.pushSubscriptions.endpoint, endpoint),
    eq(schema.pushSubscriptions.user_id, userId),
  ));
}

// Native mobile app (Android) push goes through Firebase Cloud Messaging.
// No-op until FIREBASE_SERVICE_ACCOUNT (the service-account JSON of the
// Firebase project the app's google-services.json belongs to) is set.
let fcmReady: boolean | null = null;
function ensureFcm(): boolean {
  if (fcmReady !== null) return fcmReady;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  fcmReady = false;
  if (!raw) return false;
  try {
    if (!getFirebaseApps().length) initFirebaseAdmin({ credential: cert(JSON.parse(raw)) });
    fcmReady = true;
  } catch (err) {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT:', err);
  }
  return fcmReady;
}

export async function saveMobilePushToken(userId: string, token: string, channel?: string | null) {
  await db.insert(schema.mobilePushTokens)
    .values({ token, user_id: userId, channel: channel || null })
    .onConflictDoUpdate({ target: schema.mobilePushTokens.token, set: { user_id: userId, channel: channel || null } });
}

export async function deleteMobilePushToken(token: string, userId: string) {
  await db.delete(schema.mobilePushTokens).where(and(
    eq(schema.mobilePushTokens.token, token),
    eq(schema.mobilePushTokens.user_id, userId),
  ));
}

export interface PushPayload {
  id: string;
  title: string;
  body?: string;
  url: string;
  // Lets the mobile app open the right screen on tap.
  type?: string;
  task_id?: string;
  workspace_id?: string;
  conversation_id?: string;
}

async function sendWebPush(userId: string, payload: PushPayload) {
  if (!ensureVapid()) return;
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.user_id, userId));
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 60 * 60, urgency: 'high' },
      );
    } catch (err: any) {
      // 404/410 = the browser dropped this subscription; forget it.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, s.endpoint));
      } else {
        console.error('Web push failed:', err?.statusCode, err?.body || err);
      }
    }
  }));
}

async function sendMobilePush(userId: string, payload: PushPayload) {
  if (!ensureFcm()) return;
  const tokens = await db.select().from(schema.mobilePushTokens).where(eq(schema.mobilePushTokens.user_id, userId));
  await Promise.all(tokens.map(async t => {
    try {
      await getMessaging().send({
        token: t.token,
        notification: { title: payload.title, body: payload.body },
        data: Object.fromEntries(Object.entries(payload).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])),
        android: {
          priority: 'high',
          ttl: 24 * 60 * 60 * 1000,
          notification: { channelId: t.channel || 'harmonic_success_loud', tag: payload.id, color: '#2563EB' },
        },
      });
    } catch (err: any) {
      if (err?.code === 'messaging/registration-token-not-registered' || err?.code === 'messaging/invalid-argument') {
        await db.delete(schema.mobilePushTokens).where(eq(schema.mobilePushTokens.token, t.token));
      } else {
        console.error('Mobile push failed:', err?.code || err);
      }
    }
  }));
}

// Best-effort: never fails the caller because of push.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    await Promise.all([sendWebPush(userId, payload), sendMobilePush(userId, payload)]);
  } catch (err) {
    console.error('Failed to send push:', err);
  }
}

// Messages aren't stored as notifications, so they're pushed directly.
export async function pushNewMessage(conversationId: string, sender: { id: string; name: string }, content: string) {
  const participants = await db.select().from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.conversation_id, conversationId));
  await Promise.all(participants.filter(p => p.user_id !== sender.id).map(p => sendPushToUser(p.user_id, {
    id: `conv-${conversationId}`,
    title: `Message de ${sender.name}`,
    body: content.length > 140 ? `${content.slice(0, 140)}…` : content,
    url: '/',
    type: 'message',
    conversation_id: conversationId,
  })));
}

export async function createNotification(data: {
  user_id: string;
  type: NotificationType;
  title: string;
  message?: string;
  task_id?: string;
  workspace_id?: string;
}): Promise<AppNotification> {
  try {
    const [created] = await db.insert(schema.notifications).values({
      id: generateId('ntf'),
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      task_id: data.task_id,
      workspace_id: data.workspace_id,
    }).returning();
    await sendPushToUser(data.user_id, {
      id: created.id,
      title: data.title,
      body: data.message,
      url: '/',
      type: data.type,
      task_id: data.task_id,
      workspace_id: data.workspace_id,
    });
    return formatNotification(created);
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUserNotifications(userId: string, limit: number = 50): Promise<AppNotification[]> {
  try {
    const rows = await db.select().from(schema.notifications)
      .where(eq(schema.notifications.user_id, userId))
      .orderBy(desc(schema.notifications.created_at))
      .limit(limit);

    const taskIds = [...new Set(rows.map(r => r.task_id).filter(Boolean))] as string[];
    const wsIds = [...new Set(rows.map(r => r.workspace_id).filter(Boolean))] as string[];

    const tasksList = taskIds.length > 0
      ? await db.select({ id: schema.tasks.id, title: schema.tasks.title }).from(schema.tasks).where(inArray(schema.tasks.id, taskIds))
      : [];
    const wsList = wsIds.length > 0
      ? await db.select({ id: schema.workspaces.id, name: schema.workspaces.name }).from(schema.workspaces).where(inArray(schema.workspaces.id, wsIds))
      : [];

    return rows.map(r => formatNotification(
      r,
      r.task_id ? tasksList.find(t => t.id === r.task_id) || null : null,
      r.workspace_id ? wsList.find(w => w.id === r.workspace_id) || null : null,
    ));
  } catch (error) {
    console.error('Failed to get user notifications:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const rows = await db.select({ id: schema.notifications.id }).from(schema.notifications)
      .where(and(eq(schema.notifications.user_id, userId), eq(schema.notifications.is_read, false)));
    return rows.length;
  } catch (error) {
    console.error('Failed to get unread notification count:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  try {
    const result = await db.update(schema.notifications)
      .set({ is_read: true, read_at: sql`coalesce(${schema.notifications.read_at}, now())` })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.user_id, userId)))
      .returning();
    return result.length > 0;
  } catch (error) {
    console.error('Failed to mark notification read:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await db.update(schema.notifications)
      .set({ is_read: true, read_at: new Date() })
      .where(and(eq(schema.notifications.user_id, userId), eq(schema.notifications.is_read, false)));
  } catch (error) {
    console.error('Failed to mark all notifications read:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteNotification(id: string, userId: string): Promise<boolean> {
  try {
    const result = await db.delete(schema.notifications)
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.user_id, userId)))
      .returning();
    return result.length > 0;
  } catch (error) {
    console.error('Failed to delete notification:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function deleteAllNotifications(userId: string): Promise<void> {
  try {
    await db.delete(schema.notifications).where(eq(schema.notifications.user_id, userId));
  } catch (error) {
    console.error('Failed to delete all notifications:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Scans active tasks whose chrono is overdue (end_at passed, not 'termine')
// and notifies their assignee, at most once per task per type per day
// (checked against notifications already created today). This is also the
// "chrono rouge" notification for tasks. Meant to be called by a daily cron.
export async function createDueDateNotifications(): Promise<{ created: number }> {
  try {
    const now = new Date();
    const todayStart = new Date(now.toISOString().split('T')[0]);
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const dueTasks = await db.select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      end_at: schema.tasks.end_at,
      assignee_id: schema.tasks.assignee_id,
    }).from(schema.tasks)
      .where(and(
        ne(schema.tasks.status, 'termine'),
        sql`${schema.tasks.end_at} IS NOT NULL`,
      ));

    const relevant = dueTasks.filter(t => t.assignee_id && t.end_at);
    if (relevant.length === 0) return { created: 0 };

    const taskIds = relevant.map(t => t.id);
    const existingToday = await db.select({
      task_id: schema.notifications.task_id,
      type: schema.notifications.type,
    }).from(schema.notifications)
      .where(and(
        inArray(schema.notifications.task_id, taskIds),
        sql`${schema.notifications.created_at} >= CURRENT_DATE`,
      ));

    const alreadyNotified = new Set(existingToday.map(n => `${n.task_id}:${n.type}`));

    let created = 0;
    for (const task of relevant) {
      const endAt = task.end_at!;
      const isOverdue = endAt.getTime() < now.getTime();
      const isDueToday = !isOverdue && endAt >= todayStart && endAt < todayEnd;
      if (!isOverdue && !isDueToday) continue;

      const type: NotificationType = isOverdue ? 'task_overdue' : 'task_due_today';
      const key = `${task.id}:${type}`;
      if (alreadyNotified.has(key)) continue;

      await createNotification({
        user_id: task.assignee_id!,
        type,
        title: isOverdue ? 'Tâche en retard' : "Échéance aujourd'hui",
        message: isOverdue
          ? `"${task.title}" a dépassé son échéance.`
          : `"${task.title}" est à rendre aujourd'hui.`,
        task_id: task.id,
      });
      created++;
    }

    return { created };
  } catch (error) {
    console.error('Failed to create due date notifications:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// ==================== ACTIVITY LOG ====================

export async function logActivity(data: {
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  path: string;
  entity_label?: string | null;
  details?: unknown;
}): Promise<void> {
  await db.insert(schema.activityLogs).values({
    id: generateId('act'),
    user_id: data.user_id || null,
    user_name: data.user_name || null,
    action: data.action,
    path: data.path,
    entity_label: data.entity_label || null,
    details: data.details ?? null,
  });
}

export async function getActivityLogs(opts: { q?: string; userId?: string; limit: number; offset: number }): Promise<ActivityLog[]> {
  const conds = [];
  if (opts.userId) conds.push(eq(schema.activityLogs.user_id, opts.userId));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(sql`(${schema.activityLogs.action} ILIKE ${like} OR ${schema.activityLogs.entity_label} ILIKE ${like} OR ${schema.activityLogs.user_name} ILIKE ${like})`);
  }
  const rows = await db.select().from(schema.activityLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.activityLogs.created_at))
    .limit(opts.limit)
    .offset(opts.offset);
  return rows.map(r => ({
    ...r,
    details: r.details as ActivityLog['details'],
    created_at: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
  }));
}

// ==================== COMMAND CENTER SCOPE ====================
// Compact rows for every workspace the user can access; all KPIs, charts and
// drill-downs are computed from this one payload (src/lib/insights.ts), so
// they can't disagree with each other. ponytail: one payload of all tasks,
// fine for thousands of tasks; paginate/aggregate in SQL past ~20k.

export async function getAccessibleWorkspaceIds(userId: string, isGlobalAdmin: boolean): Promise<{ id: string; role: string }[]> {
  if (isGlobalAdmin) {
    const rows = await db.select({ id: schema.workspaces.id }).from(schema.workspaces);
    return rows.map(r => ({ id: r.id, role: 'admin' }));
  }
  const rows = await db.select({ id: schema.workspaceMembers.workspace_id, role: schema.workspaceMembers.role })
    .from(schema.workspaceMembers).where(eq(schema.workspaceMembers.user_id, userId));
  return rows;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export async function getInsightsScope(userId: string, isGlobalAdmin: boolean) {
  const access = await getAccessibleWorkspaceIds(userId, isGlobalAdmin);
  const wsIds = access.map(a => a.id);
  const empty = { generated_at: new Date().toISOString(), workspaces: [], projects: [], tasks: [], users: [], notifications: [] };
  if (!wsIds.length) return empty;

  const [wsRows, prjRows] = await Promise.all([
    db.select({ id: schema.workspaces.id, name: schema.workspaces.name, color: schema.workspaces.color })
      .from(schema.workspaces).where(inArray(schema.workspaces.id, wsIds)),
    db.select().from(schema.projects).where(inArray(schema.projects.workspace_id, wsIds)),
  ]);
  const prjIds = prjRows.map(p => p.id);
  const wsOfProject = new Map(prjRows.map(p => [p.id, p.workspace_id]));
  const taskRows = prjIds.length ? await db.select({
    id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, priority: schema.tasks.priority,
    project_id: schema.tasks.project_id, assignee_id: schema.tasks.assignee_id, created_by: schema.tasks.created_by,
    created_at: schema.tasks.created_at, start_at: schema.tasks.start_at, end_at: schema.tasks.end_at,
    completed_at: schema.tasks.completed_at, blocked_at: schema.tasks.blocked_at, stopped_at: schema.tasks.stopped_at,
    estimated_minutes: schema.tasks.estimated_minutes,
  }).from(schema.tasks).where(inArray(schema.tasks.project_id, prjIds)) : [];

  const memberRows = await db.selectDistinct({ id: schema.users.id, name: schema.users.name, avatar_url: schema.users.avatar_url })
    .from(schema.users)
    .innerJoin(schema.workspaceMembers, eq(schema.workspaceMembers.user_id, schema.users.id))
    .where(inArray(schema.workspaceMembers.workspace_id, wsIds));
  const known = new Set(memberRows.map(u => u.id));
  const missing = [...new Set(taskRows.flatMap(t => [t.assignee_id, t.created_by]).filter(id => id && !known.has(id)))] as string[];
  const extraUsers = missing.length
    ? await db.select({ id: schema.users.id, name: schema.users.name, avatar_url: schema.users.avatar_url }).from(schema.users).where(inArray(schema.users.id, missing))
    : [];

  // Alert analytics: own alerts for members, all alerts for global admins.
  const notifRows = await db.select({
    type: schema.notifications.type, created_at: schema.notifications.created_at,
    is_read: schema.notifications.is_read, read_at: schema.notifications.read_at,
  }).from(schema.notifications)
    .where(and(
      isGlobalAdmin ? sql`true` : eq(schema.notifications.user_id, userId),
      sql`${schema.notifications.created_at} >= now() - interval '180 days'`,
    ));

  return {
    generated_at: new Date().toISOString(),
    workspaces: wsRows.map(w => ({ ...w, my_role: (access.find(a => a.id === w.id)?.role || 'member') as 'admin' | 'member' })),
    projects: prjRows.map(p => ({
      id: p.id, name: p.name, workspace_id: p.workspace_id, created_by: p.created_by,
      start_at: iso(p.start_at), end_at: iso(p.end_at), completed_at: iso(p.completed_at), stopped_at: iso(p.stopped_at),
      created_at: iso(p.created_at) || new Date(0).toISOString(),
    })),
    tasks: taskRows.map(t => ({
      ...t, workspace_id: wsOfProject.get(t.project_id)!,
      created_at: iso(t.created_at) || new Date(0).toISOString(), start_at: iso(t.start_at), end_at: iso(t.end_at),
      completed_at: iso(t.completed_at), blocked_at: iso(t.blocked_at), stopped_at: iso(t.stopped_at),
    })),
    users: [...memberRows, ...extraUsers],
    notifications: notifRows.map(n => ({ type: n.type, created_at: iso(n.created_at)!, is_read: n.is_read, read_at: iso(n.read_at) })),
  };
}

export async function searchEverything(userId: string, isGlobalAdmin: boolean, q: string) {
  const wsIds = (await getAccessibleWorkspaceIds(userId, isGlobalAdmin)).map(a => a.id);
  if (!wsIds.length || !q.trim()) return { tasks: [], projects: [] };
  const pattern = `%${q.trim().replace(/[%_\\]/g, m => `\\${m}`)}%`;
  const [tasks, projects] = await Promise.all([
    db.select({ id: schema.tasks.id, title: schema.tasks.title, status: schema.tasks.status, project_id: schema.projects.id, project_name: schema.projects.name, workspace_id: schema.projects.workspace_id })
      .from(schema.tasks).innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.project_id))
      .where(and(inArray(schema.projects.workspace_id, wsIds), ilike(schema.tasks.title, pattern)))
      .limit(8),
    db.select({ id: schema.projects.id, name: schema.projects.name, workspace_id: schema.projects.workspace_id })
      .from(schema.projects)
      .where(and(inArray(schema.projects.workspace_id, wsIds), ilike(schema.projects.name, pattern)))
      .limit(6),
  ]);
  return { tasks, projects };
}
