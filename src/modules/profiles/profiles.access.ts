import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../utils/errors.js';
import { areFriends, blockExistsBetween } from '../social/social.helpers.js';

/**
 * THE visibility gate: may viewer see this profile at all?
 * Returns the userId on success (what callers invariably need next);
 * throws the indistinguishable 404 for: missing, PRIVATE (non-owner),
 * FRIENDS_ONLY (non-friend), blocked either direction.
 * One implementation of "who can see this user" — never re-derive it.
 */
export async function canViewProfile(viewerId: string, username: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: { userId: true, visibility: true },
  });

  const isOwner = profile?.userId === viewerId;
  if (!profile) throw new NotFoundError('Profile');
  if (!isOwner && (await blockExistsBetween(viewerId, profile.userId))) {
    throw new NotFoundError('Profile');
  }
  if (profile.visibility === 'PRIVATE' && !isOwner) throw new NotFoundError('Profile');
  if (profile.visibility === 'FRIENDS_ONLY' && !isOwner && !(await areFriends(viewerId, profile.userId))) {
    throw new NotFoundError('Profile');
  }
  return profile.userId;
}