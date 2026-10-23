// One-off migration: adds tasks.stopped_at (manual chrono pause/close, mirrors
// projects.stopped_at) and tasks.estimated_minutes (a directly-set time
// budget in minutes, shown/edited as days+hours in the task's "Temps" tab).
// Run with: npx tsx scripts/migrate-task-stop-estimate.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMP;`);
  await db.execute(sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;`);
  console.log('tasks.stopped_at / tasks.estimated_minutes ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-task-stop-estimate failed:', err);
  process.exit(1);
});
