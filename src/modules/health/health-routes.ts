import { Router } from 'express';
import { ok } from '../../utils/response.js';
import { prisma } from '../../lib/prisma.js';


export const healthRouter = Router();

/**
 * GET /api/v1/health
 * Liveness probe: is the process up and serving requests?
 */
healthRouter.get('/ready', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  ok(res, { status: 'ready', db: 'connected' });
});

// Stage 7 adds GET /health/ready — the readiness probe that checks
// database connectivity. Can't exist until Prisma does.