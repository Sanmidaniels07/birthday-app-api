import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../lib/logger.js';
import { getIO } from '../../sockets/index.js';
import { recomputeBrackets } from '../../jobs/recompute-brackets.job.js';
import { birthdayNotifications } from '../../jobs/birthday-notifications.job.js';


const reportCardSelect = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  resolution: true,
  resolvedById: true,
  reporter: {
    select: { profile: { select: { username: true, displayName: true } } },
  },
  reportedUser: {
    select: {
      status: true,
      profile: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  },
} as const;

// ---- The queue ----

export async function moderationQueue(opts: {
  status?: string;
  targetType?: string;
  reportedUsername?: string;
  cursor?: string;
  limit: number;
}) {
  let reportedUserId: string | undefined;
  if (opts.reportedUsername) {
    const profile = await prisma.profile.findUnique({
      where: { username: opts.reportedUsername },
      select: { userId: true },
    });
    if (!profile) return { page: [], meta: { cursor: null, hasMore: false } };
    reportedUserId = profile.userId;
  }

  const rows = await prisma.report.findMany({
    where: {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.targetType ? { targetType: opts.targetType as never } : {}),
      ...(reportedUserId ? { reportedUserId } : {}),
    },
    // OLDEST first — queues are FIFO; nobody's report rots at the bottom.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: reportCardSelect,
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

/**
 * Report detail WITH the reported content snapshot — the soft-delete
 * dividend: a panicking author's delete hides content from feeds, but
 * the moderator still reviews the evidence.
 */
export async function reportDetail(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { ...reportCardSelect, reportedUserId: true },
  });
  if (!report) throw new NotFoundError('Report');

  let content: unknown = null;
  switch (report.targetType) {
    case 'POST':
      content = await prisma.post.findUnique({
        where: { id: report.targetId },
        select: {
          body: true,
          isBirthdayPost: true,
          deletedAt: true,
          createdAt: true,
          media: { select: { url: true, type: true } },
        },
      });
      break;
    case 'COMMENT':
      content = await prisma.comment.findUnique({
        where: { id: report.targetId },
        select: { body: true, deletedAt: true, createdAt: true },
      });
      break;
    case 'MESSAGE':
      content = await prisma.message.findUnique({
        where: { id: report.targetId },
        select: { body: true, type: true, mediaUrl: true, deletedAt: true, createdAt: true },
      });
      break;
    case 'USER':
      content = await prisma.profile.findUnique({
        where: { userId: report.targetId },
        select: { username: true, displayName: true, bio: true, avatarUrl: true },
      });
      break;
  }

  // How many OTHER reports name this same person? The pattern-of-behavior signal.
  const priorReports = report.reportedUserId
    ? await prisma.report.count({
        where: { reportedUserId: report.reportedUserId, id: { not: reportId } },
      })
    : 0;

  const { reportedUserId: _omit, ...card } = report;
  return { report: card, content, priorReports };
}

export async function takeReport(adminId: string, reportId: string) {
  // Status-guarded updateMany: two moderators grabbing the same report
  // resolves as a clean 409 for the loser, never a double-take.
  const result = await prisma.report.updateMany({
    where: { id: reportId, status: 'OPEN' },
    data: { status: 'UNDER_REVIEW', resolvedById: adminId },
  });
  if (result.count === 0) throw new ConflictError('Report is not open — someone may have taken it');
  return { taken: true };
}

async function closeReport(
  adminId: string,
  reportId: string,
  status: 'RESOLVED' | 'DISMISSED',
  resolution: string,
) {
  const result = await prisma.report.updateMany({
    where: { id: reportId, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    data: { status, resolution, resolvedById: adminId, resolvedAt: new Date() },
  });
  if (result.count === 0) throw new ConflictError('Report is already closed');
  return { status };
}

export const resolveReport = (adminId: string, reportId: string, resolution: string) =>
  closeReport(adminId, reportId, 'RESOLVED', resolution);

export const dismissReport = (adminId: string, reportId: string, resolution: string) =>
  closeReport(adminId, reportId, 'DISMISSED', resolution);

// ---- Enforcement: users ----

async function setUserStatus(
  adminId: string,
  username: string,
  status: 'SUSPENDED' | 'BANNED' | 'ACTIVE',
  reason: string,
) {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true, user: { select: { role: true, status: true } } },
  });
  if (!profile) throw new NotFoundError('User');
  if (profile.userId === adminId) throw new BadRequestError('You cannot moderate yourself');
  // Staff cannot be status-moderated through this path — demotion is a
  // deliberate separate act, not a queue action.
  if (profile.user.role !== 'USER') {
    throw new BadRequestError('Moderators and admins cannot be actioned here');
  }
  if (profile.user.status === status) throw new ConflictError(`User is already ${status}`);

  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.userId }, data: { status } }),
    // Ban/suspend kills every session: refresh tokens revoked now, access
    // tokens die within their 15-minute TTL, sockets die immediately below.
    ...(status !== 'ACTIVE'
      ? [
          prisma.refreshToken.updateMany({
            where: { userId: profile.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]
      : []),
  ]);

  if (status !== 'ACTIVE') {
    getIO().in(`user:${profile.userId}`).disconnectSockets(true);
  }

  logger.warn({ adminId, username, status, reason }, 'user status changed by admin');
  return { username, status };
}

