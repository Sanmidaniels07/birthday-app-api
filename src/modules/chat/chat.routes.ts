import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { createDmSchema, createGroupSchema, conversationIdParam, inboxQuerySchema, addMemberSchema, memberParam } from './chat.schemas.js';
import * as controller from './chat.controller.js';
import {
  sendMessageSchema,
  editMessageSchema,
  messageIdParam,
  historyQuerySchema,
} from './chat.schemas.js';
import { messageLimiter } from '../../middleware/rate-limit.js';
import { mediaSignQuerySchema } from './chat.schemas.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';



export const chatRouter = Router();
chatRouter.use(requireAuth);

chatRouter.get('/conversations', validate({ query: inboxQuerySchema }), controller.inbox);
chatRouter.post('/conversations/dm', validate({ body: createDmSchema }), controller.createDm);
chatRouter.post('/conversations/group', validate({ body: createGroupSchema }), controller.createGroup);
chatRouter.get('/conversations/:conversationId', validate({ params: conversationIdParam }), controller.detail);

chatRouter.post(
  '/conversations/:conversationId/messages',
  messageLimiter,
  validate({ params: conversationIdParam, body: sendMessageSchema }),
  controller.send,
);
chatRouter.get(
  '/conversations/:conversationId/messages',
  validate({ params: conversationIdParam, query: historyQuerySchema }),
  controller.history,
);
chatRouter.patch(
  '/conversations/:conversationId/messages/:messageId',
  validate({ params: messageIdParam, body: editMessageSchema }),
  controller.edit,
);
chatRouter.delete(
  '/conversations/:conversationId/messages/:messageId',
  validate({ params: messageIdParam }),
  controller.removeMessage,
);

chatRouter.get('/unread', controller.unread);
chatRouter.post(
  '/conversations/:conversationId/read',
  validate({ params: conversationIdParam }),
  controller.read,
);


chatRouter.post(
  '/conversations/:conversationId/media/sign',
  uploadLimiter,
  validate({ params: conversationIdParam, query: mediaSignQuerySchema }),
  controller.mediaSign,
);

chatRouter.post(
  '/conversations/:conversationId/members',
  validate({ params: conversationIdParam, body: addMemberSchema }),
  controller.addMember,
);
chatRouter.delete(
  '/conversations/:conversationId/members/:username',
  validate({ params: memberParam }),
  controller.removeMember,
);
chatRouter.post(
  '/conversations/:conversationId/leave',
  validate({ params: conversationIdParam }),
  controller.leave,
);