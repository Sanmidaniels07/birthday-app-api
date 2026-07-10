import { z } from 'zod';
export const discoverQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});