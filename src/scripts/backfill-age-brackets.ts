import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ageOn } from '../modules/auth/auth.schemas.js';
import { computeAgeBracket } from '../modules/auth/auth.service.js';
import { syncUserCommunities } from '../modules/communities/communities.sync.js';

async function main() {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, birthDate: true, ageBracket: true },
  });

  let changed = 0;
  for (const u of users) {
    const bracket = computeAgeBracket(ageOn(now, u.birthDate));
    if (bracket === u.ageBracket) continue;
    await prisma.user.update({ where: { id: u.id }, data: { ageBracket: bracket } });
    await syncUserCommunities(u.id); 
    changed += 1;
  }

  logger.info({ checked: users.length, changed }, 'age bracket backfill complete');
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'backfill failed');
  process.exit(1);
});