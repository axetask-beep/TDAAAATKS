// One-off migration: creates the `project_members` table (see src/db/schema.ts).
// Lets an admin assign/remove members on a specific project, distinct from
// workspace membership.
// Run with: npx tsx scripts/migrate-project-members.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      added_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS project_members_project_id_idx ON project_members(project_id);`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS project_members_unique_idx ON project_members(project_id, user_id);`);

  console.log('project_members table ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-project-members failed:', err);
  process.exit(1);
});
