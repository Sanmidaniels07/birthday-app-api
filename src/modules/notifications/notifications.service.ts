import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { getIO } from '../../sockets/index.js';
import { SocketEvents } from '../../sockets/events.js';
import { NotFoundError } from '../../utils/errors.js';
import { pushToUser } from '../../lib/push.js';
import { env } from '../../config/env.js';
import { pushEnabled } from '../../lib/push.js';


type NotificationTypeName =
  | 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED' | 'NEW_MESSAGE' | 'MISSED_CALL'
  | 'UPCOMING_BIRTHDAY' | 'BIRTHDAY_TODAY' | 'POST_REACTION' | 'POST_COMMENT'
  | 'COMMUNITY_JOINED' | 'ANNOUNCEMENT';

/** Which preference gates which type. Unlisted types are ungated (always dispatch). */
const PUSH_GATE: Partial<Record<NotificationTypeName, keyof PushPrefs>> = {
  NEW_MESSAGE: 'pushMessages',
  MISSED_CALL: 'pushCalls',
  UPCOMING_BIRTHDAY: 'pushBirthdays',
  BIRTHDAY_TODAY: 'pushBirthdays',
  FRIEND_REQUEST: 'pushSocial',
  FRIEND_ACCEPTED: 'pushSocial',
  POST_REACTION: 'pushSocial',
  POST_COMMENT: 'pushSocial',
};

interface PushPrefs {
  pushMessages: boolean;
  pushCalls: boolean;
  pushBirthdays: boolean;
  pushSocial: boolean;
}

export interface DispatchInput {
  recipientId: string;
  actorId?: string;
  type: NotificationTypeName;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

/**
 * THE notification entry point. Every shoulder-tap in the app goes
 * through here: DB row (the inbox truth) → socket event (live badge)
 * → web push if subscribed and preference allows.
 * Fire-and-forget from call sites; failures log, never break features.
 */
export async function dispatch(input: DispatchInput): Promise<void> {
  try {
    // Self-notifications are always noise.
    if (input.actorId && input.actorId === input.recipientId) return;

    const notification = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: {
        id: true, type: true, title: true, body: true,
        entityType: true, entityId: true, createdAt: true, readAt: true,
        actor: {
          select: {
            profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
          },
        },
      },
    });

    getIO().to(`user:${input.recipientId}`).emit(SocketEvents.NOTIFICATION_NEW, { notification });

    // Push: gated by preference (defaults apply when no prefs row exists).
    const gate = PUSH_GATE[input.type];
    if (gate) {
      const prefs = await prisma.notificationPreference.findUnique({
        where: { userId: input.recipientId },
        select: { pushMessages: true, pushCalls: true, pushBirthdays: true, pushSocial: true },
      });
      const allowed = prefs ? prefs[gate] : true; // no row = defaults = all on
      if (allowed) {
        await pushToUser(input.recipientId, { title: input.title, body: input.body });
      }
    }
  } catch (err) {
    logger.error({ err, type: input.type, recipientId: input.recipientId }, 'notification dispatch failed');
  }
}


const notificationCardSelect = {
  id: true, type: true, title: true, body: true,
  entityType: true, entityId: true, readAt: true, createdAt: true,
  actor: {
    select: {
      profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
    },
  },
} as const;

export async function listNotifications(userId: string, opts: { cursor?: string; limit: number }) {
  const rows = await prisma.notification.findMany({
    where: { recipientId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: notificationCardSelect,
  });
  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

export async function unreadNotificationCount(userId: string) {
  const count = await prisma.notification.count({
    where: { recipientId: userId, readAt: null },
  });
  return { count };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) throw new NotFoundError('Notification');
  return { read: true };
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { marked: result.count };
}

export async function getPreferences(userId: string) {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  return (
    prefs ?? {
      emailBirthdayDigest: true, emailFriendRequests: true,
      pushMessages: true, pushCalls: true, pushBirthdays: true, pushSocial: true,
    }
  );
}

export async function updatePreferences(userId: string, input: Record<string, boolean>) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
}


export function getVapidPublicKey() {
  return { enabled: pushEnabled, publicKey: env.VAPID_PUBLIC_KEY ?? null };
}

export async function subscribePush(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string,
) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent ?? null },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
  return { subscribed: true };
}

export async function unsubscribePush(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return { subscribed: false };
}