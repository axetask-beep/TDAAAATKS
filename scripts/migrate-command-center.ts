// One-off, idempotent migration for the Command Center / AXP release:
// tasks.blocked_at, notifications.read_at, users.show_in_leaderboard,
// xp_events and challenges tables.
// Run with: npx tsx scripts/migrate-command-center.ts
// (check which DATABASE_URL / SQL_* it will use first — .env may point at prod)
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_leaderboard BOOLEAN NOT NULL DEFAULT false;`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS xp_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL CONSTRAINT xp_events_user_id_users_id_fk REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT CONSTRAINT xp_events_workspace_id_workspaces_id_fk REFERENCES workspaces(id) ON DELETE SET NULL,
      task_id TEXT CONSTRAINT xp_events_task_id_tasks_id_fk REFERENCES tasks(id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      points INTEGER NOT NULL,
      event_key TEXT NOT NULL,
      reason TEXT,
      meta JSONB,
      created_by TEXT CONSTRAINT xp_events_created_by_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
      revoked_at TIMESTAMP,
      revoked_reason TEXT,
      created_at TIMESTAMP DEFAULT now()
    );`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS xp_events_event_key_idx ON xp_events (event_key);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS xp_events_user_id_idx ON xp_events (user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS xp_events_workspace_id_idx ON xp_events (workspace_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL CONSTRAINT challenges_workspace_id_workspaces_id_fk REFERENCES workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      metric TEXT NOT NULL,
      target INTEGER NOT NULL,
      baseline INTEGER,
      reward TEXT,
      start_at TIMESTAMP NOT NULL,
      end_at TIMESTAMP NOT NULL,
      created_by TEXT CONSTRAINT challenges_created_by_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT now()
    );`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS challenges_workspace_id_idx ON challenges (workspace_id);`);
  console.log('Command Center / AXP schema ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-command-center failed:', err);
  process.exit(1);
});
