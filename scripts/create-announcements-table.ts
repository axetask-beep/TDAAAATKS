// One-off migration: creates the `announcements` table (see src/db/schema.ts).
// This repo has no drizzle-kit migration pipeline (tables were hand-created);
// this script follows that same convention. Run with:
//   npx tsx scripts/create-announcements-table.ts
// Point it at any database via DATABASE_URL or SQL_HOST/... in .env.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON announcements(created_at);`);

  console.log('announcements table ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('create-announcements-table failed:', err);
  process.exit(1);
});
