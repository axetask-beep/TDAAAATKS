// One-off migration: adds projects.link (URL set by an admin, shown at the top of the project page).
// Run with: npx tsx scripts/migrate-project-link.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS link TEXT;`);
  console.log('projects.link ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-project-link failed:', err);
  process.exit(1);
});
