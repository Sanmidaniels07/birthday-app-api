import { z } from 'zod';

export const queueQuerySchema = z.object({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  targetType: z.enum(['USER', 'POST', 'MESSAGE', 'COMMENT']).optional(),
  reportedUsername: z.string().optional(), // the "everything about user X" pivot
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reportIdParam = z.object({ reportId: z.string().min(1) });

export const resolveSchema = z.object({
  resolution: z.string().trim().min(10, 'The audit trail needs a real note').max(1000),
});

export const userActionSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

export const adminUsernameParam = z.object({ username: z.string().min(1) });

export const userSearchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BANNED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});