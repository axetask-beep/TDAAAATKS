import { relations } from 'drizzle-orm';
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const jobFunctions = pgTable('job_functions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  avatar_url: text('avatar_url'),
  password_hash: text('password_hash'),
  function_id: text('function_id').references(() => jobFunctions.id, { onDelete: 'set null' }),
  last_seen_at: timestamp('last_seen_at'),
  // Opt-in: individual AXP leaderboards only list users who chose to appear.
  show_in_leaderboard: boolean('show_in_leaderboard').notNull().default(false),
  created_at: timestamp('created_at').defaultNow(),
});

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#2563EB'),
  icon: text('icon').notNull().default('Briefcase'),
  photo_url: text('photo_url'),
  created_by: text('created_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  joined_at: timestamp('joined_at').defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('en_cours'),
  start_at: timestamp('start_at'),
  end_at: timestamp('end_at'),
  completed_at: timestamp('completed_at'),
  stopped_at: timestamp('stopped_at'),
  link: text('link'),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow(),
});

export const projectMembers = pgTable('project_members', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  added_at: timestamp('added_at').defaultNow(),
}, (t) => [
  index('project_members_project_id_idx').on(t.project_id),
  uniqueIndex('project_members_unique_idx').on(t.project_id, t.user_id),
]);

export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#2563EB'),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('a_faire'),
  priority: text('priority').notNull().default('normale'),
  assignee_id: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  start_at: timestamp('start_at'),
  end_at: timestamp('end_at'),
  completed_at: timestamp('completed_at'),
  stopped_at: timestamp('stopped_at'),
  // Set when the task enters 'bloque', cleared when it leaves it.
  blocked_at: timestamp('blocked_at'),
  estimated_minutes: integer('estimated_minutes'),
  position: integer('position').default(0),
  created_by: text('created_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
});

export const taskTags = pgTable('task_tags', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  tag_id: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

export const subtasks = pgTable('subtasks', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  completed: boolean('completed').default(false),
  created_at: timestamp('created_at').defaultNow(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const attachments = pgTable('attachments', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  file_name: text('file_name').notNull(),
  file_url: text('file_url').notNull(),
  file_size: integer('file_size'),
  file_type: text('file_type'),
  created_at: timestamp('created_at').defaultNow(),
});

export const timeEntries = pgTable('time_entries', {
  id: text('id').primaryKey(),
  task_id: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id),
  duration_minutes: integer('duration_minutes').notNull(),
  note: text('note'),
  date: text('date').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  is_group: boolean('is_group').notNull().default(false),
  name: text('name'),
  created_by: text('created_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
});

export const conversationParticipants = pgTable('conversation_participants', {
  id: text('id').primaryKey(),
  conversation_id: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joined_at: timestamp('joined_at').defaultNow(),
  last_read_at: timestamp('last_read_at'),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  conversation_id: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  sender_id: text('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  reply_to_id: text('reply_to_id').references((): any => messages.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow(),
});

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  created_by: text('created_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('announcements_created_at_idx').on(t.created_at),
]);

// Audit trail: one row per successful mutating API call (see auditMiddleware
// in src/server/app.ts). user_name is copied so entries survive user deletion.
export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  user_name: text('user_name'),
  action: text('action').notNull(),
  path: text('path').notNull(),
  entity_label: text('entity_label'),
  details: jsonb('details'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('activity_logs_created_at_idx').on(t.created_at.desc()),
]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // 'task_assigned' | 'task_due_today' | 'task_overdue' | 'workspace_added'
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  task_id: text('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  workspace_id: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  is_read: boolean('is_read').notNull().default(false),
  read_at: timestamp('read_at'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('notifications_user_id_idx').on(t.user_id),
  index('notifications_task_id_idx').on(t.task_id),
]);

// One row per browser/device that accepted Web Push for a user.
export const pushSubscriptions = pgTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('push_subscriptions_user_id_idx').on(t.user_id),
]);

// One row per installed mobile app (native FCM device token).
export const mobilePushTokens = pgTable('mobile_push_tokens', {
  token: text('token').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Android notification channel (= the sound the user picked in the app).
  channel: text('channel'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('mobile_push_tokens_user_id_idx').on(t.user_id),
]);

// AXP ledger: one row per rewarded business event. event_key is unique so the
// same event can never be paid twice; reopening/deleting a task revokes its
// row (revoked_at) instead of deleting it, so every correction stays traceable.
export const xpEvents = pgTable('xp_events', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspace_id: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  task_id: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  // 'task_completed' | 'blocker_resolved' | 'kudos' | 'project_completed' | 'correction'
  kind: text('kind').notNull(),
  points: integer('points').notNull(),
  event_key: text('event_key').notNull(),
  reason: text('reason'),
  meta: jsonb('meta'),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  revoked_at: timestamp('revoked_at'),
  revoked_reason: text('revoked_reason'),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('xp_events_event_key_idx').on(t.event_key),
  index('xp_events_user_id_idx').on(t.user_id),
  index('xp_events_workspace_id_idx').on(t.workspace_id),
]);

// Time-boxed collective goals for a workspace (team).
export const challenges = pgTable('challenges', {
  id: text('id').primaryKey(),
  workspace_id: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  // 'blockers_resolved' | 'validated_tasks' | 'overdue_reduction' | 'on_time_rate'
  metric: text('metric').notNull(),
  target: integer('target').notNull(),
  baseline: integer('baseline'),
  reward: text('reward'),
  start_at: timestamp('start_at').notNull(),
  end_at: timestamp('end_at').notNull(),
  created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').defaultNow(),
}, (t) => [
  index('challenges_workspace_id_idx').on(t.workspace_id),
]);

// Relationships
export const jobFunctionsRelations = relations(jobFunctions, ({ many }) => ({
  users: many(users),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.created_by],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  workspacesCreated: many(workspaces),
  workspaceMemberships: many(workspaceMembers),
  assignedTasks: many(tasks),
  comments: many(comments),
  timeEntries: many(timeEntries),
  jobFunction: one(jobFunctions, {
    fields: [users.function_id],
    references: [jobFunctions.id],
  }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [workspaces.created_by],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  projects: many(projects),
  tags: many(tags),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspace_id],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.user_id],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspace_id],
    references: [workspaces.id],
  }),
  tasks: many(tasks),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tags.workspace_id],
    references: [workspaces.id],
  }),
  taskTags: many(taskTags),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignee_id],
    references: [users.id],
  }),
  subtasks: many(subtasks),
  comments: many(comments),
  attachments: many(attachments),
  timeEntries: many(timeEntries),
  taskTags: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, {
    fields: [taskTags.task_id],
    references: [tasks.id],
  }),
  tag: one(tags, {
    fields: [taskTags.tag_id],
    references: [tags.id],
  }),
}));

export const subtasksRelations = relations(subtasks, ({ one }) => ({
  task: one(tasks, {
    fields: [subtasks.task_id],
    references: [tasks.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, {
    fields: [comments.task_id],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [comments.user_id],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  task: one(tasks, {
    fields: [attachments.task_id],
    references: [tasks.id],
  }),
  uploader: one(users, {
    fields: [attachments.user_id],
    references: [users.id],
  }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  task: one(tasks, {
    fields: [timeEntries.task_id],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [timeEntries.user_id],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversation_id],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.user_id],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversation_id],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.sender_id],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [notifications.task_id],
    references: [tasks.id],
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspace_id],
    references: [workspaces.id],
  }),
}));
