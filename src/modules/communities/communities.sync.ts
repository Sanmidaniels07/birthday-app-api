import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';


const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Cover tints cycle through the design tokens by month, like blob tints. */
const MONTH_TINTS = [
  'powder', 'blush', 'sage', 'lavender', 'butter', 'peach',
  'butter', 'sage', 'powder', 'lavender', 'blush', 'peach',
] as const;

interface CommunitySpec {
  type: 'BIRTHDAY' | 'BIRTH_MONTH' | 'AGE_BRACKET';
  month: number | null;
  day: number | null;
  bracket: string | null;
  name: string;
  description: string;
  coverTint: string;
}

/** What SHOULD this user's auto-communities be? Pure function — easy to test. */
export function targetCommunitySpecs(user: {
  birthMonth: number;
  birthDay: number;
  ageBracket: string | null;
}): CommunitySpec[] {
  const monthName = MONTH_NAMES[user.birthMonth - 1] ?? 'January';
  const tint = MONTH_TINTS[user.birthMonth - 1] ?? 'powder';

  const specs: CommunitySpec[] = [
    {
      type: 'BIRTHDAY',
      month: user.birthMonth,
      day: user.birthDay,
      bracket: null,
      name: `${monthName} ${user.birthDay} Club`,
      description: `For everyone born on ${monthName} ${user.birthDay} — your birthday twins.`,
      coverTint: tint,
    },
    {
      type: 'BIRTH_MONTH',
      month: user.birthMonth,
      day: null,
      bracket: null,
      name: `${monthName} Babies`,
      description: `Everyone born in ${monthName}.`,
      coverTint: tint,
    },
  ];

  if (user.ageBracket) {
    specs.push({
      type: 'AGE_BRACKET',
      month: null,
      day: null,
      bracket: user.ageBracket,
      name: `${user.ageBracket} Circle`,
      description: `Connect with people in the ${user.ageBracket} age range.`,
      coverTint: 'sage',
    });
  }

  return specs;
}


async function ensureCommunity(spec: CommunitySpec): Promise<string> {
 
  const identity = {
    type: spec.type,
    month: spec.month,
    day: spec.day,
    bracket: spec.bracket,
  };

  const existing = await prisma.birthdayCommunity.findFirst({
    where: identity,
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.birthdayCommunity.create({
      data: { ...spec },
      select: { id: true },
    });
    logger.info({ name: spec.name }, 'community summoned into existence');
    return created.id;
  } catch (err: unknown) {
    // Two birthday twins signing up in the same instant: one create wins,
    // the loser lands here and uses the winner's row.
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      const winner = await prisma.birthdayCommunity.findFirst({
        where: identity,
        select: { id: true },
      });
      if (winner) return winner.id;
    }
    throw err;
  }
}

/** Reconcile: make the user's AUTO memberships equal the target set. */
export async function syncUserCommunities(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      birthMonth: true,
      birthDay: true,
      ageBracket: true,
      autoJoinBirthdayCommunities: true,
    },
  });
  if (!user) return; // deleted mid-flight; nothing to do

  // Toggle OFF → target set is empty → reconciliation removes all AUTO rows.
  const specs = user.autoJoinBirthdayCommunities ? targetCommunitySpecs(user) : [];
  const targetIds = await Promise.all(specs.map(ensureCommunity));
  const targetSet = new Set(targetIds);

  const current = await prisma.communityMembership.findMany({
    where: { userId, joinMethod: 'AUTO' },
    select: { communityId: true },
  });
  const currentSet = new Set(current.map((m) => m.communityId));

  const toAdd = targetIds.filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !targetSet.has(id));

  if (toAdd.length === 0 && toRemove.length === 0) return; // already in sync

  await prisma.$transaction(async (tx) => {
    if (toAdd.length > 0) {
      // skipDuplicates: if the user MANUALLY joined one of their own target
      // communities earlier, the @@unique(userId, communityId) row exists —
      // we leave it MANUAL and skip, rather than erroring or demoting it.
      await tx.communityMembership.createMany({
        data: toAdd.map((communityId) => ({ userId, communityId, joinMethod: 'AUTO' as const })),
        skipDuplicates: true,
      });
      await tx.birthdayCommunity.updateMany({
        where: { id: { in: toAdd } },
        data: { memberCount: { increment: 1 } },
      });
    }
    if (toRemove.length > 0) {
      await tx.communityMembership.deleteMany({
        where: { userId, communityId: { in: toRemove }, joinMethod: 'AUTO' },
      });
      await tx.birthdayCommunity.updateMany({
        where: { id: { in: toRemove } },
        data: { memberCount: { decrement: 1 } },
      });
    }
  });

  logger.debug({ userId, added: toAdd.length, removed: toRemove.length }, 'communities synced');
}