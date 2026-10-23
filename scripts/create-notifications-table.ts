// One-off migration: creates the `notifications` table (see src/db/schema.ts).
// This repo has no drizzle-kit migration pipeline (tables were hand-created);
// this script follows that same convention. Run with:
//   npx tsx scripts/create-notifications-table.ts
// Point it at any database via DATABASE_URL or SQL_HOST/... in .env.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS notifications_task_id_idx ON notifications(task_id);`);

  console.log('notifications table ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('create-notifications-table failed:', err);
  process.exit(1);
});
