import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/turso',
  schema: './src/db/turso/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.NODE_ENV === 'production' ? process.env.TURSO_DATABASE_URL! : 'file:./localDb/local.db',
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
