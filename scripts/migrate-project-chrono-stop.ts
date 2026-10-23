// One-off migration: adds projects.stopped_at (manual chrono stop, distinct
// from completed_at which reflects "all tasks are termine").
// Run with: npx tsx scripts/migrate-project-chrono-stop.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMP;`);
  console.log('projects.stopped_at ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-project-chrono-stop failed:', err);
  process.exit(1);
});
