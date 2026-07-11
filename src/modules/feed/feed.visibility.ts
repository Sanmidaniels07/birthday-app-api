import { prisma } from '../../lib/prisma.js';

/** The filter every post query must carry. Import it; never retype it. */
export const livePost = { deletedAt: null } as const;

/** All user ids connected to `userId` by a block, either direction. */
export { blockedIdsFor } from '../social/social.helpers.js';

/** All user ids whose posts belong in `userId`'s home feed: self + friends + followees. */
export async function feedAuthorIdsFor(userId: string): Promise<string[]> {
  const [friendships, follows] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: { followeeId: true },
    }),
  ]);

  const ids = new Set<string>([userId]);
  for (const f of friendships) ids.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
  for (const f of follows) ids.add(f.followeeId);
  return [...ids];
}