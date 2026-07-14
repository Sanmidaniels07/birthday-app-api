import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { dispatch } from '../modules/notifications/notifications.service.js';

/**
 * Daily: two sweeps.
 *  BIRTHDAY_TODAY   → to each birthday person's friends ("celebrate Maya!")
 *  UPCOMING_BIRTHDAY → to friends of people whose birthday is in 3 days
 * Idempotency: a same-day duplicate check per (recipient, type, entity)
 * makes re-runs harmless — missed-then-caught-up crons must not double-tap.
 */
async function friendsOf(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId));
}

async function alreadySentToday(recipientId: string, type: string, entityId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const existing = await prisma.notification.findFirst({
    where: { recipientId, type: type as never, entityId, createdAt: { gte: startOfDay } },
    select: { id: true },
  });
  return existing !== null;
}

async function sweep(
  targetDate: Date,
  type: 'BIRTHDAY_TODAY' | 'UPCOMING_BIRTHDAY',
  titleFor: (name: string) => string,
): Promise<number> {
  const birthdayPeople = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      birthMonth: targetDate.getUTCMonth() + 1,
      birthDay: targetDate.getUTCDate(),
    },
    select: { id: true, profile: { select: { displayName: true } } },
  });

  let sent = 0;
  for (const person of birthdayPeople) {
    if (!person.profile) continue;
    const friends = await friendsOf(person.id);
    for (const friendId of friends) {
      if (await alreadySentToday(friendId, type, person.id)) continue;
      await dispatch({
        recipientId: friendId,
        actorId: person.id,
        type,
        title: titleFor(person.profile.displayName),
        entityType: 'user',
        entityId: person.id,
      });
      sent += 1;
    }
  }
  return sent;
}

export async function birthdayNotifications(): Promise<{ today: number; upcoming: number }> {
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const today = await sweep(now, 'BIRTHDAY_TODAY', (name) => `🎂 It's ${name}'s birthday today!`);
  const upcoming = await sweep(
    inThreeDays,
    'UPCOMING_BIRTHDAY',
    (name) => `🎈 ${name}'s birthday is in 3 days`,
  );

  logger.info({ today, upcoming }, 'birthday notification sweep complete');
  return { today, upcoming };
}