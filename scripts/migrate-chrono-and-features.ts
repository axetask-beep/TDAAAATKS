// One-off migration for: project/task chrono (start_at/end_at/completed_at),
// workspace photos, job functions, message replies, and presence.
// This repo has no drizzle-kit migration pipeline (tables were hand-created);
// this script follows that same convention (see scripts/create-notifications-table.ts).
// Run with:
//   npx tsx scripts/migrate-chrono-and-features.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../src/db/index.ts';

async function main() {
  // --- Projects: replace `deadline` with start_at/end_at, add created_by + completed_at ---
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS end_at TIMESTAMP;`);
  await db.execute(sql`
    UPDATE projects SET end_at = (deadline || ' 23:59:59')::timestamp
    WHERE deadline IS NOT NULL AND end_at IS NULL;
  `);
  await db.execute(sql`ALTER TABLE projects DROP COLUMN IF EXISTS deadline;`);
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id) ON DELETE SET NULL;`);

  // --- Tasks: replace `due_date` with start_at/end_at, add completed_at ---
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_at TIMESTAMP;`);
  await db.execute(sql`
    UPDATE tasks SET end_at = (due_date || ' 23:59:59')::timestamp
    WHERE due_date IS NOT NULL AND end_at IS NULL;
  `);
  await db.execute(sql`ALTER TABLE tasks DROP COLUMN IF EXISTS due_date;`);
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`);
  await db.execute(sql`
    UPDATE tasks SET completed_at = created_at WHERE status = 'termine' AND completed_at IS NULL;
  `);

  // --- Workspaces: photo ---
  await db.execute(sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS photo_url TEXT;`);

  // --- Job functions ---
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS job_functions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS function_id TEXT REFERENCES job_functions(id) ON DELETE SET NULL;`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;`);

  const defaults = ['CEO', 'CTO', 'CMO', 'DEV', 'Télévendeur(closers)', 'Monteur vidéo'];
  for (const name of defaults) {
    const existing = await db.execute(sql`SELECT id FROM job_functions WHERE name = ${name} LIMIT 1;`);
    if (existing.rows.length === 0) {
      await db.execute(sql`INSERT INTO job_functions (id, name) VALUES (${'jf_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16)}, ${name});`);
    }
  }

  // --- Messages: reply-to ---
  await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL;`);

  console.log('Chrono/features migration complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-chrono-and-features failed:', err);
  process.exit(1);
});
