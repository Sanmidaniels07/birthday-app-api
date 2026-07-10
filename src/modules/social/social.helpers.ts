import { prisma } from '../../lib/prisma.js';

/** One row, either orientation. Used by chat, feed, profiles — write it once. */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

/** Is there a block in EITHER direction? Blocks act symmetrically on visibility. */
export async function blockExistsBetween(a: string, b: string): Promise<boolean> {
  const row = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return row !== null;
}