import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 CLI configuration.
 * The CLI (migrate, studio) connects via the SESSION pooler (DIRECT_URL) —
 * the transaction pooler can't run migrations.
 * The app itself connects via the pooled DATABASE_URL in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});