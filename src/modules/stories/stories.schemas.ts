import { z } from 'zod';

export const createStorySchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  caption: z.string().trim().max(200).optional(),
});

export const reactStorySchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1)
    .refine((s) => {
      const segs = [...new Intl.Segmenter().segment(s)];
      return segs.length === 1 && /\p{Extended_Pictographic}/u.test(s);
    }, { message: 'Must be a single emoji' }),
});

export const storyMediaSignQuerySchema = z.object({
  kind: z.enum(['image', 'video']),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type ReactStoryInput = z.infer<typeof reactStorySchema>;