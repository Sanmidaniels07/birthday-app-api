import { Router } from "express";
import { validate } from "../../middleware/error-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  updateProfileSchema,
  usernameQuerySchema,
} from "./profiles.schemas.js";
import * as controller from "./profiles.controller.js";
import { setupProfileSchema, username } from "./profiles.schemas.js";
import { z } from "zod";
import { setInterestsSchema } from './profiles.schemas.js';
import { confirmAvatarSchema } from './profiles.schemas.js';
import { uploadLimiter } from '../../middleware/rate-limit.js';
import { searchQuerySchema } from './profiles.schemas.js';





export const profilesRouter = Router();

profilesRouter.post(
  "/setup",
  requireAuth,
  validate({ body: setupProfileSchema }),
  controller.setup,
);

profilesRouter.patch(
  "/me",
  requireAuth,
  validate({ body: updateProfileSchema }),
  controller.update,
);


profilesRouter.post('/me/avatar/sign', requireAuth, controller.avatarSignature);
profilesRouter.post('/me/avatar/confirm', requireAuth, validate({ body: confirmAvatarSchema }), controller.confirmAvatar);

profilesRouter.get(
  "/:username",
  requireAuth,
  validate({ params: z.object({ username }) }),
  controller.getByUsername,
);

profilesRouter.get(
  "/username-available",
  requireAuth,
  validate({ query: usernameQuerySchema }),
  controller.usernameAvailable,
);


profilesRouter.get('/interests', requireAuth, controller.interests);
profilesRouter.get('/me/interests', requireAuth, controller.myInterests);
profilesRouter.put('/me/interests', requireAuth, validate({ body: setInterestsSchema }), controller.setInterests);

profilesRouter.post('/me/avatar/sign', requireAuth, uploadLimiter, controller.avatarSignature);

profilesRouter.get('/search', requireAuth, validate({ query: searchQuerySchema }), controller.search);

profilesRouter.get('/:username/presence', requireAuth, validate({ params: z.object({ username }) }), controller.presence);