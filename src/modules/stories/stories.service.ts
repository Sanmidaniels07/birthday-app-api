import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors.js';
import { blockedIdsFor } from '../social/social.helpers.js';
import { logger } from '../../lib/logger.js';
import { cloudinary, cloudinaryEnabled } from '../../lib/cloudinary.js';

const STORY_TTL_HOURS = 24;

const storySelect = {
  id: true, mediaUrl: true, mediaType: true, caption: true, createdAt: true, expiresAt: true,
} as const;

export async function createStory(userId: string, input: { mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; caption?: string }) {
  const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);
  return prisma.story.create({
    data: { userId, mediaUrl: input.mediaUrl, mediaType: input.mediaType, caption: input.caption ?? null, expiresAt },
    select: storySelect,
  });
}

/** Active, public stories — grouped by author, newest story first within each group. */
export async function listStories(viewerId: string) {
  const excludedIds = await blockedIdsFor(viewerId);

  const rows = await prisma.story.findMany({
    where: {
      expiresAt: { gt: new Date() },              // query-filter expiry — invisible the instant it lapses
      userId: { notIn: excludedIds },
      user: { status: 'ACTIVE', profile: { is: { visibility: { not: 'PRIVATE' } } } },
    },
    select: {
      ...storySelect,
      userId: true,
      user: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } } } },
      views: { where: { viewerId }, select: { id: true } },   // did I view this specific story?
    },
    orderBy: { createdAt: 'desc' },
  });

  // Group by author
  const byUser = new Map<string, { user: typeof rows[number]['user']; slides: typeof rows }>();
  for (const s of rows) {
    if (!s.user.profile) continue;
    if (!byUser.has(s.userId)) byUser.set(s.userId, { user: s.user, slides: [] });
    byUser.get(s.userId)!.slides.push(s);
  }

  return [...byUser.entries()].map(([authorId, { user, slides }]) => ({
    userId: authorId,
    profile: user.profile,
    viewed: slides.every((s) => s.views.length > 0),   // fully viewed only if ALL slides seen
    slides: slides
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())  // oldest-first within a user (playback order)
      .map((s) => ({
        id: s.id, mediaUrl: s.mediaUrl, mediaType: s.mediaType, caption: s.caption,
        createdAt: s.createdAt, viewed: s.views.length > 0,
      })),
  }));
}

export async function viewStory(viewerId: string, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, expiresAt: true } });
  if (!story || story.expiresAt < new Date()) throw new NotFoundError('Story');

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId, viewerId } },
    create: { storyId, viewerId },
    update: {},   // idempotent — re-viewing doesn't change the timestamp
  });
}

export async function reactToStory(userId: string, storyId: string, emoji: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { id: true, expiresAt: true } });
  if (!story || story.expiresAt < new Date()) throw new NotFoundError('Story');

  const existing = await prisma.storyReaction.findUnique({
    where: { storyId_userId: { storyId, userId } },
  });

  if (existing && existing.emoji === emoji) {
    await prisma.storyReaction.delete({ where: { id: existing.id } });
    return { reacted: false };
  }
  await prisma.storyReaction.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId, emoji },
    update: { emoji },
  });
  return { reacted: true, emoji };
}

export async function deleteStory(userId: string, storyId: string) {
  const story = await prisma.story.findUnique({ where: { id: storyId }, select: { userId: true, mediaUrl: true } });
  if (!story) throw new NotFoundError('Story');
  if (story.userId !== userId) throw new ForbiddenError('Not your story');

  await prisma.story.delete({ where: { id: storyId } });
  await cloudinary.uploader.destroy(story.mediaUrl).catch((err) =>
    logger.error({ err, storyId }, 'Cloudinary cleanup failed for deleted story'),
  );
}

/** Daily cron: hard-delete expired stories + their Cloudinary assets, reclaiming storage. */
export async function sweepExpiredStories() {
  const expired = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, mediaUrl: true },
  });
  if (expired.length === 0) return { deleted: 0 };

  for (const s of expired) {
    await cloudinary.uploader.destroy(s.mediaUrl).catch((err) =>
      logger.error({ err, storyId: s.id }, 'Cloudinary cleanup failed during sweep'),
    );
  }
  await prisma.story.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });

  logger.info({ count: expired.length }, 'expired stories swept');
  return { deleted: expired.length };
}