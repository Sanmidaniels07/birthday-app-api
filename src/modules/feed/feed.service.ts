import { prisma } from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { cloudinaryEnabled, signPostMediaUpload, MEDIA_ROOT } from '../../lib/cloudinary.js';
import type { CreatePostInput } from './feed.schemas.js';
import { livePost, blockedIdsFor, feedAuthorIdsFor } from './feed.visibility.js';
import { blockExistsBetween } from '../social/social.helpers.js';
import { dispatch } from '../notifications/notifications.service.js';

/** Is it this user's birthday today (UTC)? */
function isBirthdayTodayUTC(user: { birthMonth: number; birthDay: number }): boolean {
  const now = new Date();
  return user.birthMonth === now.getUTCMonth() + 1 && user.birthDay === now.getUTCDate();
}

/** The one post shape every feed/detail response uses. */
export const postCardSelect = {
  id: true,
  body: true,
  isBirthdayPost: true,
  createdAt: true,
  author: {
    select: {
      profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
    },
  },
  media: {
    orderBy: { order: 'asc' as const },
    select: { url: true, type: true, width: true, height: true },
  },
  _count: { select: { comments: { where: { deletedAt: null } }, reactions: true } },
} as const;

// ---- Post creation & lifecycle ----

export function getPostMediaSignature(userId: string) {
  if (!cloudinaryEnabled) {
    throw new BadRequestError('Media uploads are not configured on this server');
  }
  return signPostMediaUpload(userId);
}

export async function createPost(authorId: string, input: CreatePostInput) {
  // Every claimed media id must live in THIS user's signed namespace.
  const prefix = `${MEDIA_ROOT}/posts/${authorId}/`;
  for (const m of input.media ?? []) {
    if (!m.publicId.startsWith(prefix)) {
      throw new BadRequestError('Unexpected media reference');
    }
  }

  // The confetti flag must be EARNED: only on the author's actual birthday.
  let isBirthdayPost = false;
  if (input.isBirthdayPost) {
    const author = await prisma.user.findUnique({
      where: { id: authorId },
      select: { birthMonth: true, birthDay: true },
    });
    if (!author || !isBirthdayTodayUTC(author)) {
      throw new BadRequestError('Birthday posts can only be created on your birthday');
    }
    isBirthdayPost = true;
  }

  const post = await prisma.post.create({
    data: {
      authorId,
      body: input.body ?? null,
      isBirthdayPost,
      media: input.media?.length
        ? {
            create: input.media.map((m, i) => ({
              url: m.publicId,
              type: m.type,
              width: m.width ?? null,
              height: m.height ?? null,
              order: i,
            })),
          }
        : undefined,
    },
    select: postCardSelect,
  });

  return post;
}

export async function deletePost(actorId: string, postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, deletedAt: true },
  });
  // Missing, already deleted, or not yours → the same 404. No oracle.
  if (!post || post.deletedAt || post.authorId !== actorId) {
    throw new NotFoundError('Post');
  }

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });
  return { deleted: true };
}

export async function getPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { ...postCardSelect, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new NotFoundError('Post');
  const { deletedAt: _omit, ...card } = post;
  return card;
}

// ---- Feeds ----

