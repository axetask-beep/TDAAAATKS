// One-off migration: creates the `push_subscriptions` and `mobile_push_tokens` tables (see src/db/schema.ts).
// Run with: npx tsx scripts/create-push-subscriptions-table.ts
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.ts';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS mobile_push_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS mobile_push_tokens_user_id_idx ON mobile_push_tokens(user_id);`);

  console.log('push_subscriptions + mobile_push_tokens tables ready.');
  process.exit(0);
}

main().catch(err => {
  console.error('create-push-subscriptions-table failed:', err);
  process.exit(1);
});
