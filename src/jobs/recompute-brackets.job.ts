import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ageOn } from '../modules/auth/auth.schemas.js';
import { computeAgeBracket } from '../modules/auth/auth.service.js';
import { syncUserCommunities } from '../modules/communities/communities.sync.js';

/**
 * Nightly: recompute ageBracket for users whose bracket is stale.
 * Cheap trick: only users whose BIRTHDAY WAS YESTERDAY OR TODAY can
 * have crossed a bracket boundary — we check ~1/365th of users nightly,
 * not the whole table. Bracket changed → re-sync their AUTO communities
 * (the reconciliation engine's third master, as promised in M2).
 */
export async function recomputeBrackets(): Promise<{ checked: number; changed: number }> {
  const now = new Date();
  const today = { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yday = { month: yesterday.getUTCMonth() + 1, day: yesterday.getUTCDate() };

  const candidates = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { birthMonth: today.month, birthDay: today.day },
        { birthMonth: yday.month, birthDay: yday.day },
      ],
    },
    select: { id: true, birthDate: true, ageBracket: true },
  });

  let changed = 0;
  for (const user of candidates) {
    const bracket = computeAgeBracket(ageOn(now, user.birthDate));
    if (bracket !== user.ageBracket) {
      await prisma.user.update({ where: { id: user.id }, data: { ageBracket: bracket } });
      await syncUserCommunities(user.id); // moves them between bracket circles
      changed += 1;
    }
  }

  logger.info({ checked: candidates.length, changed }, 'bracket recompute complete');
  return { checked: candidates.length, changed };
}