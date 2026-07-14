import { prisma } from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { logger } from '../../lib/logger.js';
import type { CreateReportInput } from './reports.schemas.js';

/**
 * Resolve the target: does it exist, and WHOSE behavior is it?
 * The resolver doubles as the access check — you can only report
 * things you can reference, and the same 404 covers missing,
 * deleted, and not-yours-to-see.
 */
async function resolveTarget(
  reporterId: string,
  targetType: CreateReportInput['targetType'],
  targetId: string,
): Promise<string | null> {
  switch (targetType) {
    case 'USER': {
      const profile = await prisma.profile.findUnique({
        where: { username: targetId }, // users are reported by username
        select: { userId: true },
      });
      if (!profile) throw new NotFoundError('User');
      if (profile.userId === reporterId) throw new BadRequestError('You cannot report yourself');
      return profile.userId;
    }
    case 'POST': {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { authorId: true }, // deleted posts stay reportable — the harm already happened
      });
      if (!post) throw new NotFoundError('Post');
      return post.authorId;
    }
    case 'COMMENT': {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      if (!comment) throw new NotFoundError('Comment');
      return comment.authorId;
    }
    case 'MESSAGE': {
      const message = await prisma.message.findUnique({
        where: { id: targetId },
        select: { senderId: true, conversationId: true },
      });
      if (!message) throw new NotFoundError('Message');
      // Only participants may report a message — a message id is not
      // a capability to make US read private conversations.
      const membership = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId: message.conversationId, userId: reporterId } },
        select: { id: true },
      });
      if (!membership) throw new NotFoundError('Message');
      return message.senderId;
    }
  }
}

export async function createReport(reporterId: string, input: CreateReportInput) {
  const reportedUserId = await resolveTarget(reporterId, input.targetType, input.targetId);

  // Duplicate throttle: one OPEN report per (reporter, target). Re-reporting
  // the same thing is a queue-flood vector, not new information.
  const existing = await prisma.report.findFirst({
    where: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: { in: ['OPEN', 'UNDER_REVIEW'] },
    },
    select: { id: true },
  });
  if (existing) {
    return { reportId: existing.id, duplicate: true };
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reportedUserId,
      reason: input.reason,
      details: input.details ?? null,
    },
    select: { id: true },
  });

  logger.info(
    { reportId: report.id, targetType: input.targetType, reason: input.reason },
    'report filed',
  );
  return { reportId: report.id, duplicate: false };
}

export async function listMyReports(userId: string, opts: { cursor?: string; limit: number }) {
  const rows = await prisma.report.findMany({
    where: { reporterId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true, targetType: true, reason: true, status: true, createdAt: true, resolvedAt: true,
      // Deliberately NOT the resolution note or moderator identity —
      // reporters see status, not internal deliberation.
    },
  });
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}