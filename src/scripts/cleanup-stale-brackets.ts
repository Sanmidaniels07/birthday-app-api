import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const STALE = ['60+']; 
const APPLY = process.argv.includes('--apply');

async function main() {
  const communities = await prisma.birthdayCommunity.findMany({
    where: { type: 'AGE_BRACKET', bracket: { in: STALE } },
    select: { id: true, name: true, memberCount: true },
  });

  for (const c of communities) {
    const memberships = await prisma.communityMembership.groupBy({
      by: ['joinMethod'],
      where: { communityId: c.id },
      _count: true,
    });
    logger.info({ name: c.name, memberCount: c.memberCount, memberships }, 'stale circle');

    const remaining = memberships.reduce((n, m) => n + m._count, 0);
    if (remaining > 0) {
      logger.warn({ name: c.name, remaining }, 'still has members, skipping');
      continue;
    }

    if (!APPLY) continue; // dry run
    await prisma.birthdayCommunity.delete({ where: { id: c.id } });
    logger.info({ name: c.name }, 'deleted');
  }
}

main()
  .catch((err) => {
    logger.error({ err }, 'cleanup failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());