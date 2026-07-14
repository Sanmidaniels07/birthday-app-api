import { z } from 'zod';

export const inboxQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationIdParam = z.object({ notificationId: z.string().min(1) });

export const preferencesSchema = z
  .object({
    emailBirthdayDigest: z.boolean().optional(),
    emailFriendRequests: z.boolean().optional(),
    pushMessages: z.boolean().optional(),
    pushCalls: z.boolean().optional(),
    pushBirthdays: z.boolean().optional(),
    pushSocial: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one preference');

  export const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});