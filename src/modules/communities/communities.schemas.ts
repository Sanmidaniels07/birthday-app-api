import { z } from 'zod';

export const communityIdParam = z.object({ id: z.string().min(1) });

export const browseQuerySchema = z.object({
  type: z.enum(['BIRTHDAY', 'BIRTH_MONTH', 'AGE_BRACKET']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const membersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const autoJoinSchema = z.object({ enabled: z.boolean() });