import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env, isProd } from '../config/env.js';

/**
 * One Prisma client for the whole process, connected through the
 * pg driver adapter to Supabase's POOLED url.
 * The globalThis guard prevents connection exhaustion when tsx
 * hot-reloads during development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (!isProd) globalForPrisma.prisma = prisma;