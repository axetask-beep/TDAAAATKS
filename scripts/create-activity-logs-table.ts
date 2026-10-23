// One-off migration: creates the `activity_logs` table (see src/db/schema.ts).
// Run with: npx tsx scripts/create-activity-logs-table.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      path TEXT NOT NULL,
      entity_label TEXT,
      details JSONB,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at DESC);`);

  console.log('activity_logs table ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('create-activity-logs-table failed:', err);
  process.exit(1);
});
