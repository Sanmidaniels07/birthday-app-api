import { z } from 'zod';


export const REPORT_REASONS = [
  'HARASSMENT',
  'SPAM',
  'INAPPROPRIATE_CONTENT',
  'FAKE_PROFILE',
  'UNDERAGE_USER',
  'SCAM_OR_FRAUD',
  'OTHER',
] as const;

export const createReportSchema = z
  .object({
    targetType: z.enum(['USER', 'POST', 'MESSAGE', 'COMMENT']),
    targetId: z.string().min(1),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((r) => r.reason !== 'OTHER' || (r.details && r.details.length >= 10), {
    message: 'Please describe the issue when selecting Other',
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;