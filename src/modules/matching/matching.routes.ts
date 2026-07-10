import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { discoverLimiter } from '../../middleware/rate-limit.js';
import { discoverQuerySchema } from './matching.schemas.js';
import * as controller from './matching.controller.js';

export const matchingRouter = Router();

matchingRouter.get(
  '/discover',
  requireAuth,
  discoverLimiter,
  validate({ query: discoverQuerySchema }),
  controller.discover,
);