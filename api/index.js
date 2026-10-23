var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/app.ts
import express from "express";
import crypto2 from "crypto";
import cors from "cors";

// src/db/queries.ts
import { eq, and, desc, asc, inArray, ne, sql } from "drizzle-orm";

// src/db/index.ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  attachments: () => attachments,
  attachmentsRelations: () => attachmentsRelations,
  comments: () => comments,
  commentsRelations: () => commentsRelations,
  conversationParticipants: () => conversationParticipants,
  conversationParticipantsRelations: () => conversationParticipantsRelations,
  conversations: () => conversations,
  conversationsRelations: () => conversationsRelations,
  messages: () => messages,
  messagesRelations: () => messagesRelations,
  notifications: () => notifications,
  notificationsRelations: () => notificationsRelations,
  projects: () => projects,
  projectsRelations: () => projectsRelations,
  subtasks: () => subtasks,
  subtasksRelations: () => subtasksRelations,
  tags: () => tags,
  tagsRelations: () => tagsRelations,
  taskTags: () => taskTags,
  taskTagsRelations: () => taskTagsRelations,
  tasks: () => tasks,
  tasksRelations: () => tasksRelations,
  timeEntries: () => timeEntries,
  timeEntriesRelations: () => timeEntriesRelations,
  users: () => users,
  usersRelations: () => usersRelations,
  workspaceMembers: () => workspaceMembers,
  workspaceMembersRelations: () => workspaceMembersRelations,
  workspaces: () => workspaces,
  workspacesRelations: () => workspacesRelations
});
import { relations } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: text("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  // 'admin' | 'member'
  avatar_url: text("avatar_url"),
  password_hash: text("password_hash"),
  created_at: timestamp("created_at").defaultNow()
});
var workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#2563EB"),
  icon: text("icon").notNull().default("Briefcase"),
  created_by: text("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow()
});
var workspaceMembers = pgTable("workspace_members", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  // 'admin' | 'member'
  joined_at: timestamp("joined_at").defaultNow()
});
var projects = pgTable("projects", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("en_cours"),
  deadline: text("deadline"),
  created_at: timestamp("created_at").defaultNow()
});
var tags = pgTable("tags", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#2563EB")
});
var tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  project_id: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("a_faire"),
  priority: text("priority").notNull().default("normale"),
  assignee_id: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
  due_date: text("due_date"),
  position: integer("position").default(0),
  created_by: text("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow()
});
var taskTags = pgTable("task_tags", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  tag_id: text("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" })
});
var subtasks = pgTable("subtasks", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").default(false),
  created_at: timestamp("created_at").defaultNow()
});
var comments = pgTable("comments", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow()
});
var attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id),
  file_name: text("file_name").notNull(),
  file_url: text("file_url").notNull(),
  file_size: integer("file_size"),
  file_type: text("file_type"),
  created_at: timestamp("created_at").defaultNow()
});
var timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey(),
  task_id: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id),
  duration_minutes: integer("duration_minutes").notNull(),
  note: text("note"),
  date: text("date").notNull(),
  created_at: timestamp("created_at").defaultNow()
});
var conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  is_group: boolean("is_group").notNull().default(false),
  name: text("name"),
  created_by: text("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow()
});
var conversationParticipants = pgTable("conversation_participants", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  joined_at: timestamp("joined_at").defaultNow(),
  last_read_at: timestamp("last_read_at")
});
var messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversation_id: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  sender_id: text("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow()
});
var notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // 'task_assigned' | 'task_due_today' | 'task_overdue' | 'workspace_added'
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message"),
  task_id: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  workspace_id: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  is_read: boolean("is_read").notNull().default(false),
  created_at: timestamp("created_at").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  workspacesCreated: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  assignedTasks: many(tasks),
  comments: many(comments),
  timeEntries: many(timeEntries)
}));
var workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspaces.created_by],
    references: [users.id]
  }),
  members: many(workspaceMembers),
  projects: many(projects),
  tags: many(tags)
}));
var workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspace_id],
    references: [workspaces.id]
  }),
  user: one(users, {
    fields: [workspaceMembers.user_id],
    references: [users.id]
  })
}));
var projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspace_id],
    references: [workspaces.id]
  }),
  tasks: many(tasks)
}));
var tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tags.workspace_id],
    references: [workspaces.id]
  }),
  taskTags: many(taskTags)
}));
var tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id]
  }),
  assignee: one(users, {
    fields: [tasks.assignee_id],
    references: [users.id]
  }),
  subtasks: many(subtasks),
  comments: many(comments),
  attachments: many(attachments),
  timeEntries: many(timeEntries),
  taskTags: many(taskTags)
}));
var taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.task_id],
    references: [tasks.id]
  }),
  tag: one(tags, {
    fields: [taskTags.tag_id],
    references: [tags.id]
  })
}));
var subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.task_id],
    references: [tasks.id]
  })
}));
var commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.task_id],
    references: [tasks.id]
  }),
  author: one(users, {
    fields: [comments.user_id],
    references: [users.id]
  })
}));
var attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.task_id],
    references: [tasks.id]
  }),
  uploader: one(users, {
    fields: [attachments.user_id],
    references: [users.id]
  })
}));
var timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, {
    fields: [timeEntries.task_id],
    references: [tasks.id]
  }),
  user: one(users, {
    fields: [timeEntries.user_id],
    references: [users.id]
  })
}));
var conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages)
}));
var conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversation_id],
    references: [conversations.id]
  }),
  user: one(users, {
    fields: [conversationParticipants.user_id],
    references: [users.id]
  })
}));
var messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversation_id],
    references: [conversations.id]
  }),
  sender: one(users, {
    fields: [messages.sender_id],
    references: [users.id]
  })
}));
var notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id]
  }),
  task: one(tasks, {
    fields: [notifications.task_id],
    references: [tasks.id]
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspace_id],
    references: [workspaces.id]
  })
}));

