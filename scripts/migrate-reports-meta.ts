// One-off migration: reports get a title, a type, and a JSON content (meeting
// summaries, which have no file). Run with: npx tsx scripts/migrate-reports-meta.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS title TEXT;`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS kind TEXT;`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS content JSONB;`);
  await db.execute(sql`ALTER TABLE reports ALTER COLUMN file_data DROP NOT NULL;`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS reports_created_idx ON reports(created_at);`);
  console.log('reports: title, kind, content ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-reports-meta failed:', err);
  process.exit(1);
});
