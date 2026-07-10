import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { socialWriteLimiter } from '../../middleware/rate-limit.js';
import { sendRequestSchema, requestIdParam, usernameParam } from './social.schemas.js';
import * as controller from './social.controller.js';

export const socialRouter = Router();
socialRouter.use(requireAuth);

// ---- Friends ----
socialRouter.get('/friends', controller.friends);
socialRouter.get('/requests/incoming', controller.incoming);
socialRouter.get('/requests/outgoing', controller.outgoing);
socialRouter.post('/requests', socialWriteLimiter, validate({ body: sendRequestSchema }), controller.send);
socialRouter.post('/requests/:requestId/accept', validate({ params: requestIdParam }), controller.accept);
socialRouter.post('/requests/:requestId/decline', validate({ params: requestIdParam }), controller.decline);
socialRouter.post('/requests/:requestId/cancel', validate({ params: requestIdParam }), controller.cancel);
socialRouter.delete('/friends/:username', validate({ params: usernameParam }), controller.unfriend);

// ---- Follows ----
socialRouter.post('/follow/:username', socialWriteLimiter, validate({ params: usernameParam }), controller.follow);
socialRouter.delete('/follow/:username', validate({ params: usernameParam }), controller.unfollow);
socialRouter.get('/following', controller.following);
socialRouter.get('/followers', controller.followers);

// ---- Blocks ----
socialRouter.post('/block/:username', socialWriteLimiter, validate({ params: usernameParam }), controller.block);
socialRouter.delete('/block/:username', validate({ params: usernameParam }), controller.unblock);
socialRouter.get('/blocked', controller.blocked);