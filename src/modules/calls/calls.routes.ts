import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { initiateCallSchema, callIdParam, historyQuerySchema } from './calls.schemas.js';
import * as controller from './calls.controller.js';

export const callsRouter = Router();
callsRouter.use(requireAuth);

callsRouter.get('/history', validate({ query: historyQuerySchema }), controller.history);
callsRouter.get('/ice-servers', controller.iceServers);
callsRouter.post('/', validate({ body: initiateCallSchema }), controller.initiate);
callsRouter.post('/:callId/answer', validate({ params: callIdParam }), controller.answer);
callsRouter.post('/:callId/decline', validate({ params: callIdParam }), controller.decline);
callsRouter.post('/:callId/end', validate({ params: callIdParam }), controller.end);