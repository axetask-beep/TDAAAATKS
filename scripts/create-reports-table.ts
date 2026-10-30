// One-off migration: creates the `reports` table (see src/db/schema.ts).
// Run with: npx tsx scripts/create-reports-table.ts (targets DATABASE_URL / SQL_HOST from .env).
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS reports_user_idx ON reports(user_id);`);
  console.log('reports table ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('create-reports-table failed:', err);
  process.exit(1);
});
