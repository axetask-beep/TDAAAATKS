// One-off maintenance script: wipes every user account and recreates a single
// admin account. Run with: npx tsx scripts/reset-admin.ts
//
// Point it at any database by setting SQL_HOST/SQL_USER/... or DATABASE_URL
// in the environment (or .env) before running. Requires ADMIN_EMAIL and
// ADMIN_PASSWORD to also be set — never hardcode real credentials here, this
// file is committed to git.
import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import { createUserWithRole, deleteUser, getUserByEmail, hashPassword } from '../src/db/queries.ts';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment (or .env) before running this script.');
    process.exit(1);
  }

  const allUsers = await db.select().from(schema.users);
  console.log(`Found ${allUsers.length} existing user(s).`);

  for (const u of allUsers) {
    if (u.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      console.log(`Deleting ${u.email}...`);
      await deleteUser(u.id);
    }
  }

  const existingAdmin = await getUserByEmail(ADMIN_EMAIL);
  if (existingAdmin) {
    console.log(`Resetting password for ${ADMIN_EMAIL}...`);
    await db.update(schema.users)
      .set({ password_hash: hashPassword(ADMIN_PASSWORD), name: ADMIN_NAME, role: 'admin' })
      .where(eq(schema.users.email, ADMIN_EMAIL));
  } else {
    console.log(`Creating ${ADMIN_EMAIL}...`);
    await createUserWithRole(ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, 'admin');
  }

  console.log('Done. Single admin account ready:', ADMIN_EMAIL);
  process.exit(0);
}

main().catch(err => {
  console.error('reset-admin failed:', err);
  process.exit(1);
});