export const suspendUser = (adminId: string, username: string, reason: string) =>
  setUserStatus(adminId, username, 'SUSPENDED', reason);

export const banUser = (adminId: string, username: string, reason: string) =>
  setUserStatus(adminId, username, 'BANNED', reason);

export const reactivateUser = (adminId: string, username: string, reason: string) =>
  setUserStatus(adminId, username, 'ACTIVE', reason);

// ---- Enforcement: content takedown ----

export async function takedownContent(
  adminId: string,
  targetType: 'POST' | 'COMMENT' | 'MESSAGE',
  targetId: string,
) {
  const now = new Date();
  let count = 0;
  if (targetType === 'POST') {
    count = (
      await prisma.post.updateMany({ where: { id: targetId, deletedAt: null }, data: { deletedAt: now } })
    ).count;
  } else if (targetType === 'COMMENT') {
    count = (
      await prisma.comment.updateMany({ where: { id: targetId, deletedAt: null }, data: { deletedAt: now } })
    ).count;
  } else {
    count = (
      await prisma.message.updateMany({ where: { id: targetId, deletedAt: null }, data: { deletedAt: now } })
    ).count;
  }
  if (count === 0) throw new NotFoundError('Content (or already removed)');
  logger.warn({ adminId, targetType, targetId }, 'content taken down by admin');
  return { removed: true };
}


// ---- User management ----

/**
 * Admin user search: unlike the public /profiles/search, this sees
 * EVERYTHING — private profiles, suspended and banned users, the
 * unverified. Moderation cannot have blind spots; the role gate is
 * what makes that safe.
 */
export async function adminSearchUsers(opts: {
  q?: string;
  status?: string;
  cursor?: string;
  limit: number;
}) {
  const rows = await prisma.user.findMany({
    where: {
      ...(opts.status ? { status: opts.status as never } : {}),
      ...(opts.q
        ? {
            OR: [
              { email: { contains: opts.q.toLowerCase() } },
              { fullName: { contains: opts.q, mode: 'insensitive' as const } },
              { profile: { is: { username: { contains: opts.q.toLowerCase() } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true, email: true, fullName: true, role: true, status: true,
      emailVerifiedAt: true, createdAt: true, lastSeenAt: true,
      profile: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

/** Full inspection of one user — the moderator's dossier view. */
export async function adminUserDetail(username: string) {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true },
  });
  if (!profile) throw new NotFoundError('User');

  const [user, counts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: profile.userId },
      select: {
        id: true, email: true, fullName: true, role: true, status: true,
        emailVerifiedAt: true, birthDate: true, ageBracket: true,
        createdAt: true, lastSeenAt: true,
        profile: {
          select: { username: true, displayName: true, bio: true, avatarUrl: true, visibility: true, city: true, country: true },
        },
      },
    }),
    Promise.all([
      prisma.post.count({ where: { authorId: profile.userId, deletedAt: null } }),
      prisma.report.count({ where: { reportedUserId: profile.userId } }),
      prisma.report.count({ where: { reporterId: profile.userId } }),
      prisma.friendship.count({
        where: { status: 'ACCEPTED', OR: [{ requesterId: profile.userId }, { addresseeId: profile.userId }] },
      }),
    ]),
  ]);
  if (!user) throw new NotFoundError('User');

  const [posts, reportsAgainst, reportsFiled, friends] = counts;
  return { user, activity: { posts, reportsAgainst, reportsFiled, friends } };
}

// ---- Platform stats ----

export async function platformStats() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, verifiedUsers, newThisWeek, activeToday,
    totalPosts, totalMessages, totalCommunities, openReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: dayAgo } } }),
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.message.count({ where: { deletedAt: null } }),
    prisma.birthdayCommunity.count(),
    prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
  ]);

  return {
    users: { total: totalUsers, verified: verifiedUsers, newThisWeek, activeToday },
    content: { posts: totalPosts, messages: totalMessages, communities: totalCommunities },
    moderation: { openReports },
  };
}

// ---- Job triggers (rehomed from the N4 scaffold) ----

export const triggerBirthdaySweep = () => birthdayNotifications();
export const triggerBracketRecompute = () => recomputeBrackets();