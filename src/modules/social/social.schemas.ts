import { z } from 'zod';
import { username } from '../profiles/profiles.schemas.js';

export const sendRequestSchema = z.object({ username });
export const requestIdParam = z.object({ requestId: z.string().min(1) });
export const usernameParam = z.object({ username });
export const networkQuerySchema = z.object({
  username: username.optional(),
});