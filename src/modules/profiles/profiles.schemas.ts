import { z } from 'zod';

export const anniversaryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
  }, 'That date does not exist')
  .refine((s) => new Date(`${s}T00:00:00Z`) <= new Date(), 'Your anniversary can\'t be in the future');


const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'mod', 'moderator',
  'api', 'auth', 'settings', 'profile', 'profiles', 'user', 'users', 'me',
  'birthday', 'official', 'system', 'null', 'undefined', 'about', 'terms',
  'privacy', 'security', 'team', 'staff',
]);

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers, and underscores — starting with a letter')
  .refine((u) => !u.includes('__'), 'No consecutive underscores')
  .refine((u) => !RESERVED_USERNAMES.has(u), 'That username is reserved');

export const BLOB_TINTS = ['butter', 'blush', 'powder', 'lavender', 'sage', 'peach'] as const;

export const setupProfileSchema = z.object({
  username,
  displayName: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(500).optional(),
  blobTint: z.enum(BLOB_TINTS).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  anniversaryDate: anniversaryDate.optional(),   
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  blobTint: z.enum(BLOB_TINTS).optional(),
  city: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
  anniversaryDate: anniversaryDate.nullable().optional(),   
  visibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']).optional(),
  showBirthYear: z.boolean().optional(),
  showAge: z.boolean().optional(),
  showAnniversary: z.boolean().optional(),   
  showLocation: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
}).refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');

export const usernameQuerySchema = z.object({ u: username });

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export const setInterestsSchema = z.object({
  interestIds: z.array(z.string().min(1)).min(1, 'Pick at least one interest').max(15, 'At most 15 interests'),
});

export const confirmAvatarSchema = z.object({
  publicId: z.string().min(1).max(200),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Search needs at least 2 characters').max(50),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export const confirmCoverSchema = z.object({
  publicId: z.string().min(1).max(200),
});
export type ConfirmCoverInput = z.infer<typeof confirmCoverSchema>;