import { z } from 'zod';

export const initiateCallSchema = z.object({
  conversationId: z.string().min(1),
  type: z.enum(['VOICE', 'VIDEO']),
});

export const callIdParam = z.object({ callId: z.string().min(1) });

export const historyQuerySchema = z.object({
  conversationId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});