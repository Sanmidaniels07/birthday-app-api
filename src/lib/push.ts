import webpush from 'web-push';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body?: string;
}

/**
 * Push to every subscription a user has (each browser/device = one row).
 * 404/410 from the push service = subscription dead (browser data cleared,
 * permission revoked) → self-cleaning delete. Other failures just log.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          logger.debug({ userId, endpoint: sub.endpoint.slice(0, 40) }, 'dead push subscription pruned');
        } else {
          logger.warn({ err, userId }, 'push delivery failed');
        }
      }
    }),
  );
}