import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { uploadLimiter, postLimiter, interactionLimiter } from '../../middleware/rate-limit.js';
import {
  createPostSchema,
  postIdParam,
  feedQuerySchema,
  reactionSchema,
  addCommentSchema,
  commentIdParam,
} from './feed.schemas.js';
import { usernameParam } from '../social/social.schemas.js';
import * as controller from './feed.controller.js';

export const feedRouter = Router();
feedRouter.use(requireAuth);

// ---- Statics first ----
feedRouter.get('/home', validate({ query: feedQuerySchema }), controller.home);
feedRouter.get('/birthdays-today', controller.birthdays);
feedRouter.get('/by/:username', validate({ params: usernameParam, query: feedQuerySchema }), controller.byAuthor);
feedRouter.post('/posts/media/sign', uploadLimiter, controller.mediaSignature);
feedRouter.post('/posts', postLimiter, validate({ body: createPostSchema }), controller.create);

// ---- Post params ----
feedRouter.get('/posts/:postId', validate({ params: postIdParam }), controller.detail);
feedRouter.delete('/posts/:postId', validate({ params: postIdParam }), controller.remove);
feedRouter.post('/posts/:postId/reactions', interactionLimiter, validate({ params: postIdParam, body: reactionSchema }), controller.react);
feedRouter.get('/posts/:postId/reactions', validate({ params: postIdParam }), controller.reactions);
feedRouter.post('/posts/:postId/comments', interactionLimiter, validate({ params: postIdParam, body: addCommentSchema }), controller.comment);
feedRouter.get('/posts/:postId/comments', validate({ params: postIdParam, query: feedQuerySchema }), controller.comments);
feedRouter.delete('/comments/:commentId', validate({ params: commentIdParam }), controller.removeComment);