// src/db/index.ts
function buildPoolConfig() {
  const useSsl = process.env.SQL_SSL === "true";
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : void 0,
      max: 10,
      connectionTimeoutMillis: 5e3
    };
  }
  return {
    host: process.env.SQL_HOST || "127.0.0.1",
    user: process.env.SQL_USER || "postgres",
    password: process.env.SQL_PASSWORD || "postgres",
    database: process.env.SQL_DB_NAME || "axetask",
    ssl: useSsl ? { rejectUnauthorized: false } : void 0,
    max: 10,
    connectionTimeoutMillis: 5e3
  };
}
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());
    global._postgresPool.on("error", (err) => {
      console.error("Postgres pool error:", err.message);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/db/queries.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";
function generateId(prefix = "") {
  return prefix ? `${prefix}_${crypto.randomBytes(8).toString("hex")}` : crypto.randomUUID();
}
var BCRYPT_ROUNDS = 12;
function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}
function isLegacySha256Hash(hash) {
  return /^[a-f0-9]{64}$/i.test(hash);
}
function verifyPassword(password, hash) {
  if (!hash) return false;
  if (isLegacySha256Hash(hash)) {
    return crypto.createHash("sha256").update(password).digest("hex") === hash;
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
async function getAllUsers() {
  try {
    const rows = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatar_url: users.avatar_url,
      created_at: users.created_at
    }).from(users);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      avatar_url: r.avatar_url || void 0,
      created_at: r.created_at ? r.created_at.toISOString() : void 0
    }));
  } catch (error) {
    console.error("Failed to get users:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUserById(id) {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUserByEmail(email) {
  try {
    const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get user by email:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createUser(email, password, name) {
  try {
    const id = generateId("usr");
    const password_hash = hashPassword(password);
    const [created] = await db.insert(users).values({
      id,
      uid: id,
      email: email.toLowerCase().trim(),
      name,
      role: "member",
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563EB`,
      password_hash
    }).returning();
    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      avatar_url: created.avatar_url || void 0,
      created_at: created.created_at ? created.created_at.toISOString() : void 0
    };
  } catch (error) {
    console.error("Failed to create user:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateUserProfile(id, updates) {
  try {
    const [updated] = await db.update(users).set({
      ...updates.name ? { name: updates.name } : {},
      ...updates.avatar_url !== void 0 ? { avatar_url: updates.avatar_url } : {}
    }).where(eq(users.id, id)).returning();
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatar_url: updated.avatar_url || void 0,
      created_at: updated.created_at ? updated.created_at.toISOString() : void 0
    };
  } catch (error) {
    console.error("Failed to update user profile:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateUserRole(id, role) {
  try {
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      avatar_url: updated.avatar_url || void 0,
      created_at: updated.created_at ? updated.created_at.toISOString() : void 0
    };
  } catch (error) {
    console.error("Failed to update user role:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createUserWithRole(email, password, name, role = "member") {
  try {
    const id = generateId("usr");
    const password_hash = hashPassword(password);
    const [created] = await db.insert(users).values({
      id,
      uid: id,
      email: email.toLowerCase().trim(),
      name,
      role,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=2563EB`,
      password_hash
    }).returning();
    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      avatar_url: created.avatar_url || void 0,
      created_at: created.created_at ? created.created_at.toISOString() : void 0
    };
  } catch (error) {
    console.error("Failed to create user with role:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteUser(id) {
  try {
    await db.update(workspaces).set({ created_by: null }).where(eq(workspaces.created_by, id));
    await db.update(tasks).set({ created_by: null }).where(eq(tasks.created_by, id));
    await db.update(tasks).set({ assignee_id: null }).where(eq(tasks.assignee_id, id));
    await db.delete(comments).where(eq(comments.user_id, id));
    await db.delete(attachments).where(eq(attachments.user_id, id));
    await db.delete(timeEntries).where(eq(timeEntries.user_id, id));
    await db.delete(workspaceMembers).where(eq(workspaceMembers.user_id, id));
    await db.delete(messages).where(eq(messages.sender_id, id));
    await db.delete(conversationParticipants).where(eq(conversationParticipants.user_id, id));
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUserWorkspaces(userId, isGlobalAdmin = false) {
  try {
    let wsList = [];
    let memberships = [];
    if (isGlobalAdmin) {
      wsList = await db.select().from(workspaces);
      memberships = await db.select().from(workspaceMembers);
    } else {
      memberships = await db.select().from(workspaceMembers).where(eq(workspaceMembers.user_id, userId));
      const wsIds = memberships.map((m) => m.workspace_id);
      if (wsIds.length === 0) return [];
      wsList = await db.select().from(workspaces).where(inArray(workspaces.id, wsIds));
    }
    const allProjects = await db.select().from(projects);
    const allTasks = await db.select().from(tasks);
    const allMembers = await db.select().from(workspaceMembers);
    return wsList.map((ws) => {
      const wsMembers = allMembers.filter((m) => m.workspace_id === ws.id);
      const wsProjects = allProjects.filter((p) => p.workspace_id === ws.id);
      const projectIds = wsProjects.map((p) => p.id);
      const wsTasks = allTasks.filter((t) => projectIds.includes(t.project_id));
      const userMembership = wsMembers.find((m) => m.user_id === userId);
      const myRole = isGlobalAdmin ? "admin" : userMembership?.role || "member";
      return {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        created_at: ws.created_at ? ws.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        member_count: wsMembers.length,
        projects_count: wsProjects.length,
        total_tasks_count: wsTasks.length,
        active_tasks_count: wsTasks.filter((t) => t.status !== "termine").length,
        completed_tasks_count: wsTasks.filter((t) => t.status === "termine").length,
        my_role: myRole
      };
    });
  } catch (error) {
    console.error("Failed to get user workspaces:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getWorkspaceById(id) {
  try {
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    const ws = rows[0];
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      icon: ws.icon,
      created_at: ws.created_at ? ws.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to get workspace by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createWorkspace(name, color = "#2563EB", icon = "Briefcase", creatorId) {
  try {
    const id = generateId("ws");
    const [ws] = await db.insert(workspaces).values({
      id,
      name,
      color,
      icon,
      created_by: creatorId
    }).returning();
    await db.insert(workspaceMembers).values({
      id: generateId("wm"),
      workspace_id: id,
      user_id: creatorId,
      role: "admin"
    });
    return {
      id: ws.id,
      name: ws.name,
      color: ws.color,
      icon: ws.icon,
      created_at: ws.created_at ? ws.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      member_count: 1,
      projects_count: 0,
      total_tasks_count: 0,
      active_tasks_count: 0,
      completed_tasks_count: 0,
      my_role: "admin"
    };
  } catch (error) {
    console.error("Failed to create workspace:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateWorkspace(id, updates) {
  try {
    const [updated] = await db.update(workspaces).set({
      ...updates.name ? { name: updates.name } : {},
      ...updates.color ? { color: updates.color } : {},
      ...updates.icon ? { icon: updates.icon } : {}
    }).where(eq(workspaces.id, id)).returning();
    if (!updated) return null;
    return {
      id: updated.id,
      name: updated.name,
      color: updated.color,
      icon: updated.icon,
      created_at: updated.created_at ? updated.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to update workspace:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteWorkspace(id) {
  try {
    await db.delete(workspaces).where(eq(workspaces.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function userCanAccessWorkspace(userId, workspaceId, isGlobalAdmin = false) {
  if (isGlobalAdmin) return true;
  try {
    const rows = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId))).limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error("Failed to check workspace access:", error);
    return false;
  }
}
async function userIsWorkspaceAdmin(userId, workspaceId, isGlobalAdmin = false) {
  if (isGlobalAdmin) return true;
  try {
    const rows = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId), eq(workspaceMembers.role, "admin"))).limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error("Failed to check workspace admin:", error);
    return false;
  }
}
async function getWorkspaceMembers(workspaceId) {
  try {
    const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspace_id, workspaceId));
    const allUsers = await getAllUsers();
    return members.map((m) => {
      const u = allUsers.find((user) => user.id === m.user_id);
      return {
        id: m.id,
        workspace_id: m.workspace_id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at ? m.joined_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        user: u
      };
    });
  } catch (error) {
    console.error("Failed to get workspace members:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function addWorkspaceMember(workspaceId, userId, role = "member") {
  try {
    const existing = await db.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId))).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, existing[0].id)).returning();
      const u2 = await getUserById(userId);
      return {
        id: updated.id,
        workspace_id: updated.workspace_id,
        user_id: updated.user_id,
        role: updated.role,
        joined_at: updated.joined_at ? updated.joined_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        user: u2 ? {
          id: u2.id,
          email: u2.email,
          name: u2.name,
          role: u2.role,
          avatar_url: u2.avatar_url || void 0
        } : void 0
      };
    }
    const [created] = await db.insert(workspaceMembers).values({
      id: generateId("wm"),
      workspace_id: workspaceId,
      user_id: userId,
      role
    }).returning();
    const u = await getUserById(userId);
    return {
      id: created.id,
      workspace_id: created.workspace_id,
      user_id: created.user_id,
      role: created.role,
      joined_at: created.joined_at ? created.joined_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to add workspace member:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function ensureWorkspaceMembership(workspaceId, userId) {
  try {
    const existing = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId))).limit(1);
    if (existing.length === 0) {
      await addWorkspaceMember(workspaceId, userId, "member");
    }
  } catch (error) {
    console.error("Failed to ensure workspace membership:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function removeWorkspaceMember(workspaceId, userId) {
  try {
    await db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspace_id, workspaceId), eq(workspaceMembers.user_id, userId)));
    return true;
  } catch (error) {
    console.error("Failed to remove workspace member:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateWorkspaceMemberById(memberId, role) {
  try {
    const [updated] = await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, memberId)).returning();
    if (!updated) return null;
    const u = await getUserById(updated.user_id);
    return {
      id: updated.id,
      workspace_id: updated.workspace_id,
      user_id: updated.user_id,
      role: updated.role,
      joined_at: updated.joined_at ? updated.joined_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to update workspace member by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function removeWorkspaceMemberById(memberId) {
  try {
    const [removed] = await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId)).returning();
    return removed ? { user_id: removed.user_id, workspace_id: removed.workspace_id } : null;
  } catch (error) {
    console.error("Failed to remove workspace member by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getWorkspaceProjects(workspaceId) {
  try {
    const prjs = await db.select().from(projects).where(eq(projects.workspace_id, workspaceId)).orderBy(desc(projects.created_at));
    const prjIds = prjs.map((p) => p.id);
    let allTasks = [];
    if (prjIds.length > 0) {
      allTasks = await db.select().from(tasks).where(inArray(tasks.project_id, prjIds));
    }
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return prjs.map((p) => {
      const pTasks = allTasks.filter((t) => t.project_id === p.id);
      return {
        id: p.id,
        workspace_id: p.workspace_id,
        name: p.name,
        description: p.description || void 0,
        status: p.status,
        deadline: p.deadline || void 0,
        created_at: p.created_at ? p.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        tasks_count: pTasks.length,
        active_tasks_count: pTasks.filter((t) => t.status !== "termine").length,
        completed_tasks_count: pTasks.filter((t) => t.status === "termine").length,
        workspace: ws ? {
          id: ws.id,
          name: ws.name,
          color: ws.color,
          icon: ws.icon,
          created_at: ws.created_at ? ws.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
        } : void 0
      };
    });
  } catch (error) {
    console.error("Failed to get workspace projects:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getProjectById(id) {
  try {
    const [p] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!p) return null;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, p.workspace_id)).limit(1);
    const pTasks = await db.select().from(tasks).where(eq(tasks.project_id, p.id));
    return {
      id: p.id,
      workspace_id: p.workspace_id,
      name: p.name,
      description: p.description || void 0,
      status: p.status,
      deadline: p.deadline || void 0,
      created_at: p.created_at ? p.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      tasks_count: pTasks.length,
      active_tasks_count: pTasks.filter((t) => t.status !== "termine").length,
      completed_tasks_count: pTasks.filter((t) => t.status === "termine").length,
      workspace: ws ? {
        id: ws.id,
        name: ws.name,
        color: ws.color,
        icon: ws.icon,
        created_at: ws.created_at ? ws.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
      } : void 0
    };
  } catch (error) {
    console.error("Failed to get project by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createProject(workspaceId, name, description, deadline, status = "en_cours") {
  try {
    const id = generateId("prj");
    const [created] = await db.insert(projects).values({
      id,
      workspace_id: workspaceId,
      name,
      description,
      deadline,
      status
    }).returning();
    return {
      id: created.id,
      workspace_id: created.workspace_id,
      name: created.name,
      description: created.description || void 0,
      status: created.status,
      deadline: created.deadline || void 0,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      tasks_count: 0,
      active_tasks_count: 0,
      completed_tasks_count: 0
    };
  } catch (error) {
    console.error("Failed to create project:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateProject(id, updates) {
  try {
    const [updated] = await db.update(projects).set({
      ...updates.name ? { name: updates.name } : {},
      ...updates.description !== void 0 ? { description: updates.description } : {},
      ...updates.status ? { status: updates.status } : {},
      ...updates.deadline !== void 0 ? { deadline: updates.deadline } : {}
    }).where(eq(projects.id, id)).returning();
    if (!updated) return null;
    return getProjectById(id);
  } catch (error) {
    console.error("Failed to update project:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteProject(id) {
  try {
    await db.delete(projects).where(eq(projects.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete project:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getWorkspaceTags(workspaceId) {
  try {
    const rows = await db.select().from(tags).where(eq(tags.workspace_id, workspaceId));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      workspace_id: r.workspace_id
    }));
  } catch (error) {
    console.error("Failed to get workspace tags:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createTag(workspaceId, name, color = "#2563EB") {
  try {
    const id = generateId("tag");
    const [created] = await db.insert(tags).values({
      id,
      workspace_id: workspaceId,
      name,
      color
    }).returning();
    return {
      id: created.id,
      name: created.name,
      color: created.color,
      workspace_id: created.workspace_id
    };
  } catch (error) {
    console.error("Failed to create tag:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getTagById(id) {
  try {
    const rows = await db.select({ id: tags.id, workspace_id: tags.workspace_id }).from(tags).where(eq(tags.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get tag by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteTag(id) {
  try {
    await db.delete(tags).where(eq(tags.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete tag:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function populateTaskDetails(t) {
  const [project] = await db.select().from(projects).where(eq(projects.id, t.project_id)).limit(1);
  let workspace;
  if (project) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, project.workspace_id)).limit(1);
    workspace = ws;
  }
  const assignee = t.assignee_id ? await getUserById(t.assignee_id) : null;
  const creator = t.created_by ? await getUserById(t.created_by) : null;
  const subtasksList = await db.select().from(subtasks).where(eq(subtasks.task_id, t.id)).orderBy(asc(subtasks.created_at));
  const commentsList = await db.select().from(comments).where(eq(comments.task_id, t.id)).orderBy(desc(comments.created_at));
  const attachmentsList = await db.select().from(attachments).where(eq(attachments.task_id, t.id)).orderBy(desc(attachments.created_at));
  const timeEntriesList = await db.select().from(timeEntries).where(eq(timeEntries.task_id, t.id)).orderBy(desc(timeEntries.created_at));
  const taskTagsList = await db.select().from(taskTags).where(eq(taskTags.task_id, t.id));
  const tagIds = taskTagsList.map((tt) => tt.tag_id);
  let tagsList = [];
  if (tagIds.length > 0) {
    const rawTags = await db.select().from(tags).where(inArray(tags.id, tagIds));
    tagsList = rawTags.map((rt) => ({
      id: rt.id,
      name: rt.name,
      color: rt.color,
      workspace_id: rt.workspace_id
    }));
  }
  const allUsers = await getAllUsers();
  const totalMinutes = timeEntriesList.reduce((sum, te) => sum + te.duration_minutes, 0);
  return {
    id: t.id,
    project_id: t.project_id,
    workspace_id: project?.workspace_id,
    title: t.title,
    description: t.description || void 0,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    created_by: t.created_by || "",
    position: t.position || 0,
    created_at: t.created_at ? t.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: t.created_at ? t.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    assignee: assignee ? {
      id: assignee.id,
      email: assignee.email,
      name: assignee.name,
      role: assignee.role,
      avatar_url: assignee.avatar_url || void 0
    } : null,
    creator: creator ? {
      id: creator.id,
      email: creator.email,
      name: creator.name,
      role: creator.role,
      avatar_url: creator.avatar_url || void 0
    } : null,
    project: project ? {
      id: project.id,
      workspace_id: project.workspace_id,
      name: project.name,
      description: project.description || void 0,
      status: project.status,
      deadline: project.deadline || void 0,
      created_at: project.created_at ? project.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    } : void 0,
    workspace: workspace ? {
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      icon: workspace.icon,
      created_at: workspace.created_at ? workspace.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    } : void 0,
    subtasks: subtasksList.map((s) => ({
      id: s.id,
      task_id: s.task_id,
      title: s.title,
      completed: !!s.completed,
      created_at: s.created_at ? s.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    })),
    comments: commentsList.map((c) => ({
      id: c.id,
      task_id: c.task_id,
      user_id: c.user_id,
      content: c.content,
      created_at: c.created_at ? c.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: allUsers.find((u) => u.id === c.user_id)
    })),
    attachments: attachmentsList.map((a) => ({
      id: a.id,
      task_id: a.task_id,
      file_url: a.file_url,
      file_name: a.file_name,
      file_size: a.file_size || void 0,
      file_type: a.file_type || void 0,
      uploaded_by: a.user_id,
      created_at: a.created_at ? a.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      uploader: allUsers.find((u) => u.id === a.user_id)
    })),
    time_entries: timeEntriesList.map((te) => ({
      id: te.id,
      task_id: te.task_id,
      user_id: te.user_id,
      duration_minutes: te.duration_minutes,
      note: te.note || void 0,
      date: te.date,
      created_at: te.created_at ? te.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: allUsers.find((u) => u.id === te.user_id)
    })),
    tags: tagsList,
    total_time_minutes: totalMinutes
  };
}
async function getProjectTasks(projectId) {
  try {
    const rawTasks = await db.select().from(tasks).where(eq(tasks.project_id, projectId)).orderBy(asc(tasks.position), desc(tasks.created_at));
    const tasks2 = await Promise.all(rawTasks.map((t) => populateTaskDetails(t)));
    return tasks2;
  } catch (error) {
    console.error("Failed to get project tasks:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUserDashboardTasks(userId, isGlobalAdmin = false) {
  try {
    const allWorkspaces = await getUserWorkspaces(userId, isGlobalAdmin);
    const wsIds = allWorkspaces.map((w) => w.id);
    if (wsIds.length === 0) return [];
    const wsProjects = await db.select().from(projects).where(inArray(projects.workspace_id, wsIds));
    const prjIds = wsProjects.map((p) => p.id);
    if (prjIds.length === 0) return [];
    let rawTasks = [];
    if (isGlobalAdmin) {
      rawTasks = await db.select().from(tasks).where(inArray(tasks.project_id, prjIds)).orderBy(desc(tasks.created_at));
    } else {
      rawTasks = await db.select().from(tasks).where(and(inArray(tasks.project_id, prjIds), eq(tasks.assignee_id, userId))).orderBy(desc(tasks.created_at));
    }
    return Promise.all(rawTasks.map((t) => populateTaskDetails(t)));
  } catch (error) {
    console.error("Failed to get dashboard tasks:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getTaskById(id) {
  try {
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!t) return null;
    return populateTaskDetails(t);
  } catch (error) {
    console.error("Failed to get task by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createTask(data) {
  try {
    const id = generateId("tsk");
    const existing = await db.select().from(tasks).where(eq(tasks.project_id, data.project_id));
    const maxPosition = existing.reduce((max, t) => Math.max(max, t.position || 0), -1);
    const [created] = await db.insert(tasks).values({
      id,
      project_id: data.project_id,
      title: data.title,
      description: data.description,
      status: data.status || "a_faire",
      priority: data.priority || "normale",
      assignee_id: data.assignee_id || null,
      due_date: data.due_date || null,
      position: maxPosition + 1,
      created_by: data.created_by
    }).returning();
    if (data.tag_ids && data.tag_ids.length > 0) {
      for (const tagId of data.tag_ids) {
        await db.insert(taskTags).values({
          id: generateId("tt"),
          task_id: id,
          tag_id: tagId
        });
      }
    }
    const fullTask = await getTaskById(id);
    if (!fullTask) throw new Error("Task created but could not be retrieved");
    return fullTask;
  } catch (error) {
    console.error("Failed to create task:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateTask(id, updates) {
  try {
    const setPayload = {};
    if (updates.title !== void 0) setPayload.title = updates.title;
    if (updates.description !== void 0) setPayload.description = updates.description;
    if (updates.status !== void 0) setPayload.status = updates.status;
    if (updates.priority !== void 0) setPayload.priority = updates.priority;
    if (updates.assignee_id !== void 0) setPayload.assignee_id = updates.assignee_id;
    if (updates.due_date !== void 0) setPayload.due_date = updates.due_date;
    if (updates.position !== void 0) setPayload.position = updates.position;
    if (Object.keys(setPayload).length > 0) {
      await db.update(tasks).set(setPayload).where(eq(tasks.id, id));
    }
    if (updates.tag_ids !== void 0) {
      await db.delete(taskTags).where(eq(taskTags.task_id, id));
      for (const tagId of updates.tag_ids) {
        await db.insert(taskTags).values({
          id: generateId("tt"),
          task_id: id,
          tag_id: tagId
        });
      }
    }
    return getTaskById(id);
  } catch (error) {
    console.error("Failed to update task:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function reorderTasks(items) {
  try {
    for (const item of items) {
      await db.update(tasks).set({ status: item.status, position: item.position }).where(eq(tasks.id, item.id));
    }
  } catch (error) {
    console.error("Failed to reorder tasks:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteTask(id) {
  try {
    await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete task:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function addSubtask(taskId, title) {
  try {
    const id = generateId("sub");
    const [created] = await db.insert(subtasks).values({
      id,
      task_id: taskId,
      title,
      completed: false
    }).returning();
    return {
      id: created.id,
      task_id: created.task_id,
      title: created.title,
      completed: !!created.completed,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to add subtask:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getSubtaskById(id) {
  try {
    const rows = await db.select({ id: subtasks.id, task_id: subtasks.task_id }).from(subtasks).where(eq(subtasks.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get subtask by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function updateSubtask(id, updates) {
  try {
    const [updated] = await db.update(subtasks).set({
      ...updates.completed !== void 0 ? { completed: updates.completed } : {},
      ...updates.title ? { title: updates.title } : {}
    }).where(eq(subtasks.id, id)).returning();
    if (!updated) return null;
    return {
      id: updated.id,
      task_id: updated.task_id,
      title: updated.title,
      completed: !!updated.completed,
      created_at: updated.created_at ? updated.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.error("Failed to update subtask:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteSubtask(id) {
  try {
    await db.delete(subtasks).where(eq(subtasks.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete subtask:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function addComment(taskId, userId, content) {
  try {
    const id = generateId("com");
    const [created] = await db.insert(comments).values({
      id,
      task_id: taskId,
      user_id: userId,
      content
    }).returning();
    const u = await getUserById(userId);
    return {
      id: created.id,
      task_id: created.task_id,
      user_id: created.user_id,
      content: created.content,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to add comment:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getCommentById(id) {
  try {
    const rows = await db.select({ id: comments.id, task_id: comments.task_id, user_id: comments.user_id }).from(comments).where(eq(comments.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get comment by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteComment(id) {
  try {
    await db.delete(comments).where(eq(comments.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete comment:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function addAttachment(taskId, userId, fileName, fileUrl, fileSize, fileType) {
  try {
    const id = generateId("att");
    const [created] = await db.insert(attachments).values({
      id,
      task_id: taskId,
      user_id: userId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      file_type: fileType
    }).returning();
    const u = await getUserById(userId);
    return {
      id: created.id,
      task_id: created.task_id,
      file_name: created.file_name,
      file_url: created.file_url,
      file_size: created.file_size || void 0,
      file_type: created.file_type || void 0,
      uploaded_by: created.user_id,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      uploader: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to add attachment:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getAttachmentById(id) {
  try {
    const rows = await db.select({ id: attachments.id, task_id: attachments.task_id, user_id: attachments.user_id }).from(attachments).where(eq(attachments.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get attachment by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteAttachment(id) {
  try {
    await db.delete(attachments).where(eq(attachments.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete attachment:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function logTime(taskId, userId, durationMinutes, note, date) {
  try {
    const id = generateId("te");
    const [created] = await db.insert(timeEntries).values({
      id,
      task_id: taskId,
      user_id: userId,
      duration_minutes: durationMinutes,
      note,
      date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    }).returning();
    const u = await getUserById(userId);
    return {
      id: created.id,
      task_id: created.task_id,
      user_id: created.user_id,
      duration_minutes: created.duration_minutes,
      note: created.note || void 0,
      date: created.date,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      user: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to log time:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getTimeEntryById(id) {
  try {
    const rows = await db.select({ id: timeEntries.id, task_id: timeEntries.task_id, user_id: timeEntries.user_id }).from(timeEntries).where(eq(timeEntries.id, id)).limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error("Failed to get time entry by id:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteTimeEntry(id) {
  try {
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
    return true;
  } catch (error) {
    console.error("Failed to delete time entry:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getTimeEntries(userId, isGlobalAdmin = false, filters = {}) {
  try {
    const allWorkspaces = await getUserWorkspaces(userId, isGlobalAdmin);
    const accessibleWsIds = allWorkspaces.map((w) => w.id);
    if (accessibleWsIds.length === 0) return [];
    const wsFilter = filters.workspace_id && filters.workspace_id !== "all" ? [filters.workspace_id] : accessibleWsIds;
    const allProjects = await db.select().from(projects).where(inArray(projects.workspace_id, wsFilter));
    const prjFilter = filters.project_id && filters.project_id !== "all" ? allProjects.filter((p) => p.id === filters.project_id) : allProjects;
    const prjIds = prjFilter.map((p) => p.id);
    if (prjIds.length === 0) return [];
    const allTasks = await db.select().from(tasks).where(inArray(tasks.project_id, prjIds));
    const taskIds = allTasks.map((t) => t.id);
    if (taskIds.length === 0) return [];
    let entries = await db.select().from(timeEntries).where(inArray(timeEntries.task_id, taskIds)).orderBy(desc(timeEntries.date), desc(timeEntries.created_at));
    if (filters.user_id) {
      entries = entries.filter((e) => e.user_id === filters.user_id);
    }
    const allUsers = await getAllUsers();
    return entries.map((e) => {
      const task = allTasks.find((t) => t.id === e.task_id);
      const prj = task ? allProjects.find((p) => p.id === task.project_id) : void 0;
      const ws = prj ? allWorkspaces.find((w) => w.id === prj.workspace_id) : void 0;
      return {
        id: e.id,
        task_id: e.task_id,
        user_id: e.user_id,
        duration_minutes: e.duration_minutes,
        note: e.note || void 0,
        date: e.date,
        created_at: e.created_at ? e.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
        user: allUsers.find((u) => u.id === e.user_id),
        task: task ? {
          id: task.id,
          title: task.title,
          project_id: task.project_id,
          project_name: prj?.name,
          workspace_id: prj?.workspace_id,
          workspace_name: ws?.name,
          workspace_color: ws?.color
        } : void 0
      };
    });
  } catch (error) {
    console.error("Failed to get time entries:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function ensureAdminUser() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    return;
  }
  try {
    const existing = await getUserByEmail(ADMIN_EMAIL);
    if (!existing) {
      await createUserWithRole(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, "admin");
      console.log(`[AxeTask DB] Created initial admin account ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.warn("[AxeTask DB] Could not ensure admin account:", err);
  }
}
async function hydrateConversation(conversationId, currentUserId) {
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  if (!conv) return null;
  const participantRows = await db.select().from(conversationParticipants).where(eq(conversationParticipants.conversation_id, conversationId));
  const allUsers = await getAllUsers();
  const participants = participantRows.map((p) => allUsers.find((u) => u.id === p.user_id)).filter((u) => !!u);
  const [lastMessageRow] = await db.select().from(messages).where(eq(messages.conversation_id, conversationId)).orderBy(desc(messages.created_at)).limit(1);
  const myParticipant = participantRows.find((p) => p.user_id === currentUserId);
  let unread_count = 0;
  if (myParticipant) {
    const unreadWhere = myParticipant.last_read_at ? and(
      eq(messages.conversation_id, conversationId),
      ne(messages.sender_id, currentUserId),
      sql`${messages.created_at} > ${myParticipant.last_read_at}`
    ) : and(
      eq(messages.conversation_id, conversationId),
      ne(messages.sender_id, currentUserId)
    );
    const [{ count }] = await db.select({ count: sql`count(*)::int` }).from(messages).where(unreadWhere);
    unread_count = count || 0;
  }
  return {
    id: conv.id,
    is_group: !!conv.is_group,
    name: conv.name,
    created_at: conv.created_at ? conv.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    participants,
    last_message: lastMessageRow ? {
      id: lastMessageRow.id,
      conversation_id: lastMessageRow.conversation_id,
      sender_id: lastMessageRow.sender_id,
      content: lastMessageRow.content,
      created_at: lastMessageRow.created_at ? lastMessageRow.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString()
    } : null,
    unread_count
  };
}
async function getUserConversations(userId) {
  try {
    const myParticipations = await db.select().from(conversationParticipants).where(eq(conversationParticipants.user_id, userId));
    const conversations2 = await Promise.all(
      myParticipations.map((p) => hydrateConversation(p.conversation_id, userId))
    );
    const valid = conversations2.filter((c) => !!c);
    valid.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
    return valid;
  } catch (error) {
    console.error("Failed to get user conversations:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function userIsConversationParticipant(userId, conversationId) {
  try {
    const rows = await db.select().from(conversationParticipants).where(and(eq(conversationParticipants.conversation_id, conversationId), eq(conversationParticipants.user_id, userId))).limit(1);
    return rows.length > 0;
  } catch (error) {
    console.error("Failed to check conversation membership:", error);
    return false;
  }
}
async function findOrCreateDirectConversation(userId, otherUserId) {
  if (userId === otherUserId) {
    throw new Error("Impossible de d\xE9marrer une conversation avec soi-m\xEAme.");
  }
  try {
    const myConvIds = (await db.select().from(conversationParticipants).where(eq(conversationParticipants.user_id, userId))).map((p) => p.conversation_id);
    if (myConvIds.length > 0) {
      const candidateParticipants = await db.select().from(conversationParticipants).where(and(inArray(conversationParticipants.conversation_id, myConvIds), eq(conversationParticipants.user_id, otherUserId)));
      for (const cp of candidateParticipants) {
        const [conv] = await db.select().from(conversations).where(eq(conversations.id, cp.conversation_id)).limit(1);
        if (conv && !conv.is_group) {
          const hydrated2 = await hydrateConversation(conv.id, userId);
          if (hydrated2) return hydrated2;
        }
      }
    }
    const id = generateId("conv");
    await db.insert(conversations).values({
      id,
      is_group: false,
      created_by: userId
    });
    await db.insert(conversationParticipants).values([
      { id: generateId("cp"), conversation_id: id, user_id: userId },
      { id: generateId("cp"), conversation_id: id, user_id: otherUserId }
    ]);
    const hydrated = await hydrateConversation(id, userId);
    if (!hydrated) throw new Error("Conversation created but could not be retrieved");
    return hydrated;
  } catch (error) {
    console.error("Failed to find or create direct conversation:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getConversationMessages(conversationId, limit = 50, before) {
  try {
    const whereClause = before ? and(eq(messages.conversation_id, conversationId), sql`${messages.created_at} < ${new Date(before)}`) : eq(messages.conversation_id, conversationId);
    const rows = await db.select().from(messages).where(whereClause).orderBy(desc(messages.created_at)).limit(limit);
    const allUsers = await getAllUsers();
    return rows.reverse().map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      content: m.content,
      created_at: m.created_at ? m.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      sender: allUsers.find((u) => u.id === m.sender_id)
    }));
  } catch (error) {
    console.error("Failed to get conversation messages:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function sendMessage(conversationId, senderId, content) {
  try {
    const id = generateId("msg");
    const [created] = await db.insert(messages).values({
      id,
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim()
    }).returning();
    const u = await getUserById(senderId);
    return {
      id: created.id,
      conversation_id: created.conversation_id,
      sender_id: created.sender_id,
      content: created.content,
      created_at: created.created_at ? created.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
      sender: u ? {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar_url: u.avatar_url || void 0
      } : void 0
    };
  } catch (error) {
    console.error("Failed to send message:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function markConversationRead(conversationId, userId) {
  try {
    await db.update(conversationParticipants).set({ last_read_at: /* @__PURE__ */ new Date() }).where(and(eq(conversationParticipants.conversation_id, conversationId), eq(conversationParticipants.user_id, userId)));
  } catch (error) {
    console.error("Failed to mark conversation read:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
function formatNotification(row, task, workspace) {
  return {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    task_id: row.task_id,
    workspace_id: row.workspace_id,
    is_read: row.is_read ?? false,
    created_at: row.created_at ? row.created_at.toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    task: task || void 0,
    workspace: workspace || void 0
  };
}
async function createNotification(data) {
  try {
    const [created] = await db.insert(notifications).values({
      id: generateId("ntf"),
      user_id: data.user_id,
      type: data.type,
      title: data.title,
      message: data.message,
      task_id: data.task_id,
      workspace_id: data.workspace_id
    }).returning();
    return formatNotification(created);
  } catch (error) {
    console.error("Failed to create notification:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUserNotifications(userId, limit = 50) {
  try {
    const rows = await db.select().from(notifications).where(eq(notifications.user_id, userId)).orderBy(desc(notifications.created_at)).limit(limit);
    const taskIds = [...new Set(rows.map((r) => r.task_id).filter(Boolean))];
    const wsIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))];
    const tasksList = taskIds.length > 0 ? await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, taskIds)) : [];
    const wsList = wsIds.length > 0 ? await db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(inArray(workspaces.id, wsIds)) : [];
    return rows.map((r) => formatNotification(
      r,
      r.task_id ? tasksList.find((t) => t.id === r.task_id) || null : null,
      r.workspace_id ? wsList.find((w) => w.id === r.workspace_id) || null : null
    ));
  } catch (error) {
    console.error("Failed to get user notifications:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function getUnreadNotificationCount(userId) {
  try {
    const rows = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
    return rows.length;
  } catch (error) {
    console.error("Failed to get unread notification count:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function markNotificationRead(id, userId) {
  try {
    const result = await db.update(notifications).set({ is_read: true }).where(and(eq(notifications.id, id), eq(notifications.user_id, userId))).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Failed to mark notification read:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function markAllNotificationsRead(userId) {
  try {
    await db.update(notifications).set({ is_read: true }).where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)));
  } catch (error) {
    console.error("Failed to mark all notifications read:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteNotification(id, userId) {
  try {
    const result = await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.user_id, userId))).returning();
    return result.length > 0;
  } catch (error) {
    console.error("Failed to delete notification:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function deleteAllNotifications(userId) {
  try {
    await db.delete(notifications).where(eq(notifications.user_id, userId));
  } catch (error) {
    console.error("Failed to delete all notifications:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}
async function createDueDateNotifications() {
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const dueTasks = await db.select({
      id: tasks.id,
      title: tasks.title,
      due_date: tasks.due_date,
      assignee_id: tasks.assignee_id
    }).from(tasks).where(and(
      ne(tasks.status, "termine"),
      sql`${tasks.due_date} IS NOT NULL`,
      sql`${tasks.due_date} <= ${today}`
    ));
    const relevant = dueTasks.filter((t) => t.assignee_id);
    if (relevant.length === 0) return { created: 0 };
    const taskIds = relevant.map((t) => t.id);
    const existingToday = await db.select({
      task_id: notifications.task_id,
      type: notifications.type
    }).from(notifications).where(and(
      inArray(notifications.task_id, taskIds),
      sql`${notifications.created_at} >= CURRENT_DATE`
    ));
    const alreadyNotified = new Set(existingToday.map((n) => `${n.task_id}:${n.type}`));
    let created = 0;
    for (const task of relevant) {
      const isOverdue = task.due_date < today;
      const type = isOverdue ? "task_overdue" : "task_due_today";
      const key = `${task.id}:${type}`;
      if (alreadyNotified.has(key)) continue;
      await createNotification({
        user_id: task.assignee_id,
        type,
        title: isOverdue ? "T\xE2che en retard" : "\xC9ch\xE9ance aujourd'hui",
        message: isOverdue ? `"${task.title}" a d\xE9pass\xE9 son \xE9ch\xE9ance.` : `"${task.title}" est \xE0 rendre aujourd'hui.`,
        task_id: task.id
      });
      created++;
    }
    return { created };
  } catch (error) {
    console.error("Failed to create due date notifications:", error);
    throw new Error("Database query failed. Please try again later.", { cause: error });
  }
}

// src/server/app.ts
var cachedJwtSecret = null;
function getJwtSecret() {
  if (cachedJwtSecret) return cachedJwtSecret;
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv) {
    cachedJwtSecret = fromEnv;
    return cachedJwtSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production.");
  }
  console.warn("[AxeTask] JWT_SECRET is not set \u2014 using an insecure development default. Set it in .env.");
  cachedJwtSecret = "axetask-dev-only-insecure-secret";
  return cachedJwtSecret;
}
function createToken(user) {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1e3
    // 30 days
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = crypto2.createHmac("sha256", getJwtSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}
function verifyToken(token) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSig = crypto2.createHmac("sha256", getJwtSecret()).update(encodedPayload).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifi\xE9. Token manquant." });
  }
  const token = authHeader.split(" ")[1];
  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    console.error("Auth token verification error:", err);
    return res.status(500).json({ error: err.message || "Erreur de configuration du serveur." });
  }
  if (!payload) {
    return res.status(401).json({ error: "Session invalide ou expir\xE9e." });
  }
  try {
    const dbUser = await getUserById(payload.id);
    if (!dbUser) {
      return res.status(401).json({ error: "Utilisateur introuvable." });
    }
    const { password_hash, ...safeUser } = dbUser;
    req.user = {
      id: safeUser.id,
      email: safeUser.email,
      name: safeUser.name,
      role: safeUser.role,
      avatar_url: safeUser.avatar_url || void 0,
      created_at: safeUser.created_at ? safeUser.created_at.toISOString() : void 0
    };
    next();
  } catch (err) {
    console.error("Auth verification error:", err);
    return res.status(500).json({ error: "Erreur lors de la v\xE9rification de session." });
  }
}
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "15mb" }));
  const extraAllowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.APP_URL
  ].filter(Boolean);
  app2.use("/api", cors((req, callback) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const sameOrigin = !!origin && !!host && (origin === `http://${host}` || origin === `https://${host}`);
    const allowed = !origin || sameOrigin || extraAllowedOrigins.includes(origin);
    callback(null, { origin: allowed, credentials: true });
  }));
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "postgres", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }
    try {
      const cleanEmail = email.trim().toLowerCase();
      const user = await getUserByEmail(cleanEmail);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect." });
      }
      const { password_hash, ...safeUser } = user;
      const formattedUser = {
        id: safeUser.id,
        email: safeUser.email,
        name: safeUser.name,
        role: safeUser.role,
        avatar_url: safeUser.avatar_url || void 0,
        created_at: safeUser.created_at ? safeUser.created_at.toISOString() : void 0
      };
      const token = createToken(formattedUser);
      res.json({ user: formattedUser, token });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la connexion." });
    }
  });
  app2.post("/api/auth/signup", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nom, email et mot de passe requis." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit comporter au moins 6 caract\xE8res." });
    }
    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Un compte avec cette adresse email existe d\xE9j\xE0." });
      }
      const newUser = await createUser(email, password, name);
      const token = createToken(newUser);
      res.status(201).json({ user: newUser, token });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation de compte." });
    }
  });
  app2.get("/api/auth/me", authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });
  app2.put("/api/auth/profile", authMiddleware, async (req, res) => {
    const { name, avatar_url } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Le nom ne peut pas \xEAtre vide." });
    }
    try {
      const updated = await updateUserProfile(req.user.id, { name, avatar_url });
      res.json({ user: updated });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la mise \xE0 jour du profil." });
    }
  });
  app2.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users2 = await getAllUsers();
      res.json(users2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des membres." });
    }
  });
  app2.post("/api/users", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Action r\xE9serv\xE9e aux administrateurs." });
    }
    const { name, email, password, role } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Nom et adresse email requis." });
    }
    try {
      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Un compte avec cette adresse email existe d\xE9j\xE0." });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Un mot de passe d\u2019au moins 6 caract\xE8res est requis." });
      }
      const newUser = await createUserWithRole(email, password, name, role || "member");
      res.status(201).json({ user: newUser });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation du profil utilisateur." });
    }
  });
  app2.patch("/api/users/:id/role", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Action r\xE9serv\xE9e aux administrateurs." });
    }
    const targetUserId = req.params.id;
    const { role } = req.body;
    if (!role || role !== "admin" && role !== "member") {
      return res.status(400).json({ error: 'R\xF4le invalide (doit \xEAtre "admin" ou "member").' });
    }
    try {
      const updated = await updateUserRole(targetUserId, role);
      res.json({ user: updated });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la modification du r\xF4le." });
    }
  });
  app2.delete("/api/users/:id", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Action r\xE9serv\xE9e aux administrateurs." });
    }
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte administrateur actif." });
    }
    try {
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "Profil utilisateur introuvable." });
      }
      await deleteUser(targetUserId);
      res.json({ success: true, message: `Profil utilisateur ${targetUser.name} supprim\xE9 avec succ\xE8s.` });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression du profil." });
    }
  });
  app2.get("/api/workspaces", authMiddleware, async (req, res) => {
    const user = req.user;
    const isGlobalAdmin = user.role === "admin";
    try {
      const workspaces2 = await getUserWorkspaces(user.id, isGlobalAdmin);
      res.json(workspaces2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des workspaces." });
    }
  });
  app2.post("/api/workspaces", authMiddleware, async (req, res) => {
    const { name, color, icon } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Le nom du workspace est requis." });
    }
    try {
      const ws = await createWorkspace(name, color, icon, req.user.id);
      res.status(201).json(ws);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation du workspace." });
    }
  });
  app2.put("/api/workspaces/:id", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAdmin = await userIsWorkspaceAdmin(req.user.id, wsId, isGlobalAdmin);
      if (!canAdmin) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 : vous devez \xEAtre administrateur du workspace." });
      }
      const { name, color, icon } = req.body;
      const updated = await updateWorkspace(wsId, { name, color, icon });
      if (!updated) return res.status(404).json({ error: "Workspace introuvable." });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la modification du workspace." });
    }
  });
  app2.delete("/api/workspaces/:id", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAdmin = await userIsWorkspaceAdmin(req.user.id, wsId, isGlobalAdmin);
      if (!canAdmin) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 : vous devez \xEAtre administrateur du workspace." });
      }
      await deleteWorkspace(wsId);
      res.json({ success: true, message: "Workspace supprim\xE9 avec succ\xE8s." });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression du workspace." });
    }
  });
  app2.get("/api/workspaces/:id/members", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAccess = await userCanAccessWorkspace(req.user.id, wsId, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      const members = await getWorkspaceMembers(wsId);
      res.json(members);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des membres." });
    }
  });
  app2.post("/api/workspaces/:id/members", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAdmin = await userIsWorkspaceAdmin(req.user.id, wsId, isGlobalAdmin);
      if (!canAdmin) {
        return res.status(403).json({ error: "Seul un administrateur du workspace peut ajouter des membres." });
      }
      const { user_id, email, role } = req.body;
      let targetUserId = user_id;
      if (!targetUserId && email) {
        const targetUser = await getUserByEmail(email);
        if (!targetUser) {
          return res.status(404).json({ error: `Aucun compte trouv\xE9 pour l'adresse ${email}.` });
        }
        targetUserId = targetUser.id;
      }
      if (!targetUserId) {
        return res.status(400).json({ error: "user_id ou email est requis." });
      }
      const member = await addWorkspaceMember(wsId, targetUserId, role || "member");
      const inviter = await getUserById(req.user.id);
      const workspace = await getWorkspaceById(wsId);
      await createNotification({
        user_id: targetUserId,
        type: "workspace_added",
        title: "Ajout\xE9 \xE0 un espace de travail",
        message: `${inviter?.name || "Un administrateur"} vous a ajout\xE9 \xE0 l'espace "${workspace?.name || ""}".`,
        workspace_id: wsId
      }).catch((err) => console.error("Failed to create workspace_added notification:", err));
      res.status(201).json(member);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l ajout de membre." });
    }
  });
  app2.delete("/api/workspaces/:id/members/:userId", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const targetUserId = req.params.userId;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAdmin = await userIsWorkspaceAdmin(req.user.id, wsId, isGlobalAdmin);
      if (!canAdmin && req.user.id !== targetUserId) {
        return res.status(403).json({ error: "Action non autoris\xE9e." });
      }
      await removeWorkspaceMember(wsId, targetUserId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du retrait du membre." });
    }
  });
  app2.put("/api/workspace-members/:id", authMiddleware, async (req, res) => {
    const memberId = req.params.id;
    const { role } = req.body;
    try {
      const updated = await updateWorkspaceMemberById(memberId, role || "member");
      if (!updated) return res.status(404).json({ error: "Membre introuvable." });
      if (updated.user_id !== req.user.id) {
        const workspace = await getWorkspaceById(updated.workspace_id);
        createNotification({
          user_id: updated.user_id,
          type: "workspace_role_changed",
          title: "R\xF4le modifi\xE9",
          message: `${req.user.name} vous a d\xE9fini comme ${updated.role === "admin" ? "administrateur" : "membre"} de "${workspace?.name || ""}".`,
          workspace_id: updated.workspace_id
        }).catch((err) => console.error("Failed to create workspace_role_changed notification:", err));
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la modification du r\xF4le de membre." });
    }
  });
  app2.delete("/api/workspace-members/:id", authMiddleware, async (req, res) => {
    const memberId = req.params.id;
    try {
      const removed = await removeWorkspaceMemberById(memberId);
      if (removed && removed.user_id !== req.user.id) {
        const workspace = await getWorkspaceById(removed.workspace_id);
        createNotification({
          user_id: removed.user_id,
          type: "workspace_removed",
          title: "Retir\xE9 d'un espace de travail",
          message: `${req.user.name} vous a retir\xE9 de l'espace "${workspace?.name || ""}".`
        }).catch((err) => console.error("Failed to create workspace_removed notification:", err));
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du retrait du membre." });
    }
  });
  app2.get("/api/workspaces/:id/projects", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAccess = await userCanAccessWorkspace(req.user.id, wsId, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      const projects2 = await getWorkspaceProjects(wsId);
      res.json(projects2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des projets." });
    }
  });
  app2.post("/api/workspaces/:id/projects", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAccess = await userCanAccessWorkspace(req.user.id, wsId, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      const { name, description, deadline, status } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Le nom du projet est requis." });
      }
      const project = await createProject(wsId, name, description, deadline, status);
      res.status(201).json(project);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation du projet." });
    }
  });
  app2.get("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: "Projet introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAccess = await userCanAccessWorkspace(req.user.id, project.workspace_id, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce projet." });
      }
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration du projet." });
    }
  });
  app2.put("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: "Projet introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAccess = await userCanAccessWorkspace(req.user.id, project.workspace_id, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce projet." });
      }
      const { name, description, status, deadline } = req.body;
      const updated = await updateProject(req.params.id, { name, description, status, deadline });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la modification du projet." });
    }
  });
  app2.delete("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: "Projet introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAdmin = await userIsWorkspaceAdmin(req.user.id, project.workspace_id, isGlobalAdmin);
      if (!canAdmin) {
        return res.status(403).json({ error: "Seul un administrateur du workspace peut supprimer un projet." });
      }
      await deleteProject(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression du projet." });
    }
  });
  app2.get("/api/workspaces/:id/tags", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAccess = await userCanAccessWorkspace(req.user.id, wsId, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      const tags2 = await getWorkspaceTags(wsId);
      res.json(tags2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des tags." });
    }
  });
  app2.post("/api/workspaces/:id/tags", authMiddleware, async (req, res) => {
    const wsId = req.params.id;
    const isGlobalAdmin = req.user.role === "admin";
    try {
      const canAccess = await userCanAccessWorkspace(req.user.id, wsId, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      const { name, color } = req.body;
      if (!name) return res.status(400).json({ error: "Le nom du tag est requis." });
      const tag = await createTag(wsId, name, color);
      res.status(201).json(tag);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation du tag." });
    }
  });
  app2.delete("/api/tags/:id", authMiddleware, async (req, res) => {
    try {
      const tag = await getTagById(req.params.id);
      if (!tag) return res.status(404).json({ error: "Tag introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAccess = await userCanAccessWorkspace(req.user.id, tag.workspace_id, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce workspace." });
      }
      await deleteTag(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression du tag." });
    }
  });
  app2.get("/api/projects/:id/tasks", authMiddleware, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: "Projet introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAccess = await userCanAccessWorkspace(req.user.id, project.workspace_id, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce projet." });
      }
      const tasks2 = await getProjectTasks(req.params.id);
      res.json(tasks2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des t\xE2ches." });
    }
  });
  app2.post("/api/projects/:id/tasks", authMiddleware, async (req, res) => {
    try {
      const project = await getProjectById(req.params.id);
      if (!project) return res.status(404).json({ error: "Projet introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const canAccess = await userCanAccessWorkspace(req.user.id, project.workspace_id, isGlobalAdmin);
      if (!canAccess) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 ce projet." });
      }
      const { title, description, status, priority, assignee_id, due_date, tag_ids } = req.body;
      if (!title) {
        return res.status(400).json({ error: "Le titre de la t\xE2che est requis." });
      }
      const task = await createTask({
        project_id: req.params.id,
        title,
        description,
        status: status || "a_faire",
        priority: priority || "normale",
        assignee_id,
        due_date,
        created_by: req.user.id,
        tag_ids
      });
      if (assignee_id) {
        await ensureWorkspaceMembership(project.workspace_id, assignee_id);
      }
      if (assignee_id && assignee_id !== req.user.id) {
        createNotification({
          user_id: assignee_id,
          type: "task_assigned",
          title: "Nouvelle t\xE2che assign\xE9e",
          message: `${req.user.name} vous a assign\xE9 "${task.title}".`,
          task_id: task.id,
          workspace_id: project.workspace_id
        }).catch((err) => console.error("Failed to create task_assigned notification:", err));
      }
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation de la t\xE2che." });
    }
  });
  app2.get("/api/tasks/dashboard", authMiddleware, async (req, res) => {
    const user = req.user;
    const isGlobalAdmin = user.role === "admin";
    try {
      const tasks2 = await getUserDashboardTasks(user.id, isGlobalAdmin);
      res.json(tasks2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du chargement du tableau de bord." });
    }
  });
  app2.get("/api/tasks/:id", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id) {
        const canAccess = await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin);
        if (!canAccess) {
          return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
        }
      }
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du chargement de la t\xE2che." });
    }
  });
  app2.patch("/api/tasks/:id", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id) {
        const canAccess = await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin);
        if (!canAccess) {
          return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
        }
      }
      const { title, description, status, priority, assignee_id, due_date, tag_ids, position } = req.body;
      const updated = await updateTask(req.params.id, {
        title,
        description,
        status,
        priority,
        assignee_id,
        due_date,
        tag_ids,
        position
      });
      const assigneeChanged = assignee_id !== void 0 && assignee_id !== task.assignee_id;
      if (assigneeChanged && assignee_id && task.workspace_id) {
        await ensureWorkspaceMembership(task.workspace_id, assignee_id);
      }
      if (assigneeChanged && assignee_id && assignee_id !== req.user.id) {
        createNotification({
          user_id: assignee_id,
          type: "task_assigned",
          title: "T\xE2che assign\xE9e",
          message: `${req.user.name} vous a assign\xE9 "${updated?.title || task.title}".`,
          task_id: task.id,
          workspace_id: task.workspace_id || void 0
        }).catch((err) => console.error("Failed to create task_assigned notification:", err));
      }
      const statusChanged = status !== void 0 && status !== task.status;
      if (statusChanged) {
        const STATUS_LABELS = {
          a_faire: "\xC0 faire",
          en_cours: "En cours",
          en_revision: "En r\xE9vision",
          termine: "Termin\xE9",
          bloque: "Bloqu\xE9"
        };
        const recipients = new Set([task.assignee_id, task.created_by].filter(Boolean));
        recipients.delete(req.user.id);
        if (assigneeChanged) recipients.delete(assignee_id);
        for (const recipientId of recipients) {
          createNotification({
            user_id: recipientId,
            type: "task_status_changed",
            title: "Statut de t\xE2che modifi\xE9",
            message: `${req.user.name} a chang\xE9 "${updated?.title || task.title}" en "${STATUS_LABELS[status] || status}".`,
            task_id: task.id,
            workspace_id: task.workspace_id || void 0
          }).catch((err) => console.error("Failed to create task_status_changed notification:", err));
        }
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la mise \xE0 jour de la t\xE2che." });
    }
  });
  app2.post("/api/tasks/reorder", authMiddleware, async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "Format invalide." });
    }
    try {
      const isGlobalAdmin = req.user.role === "admin";
      for (const item of items) {
        const task = await getTaskById(item.id);
        if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
        if (task.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
          return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 une des t\xE2ches." });
        }
      }
      await reorderTasks(items);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du r\xE9ordonnancement." });
    }
  });
  app2.delete("/api/tasks/:id", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id) {
        const canAccess = await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin);
        if (!canAccess) {
          return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
        }
      }
      await deleteTask(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression de la t\xE2che." });
    }
  });
  app2.post("/api/tasks/:id/subtasks", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
      }
      const { title } = req.body;
      if (!title) return res.status(400).json({ error: "Le titre est requis." });
      const subtask = await addSubtask(req.params.id, title);
      res.status(201).json(subtask);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l ajout de la sous-t\xE2che." });
    }
  });
  app2.patch("/api/subtasks/:id", authMiddleware, async (req, res) => {
    const { completed, title } = req.body;
    try {
      const subtask = await getSubtaskById(req.params.id);
      if (!subtask) return res.status(404).json({ error: "Sous-t\xE2che introuvable." });
      const task = await getTaskById(subtask.task_id);
      const isGlobalAdmin = req.user.role === "admin";
      if (task?.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette sous-t\xE2che." });
      }
      const updated = await updateSubtask(req.params.id, { completed, title });
      if (!updated) return res.status(404).json({ error: "Sous-t\xE2che introuvable." });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la mise \xE0 jour de la sous-t\xE2che." });
    }
  });
  app2.delete("/api/subtasks/:id", authMiddleware, async (req, res) => {
    try {
      const subtask = await getSubtaskById(req.params.id);
      if (!subtask) return res.status(404).json({ error: "Sous-t\xE2che introuvable." });
      const task = await getTaskById(subtask.task_id);
      const isGlobalAdmin = req.user.role === "admin";
      if (task?.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette sous-t\xE2che." });
      }
      await deleteSubtask(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression de la sous-t\xE2che." });
    }
  });
  app2.post("/api/tasks/:id/comments", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
      }
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "Le contenu est requis." });
      const comment = await addComment(req.params.id, req.user.id, content);
      const commentRecipients = new Set([task.assignee_id, task.created_by].filter(Boolean));
      commentRecipients.delete(req.user.id);
      for (const recipientId of commentRecipients) {
        createNotification({
          user_id: recipientId,
          type: "task_comment",
          title: "Nouveau commentaire",
          message: `${req.user.name} a comment\xE9 "${task.title}".`,
          task_id: task.id,
          workspace_id: task.workspace_id || void 0
        }).catch((err) => console.error("Failed to create task_comment notification:", err));
      }
      res.status(201).json(comment);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l ajout du commentaire." });
    }
  });
  app2.delete("/api/comments/:id", authMiddleware, async (req, res) => {
    try {
      const comment = await getCommentById(req.params.id);
      if (!comment) return res.status(404).json({ error: "Commentaire introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const task = await getTaskById(comment.task_id);
      const isWorkspaceAdmin = task?.workspace_id ? await userIsWorkspaceAdmin(req.user.id, task.workspace_id, isGlobalAdmin) : isGlobalAdmin;
      if (comment.user_id !== req.user.id && !isWorkspaceAdmin) {
        return res.status(403).json({ error: "Seul l'auteur ou un administrateur peut supprimer ce commentaire." });
      }
      await deleteComment(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression du commentaire." });
    }
  });
  app2.post("/api/tasks/:id/attachments", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
      }
      const { file_name, file_url, file_size, file_type } = req.body;
      if (!file_name || !file_url) {
        return res.status(400).json({ error: "Nom et URL de fichier requis." });
      }
      const attachment = await addAttachment(req.params.id, req.user.id, file_name, file_url, file_size, file_type);
      res.status(201).json(attachment);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l ajout de la pi\xE8ce jointe." });
    }
  });
  app2.delete("/api/attachments/:id", authMiddleware, async (req, res) => {
    try {
      const attachment = await getAttachmentById(req.params.id);
      if (!attachment) return res.status(404).json({ error: "Pi\xE8ce jointe introuvable." });
      const task = await getTaskById(attachment.task_id);
      const isGlobalAdmin = req.user.role === "admin";
      if (task?.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette pi\xE8ce jointe." });
      }
      await deleteAttachment(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression de la pi\xE8ce jointe." });
    }
  });
  app2.post("/api/tasks/:id/time-entries", authMiddleware, async (req, res) => {
    try {
      const task = await getTaskById(req.params.id);
      if (!task) return res.status(404).json({ error: "T\xE2che introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      if (task.workspace_id && !await userCanAccessWorkspace(req.user.id, task.workspace_id, isGlobalAdmin)) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette t\xE2che." });
      }
      const { duration_minutes, note, date } = req.body;
      if (!duration_minutes || duration_minutes <= 0) {
        return res.status(400).json({ error: "Dur\xE9e valide en minutes requise." });
      }
      const entry = await logTime(req.params.id, req.user.id, Number(duration_minutes), note, date);
      res.status(201).json(entry);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l enregistrement du temps." });
    }
  });
  app2.delete("/api/time-entries/:id", authMiddleware, async (req, res) => {
    try {
      const entry = await getTimeEntryById(req.params.id);
      if (!entry) return res.status(404).json({ error: "Entr\xE9e de temps introuvable." });
      const isGlobalAdmin = req.user.role === "admin";
      const task = await getTaskById(entry.task_id);
      const isWorkspaceAdmin = task?.workspace_id ? await userIsWorkspaceAdmin(req.user.id, task.workspace_id, isGlobalAdmin) : isGlobalAdmin;
      if (entry.user_id !== req.user.id && !isWorkspaceAdmin) {
        return res.status(403).json({ error: "Seul l'auteur ou un administrateur peut supprimer cette entr\xE9e de temps." });
      }
      await deleteTimeEntry(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression de l entr\xE9e de temps." });
    }
  });
  app2.get("/api/time-entries", authMiddleware, async (req, res) => {
    const user = req.user;
    const isGlobalAdmin = user.role === "admin";
    const { workspace_id, project_id, user_id } = req.query;
    try {
      const entries = await getTimeEntries(user.id, isGlobalAdmin, {
        workspace_id,
        project_id,
        user_id: user_id || (isGlobalAdmin ? void 0 : user.id)
      });
      res.json(entries);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des temps." });
    }
  });
  app2.get("/api/conversations", authMiddleware, async (req, res) => {
    try {
      const conversations2 = await getUserConversations(req.user.id);
      res.json(conversations2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des conversations." });
    }
  });
  app2.post("/api/conversations", authMiddleware, async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: "user_id est requis." });
    }
    try {
      const targetUser = await getUserById(user_id);
      if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }
      const conversation = await findOrCreateDirectConversation(req.user.id, user_id);
      res.status(201).json(conversation);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la cr\xE9ation de la conversation." });
    }
  });
  app2.get("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
    const conversationId = req.params.id;
    try {
      const isParticipant = await userIsConversationParticipant(req.user.id, conversationId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette conversation." });
      }
      const { before, limit } = req.query;
      const messages2 = await getConversationMessages(conversationId, limit ? Number(limit) : 50, before);
      res.json(messages2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des messages." });
    }
  });
  app2.post("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
    const conversationId = req.params.id;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Le contenu du message est requis." });
    }
    try {
      const isParticipant = await userIsConversationParticipant(req.user.id, conversationId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette conversation." });
      }
      const message = await sendMessage(conversationId, req.user.id, content);
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de l\u2019envoi du message." });
    }
  });
  app2.post("/api/conversations/:id/read", authMiddleware, async (req, res) => {
    const conversationId = req.params.id;
    try {
      const isParticipant = await userIsConversationParticipant(req.user.id, conversationId);
      if (!isParticipant) {
        return res.status(403).json({ error: "Acc\xE8s refus\xE9 \xE0 cette conversation." });
      }
      await markConversationRead(conversationId, req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du marquage de lecture." });
    }
  });
  app2.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const notifications2 = await getUserNotifications(req.user.id);
      res.json(notifications2);
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la r\xE9cup\xE9ration des notifications." });
    }
  });
  app2.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await getUnreadNotificationCount(req.user.id);
      res.json({ count });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du comptage des notifications." });
    }
  });
  app2.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await markAllNotificationsRead(req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du marquage global." });
    }
  });
  app2.post("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      const ok = await markNotificationRead(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ error: "Notification introuvable." });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du marquage de la notification." });
    }
  });
  app2.delete("/api/notifications/:id", authMiddleware, async (req, res) => {
    try {
      const ok = await deleteNotification(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ error: "Notification introuvable." });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression de la notification." });
    }
  });
  app2.delete("/api/notifications", authMiddleware, async (req, res) => {
    try {
      await deleteAllNotifications(req.user.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors de la suppression des notifications." });
    }
  });
  app2.get("/api/cron/due-reminders", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: "Non autoris\xE9." });
      }
    }
    try {
      const result = await createDueDateNotifications();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message || "Erreur lors du scan des \xE9ch\xE9ances." });
    }
  });
  return app2;
}

// src/server/serverless.ts
var app = null;
var initError = null;
try {
  app = createApp();
  await ensureAdminUser().catch((err) => {
    console.warn("[AxeTask Boot] Could not ensure admin account:", err);
  });
} catch (err) {
  initError = err;
  console.error("[AxeTask Boot] Failed to initialize app:", err);
}
function handler(req, res) {
  if (!app) {
    res.status(500).json({
      error: "Server misconfigured \u2014 the app failed to initialize.",
      detail: initError?.message
    });
    return;
  }
  return app(req, res);
}
export {
  handler as default
};
