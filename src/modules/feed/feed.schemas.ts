import { z } from 'zod';

const mediaItem = z.object({
  publicId: z.string().min(1).max(200),
  type: z.enum(['image']), // video joins post-launch; the column is ready
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

export const createPostSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    media: z.array(mediaItem).max(4).optional(),
    isBirthdayPost: z.boolean().optional(),
  })
  .refine((p) => (p.body && p.body.length > 0) || (p.media && p.media.length > 0), {
    message: 'A post needs text, media, or both',
  });

export const postIdParam = z.object({ postId: z.string().min(1) });

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reactionSchema = z.object({
  emoji: z
    .string()
    .trim()
    .min(1)
    .refine(
      (s) => {
        const segs = [...new Intl.Segmenter().segment(s)];
        return segs.length === 1 && /\p{Extended_Pictographic}/u.test(s);
      },
      { message: 'Must be a single emoji' },
    ),
});

export const addCommentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  parentId: z.string().min(1).optional(),
});

export const commentIdParam = z.object({ commentId: z.string().min(1) });

export const editPostSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
export type EditPostInput = z.infer<typeof editPostSchema>;