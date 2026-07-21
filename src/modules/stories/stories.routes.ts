import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createStorySchema, reactStorySchema } from './stories.schemas.js';
import * as controller from './stories.controller.js';
import { validate } from '../../middleware/error-handler.js';

export const storiesRouter = Router();

storiesRouter.post('/media/sign', requireAuth, controller.signMedia);
storiesRouter.post('/', requireAuth, validate({ body: createStorySchema }), controller.create);
storiesRouter.get('/', requireAuth, controller.list);
storiesRouter.post('/:id/view', requireAuth, controller.view);
storiesRouter.post('/:id/react', requireAuth, validate({ body: reactStorySchema }), controller.react);
storiesRouter.delete('/:id', requireAuth, controller.remove);