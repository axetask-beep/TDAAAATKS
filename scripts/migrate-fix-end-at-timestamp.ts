// One-off repair migration. A previous manual migration on the production
// (Neon) database renamed the old deadline/due_date TEXT columns straight to
// `end_at` without converting their type, so `projects.end_at` and
// `tasks.end_at` ended up TEXT instead of TIMESTAMP as schema.ts declares.
// Drizzle then binds updates/inserts to those columns as timestamp
// parameters, which Postgres rejects ("column is of type text but
// expression is of type timestamp without time zone") — the source of the
// "Database query failed" errors. This converts both columns to TIMESTAMP
// in place, preserving existing values (safe no-op if already timestamp).
// Run with: npx tsx scripts/migrate-fix-end-at-timestamp.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function columnType(table: string, column: string): Promise<string | null> {
  const res: any = await db.execute(sql`
    select data_type from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and column_name = ${column}
  `);
  const rows = res.rows ?? res;
  return rows[0]?.data_type ?? null;
}

async function fixEndAt(table: 'projects' | 'tasks') {
  const type = await columnType(table, 'end_at');
  if (type === null) {
    console.log(`${table}.end_at does not exist — skipping.`);
    return;
  }
  if (type !== 'text') {
    console.log(`${table}.end_at is already ${type} — nothing to do.`);
    return;
  }
  console.log(`${table}.end_at is TEXT — converting to TIMESTAMP...`);
  if (table === 'projects') {
    await db.execute(sql`
      ALTER TABLE projects
      ALTER COLUMN end_at TYPE TIMESTAMP USING NULLIF(end_at, '')::timestamp
    `);
  } else {
    await db.execute(sql`
      ALTER TABLE tasks
      ALTER COLUMN end_at TYPE TIMESTAMP USING NULLIF(end_at, '')::timestamp
    `);
  }
  console.log(`${table}.end_at converted to TIMESTAMP.`);
}

async function main() {
  await fixEndAt('projects');
  await fixEndAt('tasks');
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('migrate-fix-end-at-timestamp failed:', err);
  process.exit(1);
});
