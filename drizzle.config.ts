import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const useSsl = process.env.SQL_SSL === 'true';

export default defineConfig(
  process.env.DATABASE_URL
    ? {
        schema: './src/db/schema.ts',
        out: './drizzle',
        dialect: 'postgresql',
        dbCredentials: {
          url: process.env.DATABASE_URL,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        },
      }
    : {
        schema: './src/db/schema.ts',
        out: './drizzle',
        dialect: 'postgresql',
        dbCredentials: {
          host: process.env.SQL_HOST || '127.0.0.1',
          user: process.env.SQL_USER || 'postgres',
          password: process.env.SQL_PASSWORD || 'postgres',
          database: process.env.SQL_DB_NAME || 'axetask',
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        },
      }
);
