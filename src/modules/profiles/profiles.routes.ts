import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/error-handler.js";
import { requireAuth } from "../../middleware/auth.js";
import { uploadLimiter } from "../../middleware/rate-limit.js";
import {
  updateProfileSchema,
  usernameQuerySchema,
  setupProfileSchema,
  setInterestsSchema,
  confirmAvatarSchema,
  searchQuerySchema,
  username,
  confirmCoverSchema,
  onboardingStepSchema,
} from "./profiles.schemas.js";
import * as controller from "./profiles.controller.js";

export const profilesRouter = Router();

// ---- Literal / static routes FIRST (order among themselves doesn't matter) ----
profilesRouter.post("/setup", requireAuth, validate({ body: setupProfileSchema }), controller.setup);

profilesRouter.get("/me", requireAuth, controller.myProfile);
profilesRouter.patch("/me", requireAuth, validate({ body: updateProfileSchema }), controller.update);

profilesRouter.patch(
  "/me/onboarding-step",
  requireAuth,
  validate({ body: onboardingStepSchema }),
  controller.setOnboardingStep,
);

profilesRouter.post(
  "/me/complete-onboarding",
  requireAuth,
  controller.completeOnboarding,
);
profilesRouter.get("/me/interests", requireAuth, controller.myInterests);
profilesRouter.put("/me/interests", requireAuth, validate({ body: setInterestsSchema }), controller.setInterests);

profilesRouter.post("/me/avatar/sign", requireAuth, uploadLimiter, controller.avatarSignature);
profilesRouter.post("/me/avatar/confirm", requireAuth, validate({ body: confirmAvatarSchema }), controller.confirmAvatar);

profilesRouter.get("/username-available", requireAuth, validate({ query: usernameQuerySchema }), controller.usernameAvailable);
profilesRouter.get("/interests", requireAuth, controller.interests);
profilesRouter.get("/search", requireAuth, validate({ query: searchQuerySchema }), controller.search);

// ---- Wildcard routes LAST ----
profilesRouter.get("/:username/presence", requireAuth, validate({ params: z.object({ username }) }), controller.presence);
profilesRouter.get("/:username", requireAuth, validate({ params: z.object({ username }) }), controller.getByUsername);

profilesRouter.post('/me/cover/sign', requireAuth, controller.signCover);
profilesRouter.post('/me/cover/confirm', requireAuth, validate({ body: confirmCoverSchema }), controller.confirmCover);