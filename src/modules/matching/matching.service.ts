import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../utils/errors.js';
import { blockedIdsFor } from '../social/social.helpers.js';

const CANDIDATE_CAP = 120; 

interface ScoredMatch {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blobTint: string | null;
  score: number;
  reasons: string[];
  sharedInterests: number;
}

export async function discoverMatches(userId: string, limit: number): Promise<ScoredMatch[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      birthMonth: true, birthDay: true, ageBracket: true,
      profile: { select: { city: true, country: true } },
      interests: { select: { interestId: true } },
    },
  });
  if (!me) throw new NotFoundError('User');

  const myInterestIds = me.interests.map((i) => i.interestId);

  // Users with a block in either direction never enter the pool.
  const excludedIds = await blockedIdsFor(userId);

  // Visibility doctrine, applied at generation: PRIVATE and profile-less
  // users never enter the candidate pool at all.
  const visible = {
    id: { notIn: [userId, ...excludedIds] },
    status: 'ACTIVE' as const,
    emailVerifiedAt: { not: null },
    profile: { is: { visibility: { not: 'PRIVATE' as const } } },
  };

  const candidateSelect = {
    id: true, birthMonth: true, birthDay: true, ageBracket: true,
    profile: {
      select: { username: true, displayName: true, avatarUrl: true, blobTint: true, city: true, country: true },
    },
  } as const;

  // ---- Candidate generation: four indexed buckets, in parallel ----
  const [twins, monthMates, bracketMates, interestMates] = await Promise.all([
    prisma.user.findMany({
      where: { ...visible, birthMonth: me.birthMonth, birthDay: me.birthDay },
      take: CANDIDATE_CAP, select: candidateSelect,
    }),
    prisma.user.findMany({
      where: { ...visible, birthMonth: me.birthMonth },
      take: CANDIDATE_CAP, select: candidateSelect,
    }),
    me.ageBracket
      ? prisma.user.findMany({
          where: { ...visible, ageBracket: me.ageBracket },
          take: CANDIDATE_CAP, select: candidateSelect,
        })
      : Promise.resolve([]),
    myInterestIds.length > 0
      ? prisma.user.findMany({
          where: { ...visible, interests: { some: { interestId: { in: myInterestIds } } } },
          take: CANDIDATE_CAP, select: candidateSelect,
        })
      : Promise.resolve([]),
  ]);

  // Union by id
  const pool = new Map<string, (typeof twins)[number]>();
  for (const c of [...twins, ...monthMates, ...bracketMates, ...interestMates]) {
    pool.set(c.id, c);
  }
  if (pool.size === 0) return [];

  // Shared-interest counts for the whole pool in ONE query, not N
  const overlaps = myInterestIds.length
    ? await prisma.userInterest.groupBy({
        by: ['userId'],
        where: { userId: { in: [...pool.keys()] }, interestId: { in: myInterestIds } },
        _count: { interestId: true },
      })
    : [];
  const overlapByUser = new Map(overlaps.map((o) => [o.userId, o._count.interestId]));

  // ---- Scoring ----
  const scored: ScoredMatch[] = [];
  for (const c of pool.values()) {
    if (!c.profile) continue;

    let score = 0;
    const reasons: string[] = [];

    const sameDay = c.birthMonth === me.birthMonth && c.birthDay === me.birthDay;
    if (sameDay) {
      score += 50;
      reasons.push('Birthday twin');
    } else if (c.birthMonth === me.birthMonth) {
      score += 20;
      reasons.push('Same birth month');
    }

    if (me.ageBracket && c.ageBracket === me.ageBracket) {
      score += 15;
      reasons.push('Same age range');
    }

    const shared = overlapByUser.get(c.id) ?? 0;
    if (shared > 0) {
      score += Math.min(shared * 6, 30);
      reasons.push(shared === 1 ? '1 shared interest' : `${shared} shared interests`);
    }

    if (me.profile?.city && c.profile.city === me.profile.city) {
      score += 10;
      reasons.push('Same city');
    } else if (me.profile?.country && c.profile.country === me.profile.country) {
      score += 5;
      reasons.push('Same country');
    }

    scored.push({
      username: c.profile.username,
      displayName: c.profile.displayName,
      avatarUrl: c.profile.avatarUrl,
      blobTint: c.profile.blobTint,
      score,
      reasons,
      sharedInterests: shared,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  return scored.slice(0, limit);
}