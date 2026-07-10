import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { syncUserCommunities } from './communities.sync.js';

const communityCardSelect = {
  id: true, type: true, name: true, description: true,
  coverTint: true, memberCount: true, month: true, day: true, bracket: true,
} as const;

export async function listMyCommunities(userId: string) {
  const rows = await prisma.communityMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
    select: { joinMethod: true, joinedAt: true, community: { select: communityCardSelect } },
  });
  return rows.map((r) => ({ ...r.community, joinMethod: r.joinMethod, joinedAt: r.joinedAt }));
}

export async function browseCommunities(opts: { type?: string; cursor?: string; limit: number }) {
  const rows = await prisma.birthdayCommunity.findMany({
    where: opts.type ? { type: opts.type as 'BIRTHDAY' | 'BIRTH_MONTH' | 'AGE_BRACKET' } : undefined,
    orderBy: [{ memberCount: 'desc' }, { id: 'asc' }],
    take: opts.limit + 1, 
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: communityCardSelect,
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return { page, meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore } };
}

export async function getCommunity(id: string, userId: string) {
  const community = await prisma.birthdayCommunity.findUnique({
    where: { id },
    select: communityCardSelect,
  });
  if (!community) throw new NotFoundError('Community');

  const membership = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId: id } },
    select: { joinMethod: true, joinedAt: true },
  });

  return { ...community, membership };
}

export async function joinCommunity(userId: string, communityId: string) {
  const community = await prisma.birthdayCommunity.findUnique({
    where: { id: communityId }, select: { id: true },
  });
  if (!community) throw new NotFoundError('Community');

  const existing = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { id: true, joinMethod: true },
  });

  if (existing?.joinMethod === 'MANUAL') {
    throw new ConflictError('You are already a member');
  }

  if (existing) {
    // AUTO → MANUAL upgrade: explicit choice outranks automation,
    // and survives a future toggle-off. Count unchanged — same human.
    await prisma.communityMembership.update({
      where: { id: existing.id }, data: { joinMethod: 'MANUAL' },
    });
    return { joined: true, upgraded: true };
  }

  await prisma.$transaction([
    prisma.communityMembership.create({
      data: { userId, communityId, joinMethod: 'MANUAL' },
    }),
    prisma.birthdayCommunity.update({
      where: { id: communityId }, data: { memberCount: { increment: 1 } },
    }),
  ]);
  return { joined: true, upgraded: false };
}

export async function leaveCommunity(userId: string, communityId: string) {
  const membership = await prisma.communityMembership.findUnique({
    where: { userId_communityId: { userId, communityId } },
    select: { id: true, joinMethod: true },
  });
  if (!membership) throw new NotFoundError('Membership');

  if (membership.joinMethod === 'AUTO') {
    throw new ConflictError(
      'This is one of your automatic birthday communities — turn off auto-join in settings to leave it',
    );
  }

  await prisma.$transaction([
    prisma.communityMembership.delete({ where: { id: membership.id } }),
    prisma.birthdayCommunity.update({
      where: { id: communityId }, data: { memberCount: { decrement: 1 } },
    }),
  ]);
  return { left: true };
}

export async function listMembers(communityId: string, opts: { cursor?: string; limit: number }) {
  const community = await prisma.birthdayCommunity.findUnique({
    where: { id: communityId }, select: { id: true },
  });
  if (!community) throw new NotFoundError('Community');

  const rows = await prisma.communityMembership.findMany({
    where: {
      communityId,
      // PRIVATE profiles don't appear in member lists — same doctrine
      // as the 404 on private profile fetches. No profile yet = also hidden.
      user: { profile: { is: { visibility: { not: 'PRIVATE' } } } },
    },
    orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      joinedAt: true,
      user: {
        select: {
          profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
        },
      },
    },
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;
  return {
    page: page.map((m) => ({ ...m.user.profile, joinedAt: m.joinedAt })),
    meta: { cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null, hasMore },
  };
}

export async function setAutoJoin(userId: string, enabled: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: { autoJoinBirthdayCommunities: enabled },
  });
  // Synchronous on purpose: the response should reflect the new reality,
  // so the settings screen can refetch communities immediately.
  await syncUserCommunities(userId);
  return { autoJoinBirthdayCommunities: enabled };
}