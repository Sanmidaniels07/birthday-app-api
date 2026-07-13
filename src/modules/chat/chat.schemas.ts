import { z } from 'zod';
import { username } from '../profiles/profiles.schemas.js';

export const createDmSchema = z.object({ username });

export const createGroupSchema = z.object({
  title: z.string().trim().min(2).max(80),
  usernames: z.array(username).min(1, 'A group needs at least one other member').max(49),
});

export const conversationIdParam = z.object({ conversationId: z.string().min(1) });

export const inboxQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const textMessage = z.object({
  type: z.literal('TEXT').default('TEXT'),
  body: z.string().trim().min(1).max(4000),
  replyToId: z.string().min(1).optional(),
});

const MEDIA_KINDS = ['IMAGE', 'VOICE_NOTE', 'AUDIO', 'VIDEO'] as const;
const MEDIA_SIZE_LIMITS: Record<(typeof MEDIA_KINDS)[number], number> = {
  IMAGE: 10 * 1024 * 1024,
  VOICE_NOTE: 20 * 1024 * 1024,
  AUDIO: 20 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
};

const mediaMessage = z
  .object({
    type: z.enum(MEDIA_KINDS),
    body: z.string().trim().max(1000).optional(), // caption
    mediaUrl: z.string().min(1).max(300),         // Cloudinary public id
    mediaDuration: z.coerce.number().int().positive().max(600).optional(), // ≤10 min
    mediaSize: z.coerce.number().int().positive(),
    replyToId: z.string().min(1).optional(),
  })
  .refine((m) => m.mediaSize <= MEDIA_SIZE_LIMITS[m.type], {
    message: 'File exceeds the size limit for this media type',
  })
  .refine((m) => !['VOICE_NOTE', 'AUDIO', 'VIDEO'].includes(m.type) || m.mediaDuration !== undefined, {
    message: 'Duration is required for audio and video messages',
  });

export const sendMessageSchema = z.union([textMessage, mediaMessage]);

export const mediaSignQuerySchema = z.object({
  kind: z.enum(['image', 'voice_note', 'audio', 'video']),
});

export type SendMessageInput = z.infer<typeof textMessage> | z.infer<typeof mediaMessage>;

export const editMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const messageIdParam = z.object({
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
});

export const historyQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const addMemberSchema = z.object({ username });

export const memberParam = conversationIdParam.merge(z.object({ username }));