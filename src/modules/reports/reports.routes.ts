import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { socialWriteLimiter } from '../../middleware/rate-limit.js';
import { createReportSchema } from './reports.schemas.js';
import { z } from 'zod';
import * as controller from './reports.controller.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const listQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

reportsRouter.post('/', socialWriteLimiter, validate({ body: createReportSchema }), controller.create);
reportsRouter.get('/mine', validate({ query: listQuery }), controller.mine);