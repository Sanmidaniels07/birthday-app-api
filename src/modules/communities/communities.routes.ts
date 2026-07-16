import { Router } from 'express';
import { validate } from '../../middleware/error-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { browseQuerySchema, membersQuerySchema, communityIdParam, autoJoinSchema } from './communities.schemas.js';
import * as controller from './communities.controller.js';

export const communitiesRouter = Router();
communitiesRouter.use(requireAuth); 

communitiesRouter.get('/mine', controller.mine);
communitiesRouter.patch('/auto-join', validate({ body: autoJoinSchema }), controller.autoJoin);
communitiesRouter.get('/', validate({ query: browseQuerySchema }), controller.browse);
communitiesRouter.get('/:id', validate({ params: communityIdParam }), controller.detail);
communitiesRouter.post('/:id/join', validate({ params: communityIdParam }), controller.join);
communitiesRouter.post('/:id/leave', validate({ params: communityIdParam }), controller.leave);
communitiesRouter.get('/:id/members', validate({ params: communityIdParam, query: membersQuerySchema }), controller.members);
communitiesRouter.post('/resync', requireAuth, controller.resync);