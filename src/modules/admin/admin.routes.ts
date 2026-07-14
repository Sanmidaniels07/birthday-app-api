import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import {
  queueQuerySchema, reportIdParam, resolveSchema, userActionSchema, adminUsernameParam,userSearchQuerySchema 
} from './admin.schemas.js';
import * as controller from './admin.controller.js';


export const adminRouter = Router();
// The whole module sits behind the role gate — moderators and admins.
adminRouter.use(requireAuth, requireRole('MODERATOR', 'ADMIN'));

// ---- The queue ----
adminRouter.get('/reports', validate({ query: queueQuerySchema }), controller.queue);
adminRouter.get('/reports/:reportId', validate({ params: reportIdParam }), controller.detail);
adminRouter.post('/reports/:reportId/take', validate({ params: reportIdParam }), controller.take);
adminRouter.post('/reports/:reportId/resolve', validate({ params: reportIdParam, body: resolveSchema }), controller.resolve);
adminRouter.post('/reports/:reportId/dismiss', validate({ params: reportIdParam, body: resolveSchema }), controller.dismiss);

// ---- Enforcement (ADMIN only — moderators triage, admins swing hammers) ----
const takedownSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT', 'MESSAGE']),
  targetId: z.string().min(1),
});
adminRouter.post('/users/:username/suspend', requireRole('ADMIN'), validate({ params: adminUsernameParam, body: userActionSchema }), controller.suspend);
adminRouter.post('/users/:username/ban', requireRole('ADMIN'), validate({ params: adminUsernameParam, body: userActionSchema }), controller.ban);
adminRouter.post('/users/:username/reactivate', requireRole('ADMIN'), validate({ params: adminUsernameParam, body: userActionSchema }), controller.reactivate);
adminRouter.post('/content/takedown', requireRole('ADMIN'), validate({ body: takedownSchema }), controller.takedown);


// ---- User management + stats (both roles may look; hammers stay ADMIN) ----
adminRouter.get('/users', validate({ query: userSearchQuerySchema }), controller.users);
adminRouter.get('/users/:username', validate({ params: adminUsernameParam }), controller.userDetail);
adminRouter.get('/stats', controller.stats);

// ---- Job triggers (ADMIN only) ----
adminRouter.post('/jobs/birthday-sweep', requireRole('ADMIN'), controller.birthdaySweep);
adminRouter.post('/jobs/recompute-brackets', requireRole('ADMIN'), controller.bracketRecompute);