export async function homeFeed(userId: string, opts: { cursor?: string; limit: number }) {
  const [authorIds, blockedIds] = await Promise.all([
    feedAuthorIdsFor(userId),
    blockedIdsFor(userId),
  ]);
  // Set lookup: O(1) per check. Blocks trump relationships.
  const blockedSet = new Set(blockedIds);
  const visibleAuthors = authorIds.filter((id) => !blockedSet.has(id));

  const rows = await prisma.post.findMany({
    where: { ...livePost, authorId: { in: visibleAuthors } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: postCardSelect,
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

export async function authorFeed(
  viewerId: string,
  username: string,
  opts: { cursor?: string; limit: number },
) {
  
  const { getProfileByUsername } = await import('../profiles/profiles.service.js');
  await getProfileByUsername(username, viewerId);

  const profile = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true },
  });
  if (!profile) throw new NotFoundError('User'); 

  const rows = await prisma.post.findMany({
    where: { ...livePost, authorId: profile.userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: postCardSelect,
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

// ---- Reactions ----

/** Load a live post and verify no block stands between actor and author. */
async function interactablePost(actorId: string, postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) throw new NotFoundError('Post');
  if (post.authorId !== actorId && (await blockExistsBetween(actorId, post.authorId))) {
    throw new NotFoundError('Post');
  }
  return post;
}

export async function togglePostReaction(actorId: string, postId: string, emoji: string) {
  // Shape/abuse validation (single emoji, not arbitrary text) now lives
  // entirely in reactionSchema — no allow-list gate here anymore, so any
  // emoji the schema accepts is a valid reaction.
  const post = await interactablePost(actorId, postId);

  const existing = await prisma.reaction.findFirst({
    where: { userId: actorId, postId, emoji },
    select: { id: true },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    return { emoji, reacted: false }; 
  }

  await prisma.reaction.create({ data: { userId: actorId, postId, emoji } });

  // Notify the author (dispatch's self-guard silences own-post reactions).
  const actor = await prisma.profile.findUnique({
    where: { userId: actorId },
    select: { displayName: true },
  });
  void dispatch({
    recipientId: post.authorId,
    actorId,
    type: 'POST_REACTION',
    title: `${actor?.displayName ?? 'Someone'} reacted ${emoji} to your post`,
    entityType: 'post',
    entityId: postId,
  });

  return { emoji, reacted: true };
}

export async function postReactions(actorId: string, postId: string) {
  await interactablePost(actorId, postId);
  const rows = await prisma.reaction.groupBy({
    by: ['emoji'],
    where: { postId },
    _count: { emoji: true },
  });
  const mine = await prisma.reaction.findMany({
    where: { postId, userId: actorId },
    select: { emoji: true },
  });
  const mySet = new Set(mine.map((r) => r.emoji));
  return rows
    .map((r) => ({ emoji: r.emoji, count: r._count.emoji, reactedByMe: mySet.has(r.emoji) }))
    .sort((a, b) => b.count - a.count);
}

// ---- Comments ----

const commentCardSelect = {
  id: true,
  body: true,
  parentId: true,
  createdAt: true,
  author: {
    select: {
      profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
    },
  },
  _count: { select: { replies: { where: { deletedAt: null } }, reactions: true } },
} as const;

export async function addComment(
  actorId: string,
  postId: string,
  body: string,
  parentId?: string,
) {
  const post = await interactablePost(actorId, postId);

  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, parentId: true, deletedAt: true },
    });
    if (!parent || parent.deletedAt || parent.postId !== postId) {
      throw new NotFoundError('Comment');
    }
    if (parent.parentId !== null) {
      throw new BadRequestError('Replies to replies are not supported — reply to the top-level comment');
    }
  }

  const comment = await prisma.comment.create({
    data: { postId, authorId: actorId, body, parentId: parentId ?? null },
    select: commentCardSelect,
  });

  const actor = await prisma.profile.findUnique({
    where: { userId: actorId },
    select: { displayName: true },
  });
  void dispatch({
    recipientId: post.authorId,
    actorId,
    type: 'POST_COMMENT',
    title: `${actor?.displayName ?? 'Someone'} commented on your post`,
    body: body.slice(0, 80),
    entityType: 'post',
    entityId: postId,
  });

  return comment;
}

export async function deleteComment(actorId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt || comment.authorId !== actorId) {
    throw new NotFoundError('Comment');
  }
  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  return { deleted: true };
}

export async function listComments(
  actorId: string,
  postId: string,
  opts: { cursor?: string; limit: number },
) {
  await interactablePost(actorId, postId);


  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null, deletedAt: null },
 
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      ...commentCardSelect,
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' as const },
        select: commentCardSelect,
      },
    },
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

// ---- Birthdays ----


export async function birthdaysToday(viewerId: string) {
  const now = new Date();
  const [authorIds, blockedIds] = await Promise.all([
    feedAuthorIdsFor(viewerId),
    blockedIdsFor(viewerId),
  ]);
  const blockedSet = new Set(blockedIds);
  const connections = authorIds.filter((id) => id !== viewerId && !blockedSet.has(id));
  if (connections.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { in: connections },
      birthMonth: now.getUTCMonth() + 1, // the composite index, one more time
      birthDay: now.getUTCDate(),
      status: 'ACTIVE',
    },
    select: {
      profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
    },
  });

  return users.filter((u) => u.profile !== null).map((u) => u.profile);
}