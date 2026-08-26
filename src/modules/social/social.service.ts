import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { areFriends, blockExistsBetween } from './social.helpers.js';
import { dispatch } from '../notifications/notifications.service.js';

const friendCardSelect = {
  profile: { select: { username: true, displayName: true, avatarUrl: true, blobTint: true } },
} as const;

/** Resolve a username to a connectable user id — visible, active, verified. */
async function resolveTarget(username: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: {
      userId: true,
      user: { select: { status: true, emailVerifiedAt: true } },
    },
  });
  if (!profile || profile.user.status !== 'ACTIVE' || !profile.user.emailVerifiedAt) {
    throw new NotFoundError('User');
  }
  return profile.userId;
}

/** Shared notifier for both send paths. */
async function notifyRequest(requesterId: string, addresseeId: string, requestId: string) {
  const requester = await prisma.profile.findUnique({
    where: { userId: requesterId },
    select: { displayName: true },
  });
  await dispatch({
    recipientId: addresseeId,
    actorId: requesterId,
    type: 'FRIEND_REQUEST',
    title: `${requester?.displayName ?? 'Someone'} sent you a friend request`,
    entityType: 'friendRequest',
    entityId: requestId,
  });
}

export async function sendFriendRequest(requesterId: string, targetUsername: string) {
  const addresseeId = await resolveTarget(targetUsername);

  // Preflight gauntlet — each check earns its place:
  if (addresseeId === requesterId) throw new BadRequestError('You cannot friend yourself');

  // Blocked either way → indistinguishable from "user not found". No oracle.
  if (await blockExistsBetween(requesterId, addresseeId)) throw new NotFoundError('User');

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') throw new ConflictError('You are already friends');
    if (existing.status === 'PENDING') {
      // If THEY already asked US, this "send" is really an accept-in-waiting.
      if (existing.requesterId === addresseeId) {
        throw new ConflictError('They already sent you a request — accept it instead');
      }
      throw new ConflictError('Request already pending');
    }
    // DECLINED: re-request is allowed by reviving the row with roles as-now.
    const revived = await prisma.friendship.update({
      where: { id: existing.id },
      data: { requesterId, addresseeId, status: 'PENDING', respondedAt: null, createdAt: new Date() },
      select: { id: true, status: true },
    });
    void notifyRequest(requesterId, addresseeId, revived.id);
    return revived;
  }

  const created = await prisma.friendship.create({
    data: { requesterId, addresseeId },
    select: { id: true, status: true },
  });
  void notifyRequest(requesterId, addresseeId, created.id);
  return created;
}

/** Load a pending request and verify the actor is the required side. */
async function pendingRequestForRole(
  requestId: string,
  actorId: string,
  role: 'addressee' | 'requester',
) {
  const request = await prisma.friendship.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, requesterId: true, addresseeId: true },
  });
  // Wrong id, not yours, or not pending → same 404. A request's existence
  // is only knowable to its two parties, and only while it's live.
  if (!request || request.status !== 'PENDING') throw new NotFoundError('Friend request');
  const expectedActor = role === 'addressee' ? request.addresseeId : request.requesterId;
  if (expectedActor !== actorId) throw new NotFoundError('Friend request');
  return request;
}

export async function acceptFriendRequest(actorId: string, requestId: string) {
  const request = await pendingRequestForRole(requestId, actorId, 'addressee');
  await prisma.friendship.update({
    where: { id: request.id },
    data: { status: 'ACCEPTED', respondedAt: new Date() },
  });

  const accepter = await prisma.profile.findUnique({
    where: { userId: actorId },
    select: { displayName: true },
  });
  void dispatch({
    recipientId: request.requesterId,
    actorId,
    type: 'FRIEND_ACCEPTED',
    title: `${accepter?.displayName ?? 'Someone'} accepted your friend request`,
    entityType: 'user',
    entityId: actorId,
  });

  return { accepted: true };
}

export async function declineFriendRequest(actorId: string, requestId: string) {
  const request = await pendingRequestForRole(requestId, actorId, 'addressee');
  await prisma.friendship.update({
    where: { id: request.id },
    data: { status: 'DECLINED', respondedAt: new Date() },
  });
  return { declined: true };
}

export async function cancelFriendRequest(actorId: string, requestId: string) {
  const request = await pendingRequestForRole(requestId, actorId, 'requester');
  // Cancel deletes — unlike decline. The requester withdrawing leaves no
  // memory to guard; the addressee may never even have seen it.
  await prisma.friendship.delete({ where: { id: request.id } });
  return { cancelled: true };
}

export async function unfriend(actorId: string, targetUsername: string) {
  const otherId = await resolveTarget(targetUsername);
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: actorId, addresseeId: otherId },
        { requesterId: otherId, addresseeId: actorId },
      ],
    },
    select: { id: true },
  });
  if (!friendship) throw new NotFoundError('Friendship');
  await prisma.friendship.delete({ where: { id: friendship.id } });
  return { unfriended: true };
}
export async function listFriends(userId: string) {
  const rows = await prisma.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    orderBy: { respondedAt: 'desc' },
    select: {
      respondedAt: true,
      requesterId: true,
      requester: { select: friendCardSelect },
      addressee: { select: friendCardSelect },
    },
  });
  
  return rows
    .filter((r) => (r.requesterId === userId ? r.addressee : r.requester).profile !== null)
    .map((r) => {
      const other = r.requesterId === userId ? r.addressee : r.requester;
      return { ...other.profile, friendsSince: r.respondedAt };
    });
}

export async function listRequests(userId: string, direction: 'incoming' | 'outgoing') {
  const rows = await prisma.friendship.findMany({
    where:
      direction === 'incoming'
        ? { addresseeId: userId, status: 'PENDING' }
        : { requesterId: userId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      requester: { select: friendCardSelect },
      addressee: { select: friendCardSelect },
    },
  });
  return rows.map((r) => ({
    requestId: r.id,
    sentAt: r.createdAt,
    user: (direction === 'incoming' ? r.requester : r.addressee).profile,
  }));
}

export async function follow(followerId: string, targetUsername: string) {
  const followeeId = await resolveTarget(targetUsername);
  if (followeeId === followerId) throw new BadRequestError('You cannot follow yourself');
  if (await blockExistsBetween(followerId, followeeId)) throw new NotFoundError('User');

  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId, followeeId } },
    update: {},          // already following → no-op, not an error. Idempotent.
    create: { followerId, followeeId },
  });
  return { following: true };
}

export async function unfollow(followerId: string, targetUsername: string) {
  const followeeId = await resolveTarget(targetUsername);
  await prisma.follow.deleteMany({
    where: { followerId, followeeId },  
  });
  return { following: false };
}

async function resolveNetworkTarget(viewerId: string, targetUsername?: string): Promise<string> {
  if (!targetUsername) return viewerId;

  const targetId = await resolveTarget(targetUsername); // existing helper — throws NotFoundError if no such user
  if (targetId === viewerId) return targetId;

  if (await blockExistsBetween(viewerId, targetId)) throw new NotFoundError('User');

  const profile = await prisma.profile.findUnique({
    where: { userId: targetId },
    select: { visibility: true },
  });
  if (!profile) throw new NotFoundError('User');

  if (profile.visibility === 'PRIVATE') throw new NotFoundError('User');
  if (profile.visibility === 'FRIENDS_ONLY' && !(await areFriends(viewerId, targetId))) {
    throw new NotFoundError('User');
  }

  return targetId;
}

const networkRowSelect = {
  username: true, displayName: true, avatarUrl: true, blobTint: true,
} as const;

export async function listFollowing(viewerId: string, targetUsername?: string) {
  const userId = await resolveNetworkTarget(viewerId, targetUsername);
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, followee: { select: friendCardSelect } },
  });
  return rows
    .filter((r) => r.followee.profile !== null)
    .map((r) => ({ ...r.followee.profile, followedAt: r.createdAt }));
}

export async function listFollowers(viewerId: string, targetUsername?: string) {
  const userId = await resolveNetworkTarget(viewerId, targetUsername);
  const rows = await prisma.follow.findMany({
    where: { followeeId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, follower: { select: friendCardSelect } },
  });
  return rows
    .filter((r) => r.follower.profile !== null)
    .map((r) => ({ ...r.follower.profile, followedAt: r.createdAt }));
}

export async function blockUser(blockerId: string, targetUsername: string) {
  const blockedId = await resolveTarget(targetUsername);
  if (blockedId === blockerId) throw new BadRequestError('You cannot block yourself');

  await prisma.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    // Blocking severs everything, both directions, in the same transaction:
    await tx.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: blockerId, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: blockerId },
        ],
      },
    });
    await tx.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followeeId: blockedId },
          { followerId: blockedId, followeeId: blockerId },
        ],
      },
    });
  });
  return { blocked: true };
}

export async function unblockUser(blockerId: string, targetUsername: string) {
  // NOTE: resolveTarget would 404 here if the blocked user went PRIVATE —
  // but unblocking must always be possible. Resolve by username only:
  const profile = await prisma.profile.findUnique({
    where: { username: targetUsername },
    select: { userId: true },
  });
  if (!profile) throw new NotFoundError('User');

  await prisma.block.deleteMany({
    where: { blockerId, blockedId: profile.userId },  // only MY block — theirs, if any, stands
  });
  return { blocked: false };
}

export async function listBlocked(userId: string) {
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, blocked: { select: friendCardSelect } },
  });
  return rows
    .filter((r) => r.blocked.profile !== null)
    .map((r) => ({ ...r.blocked.profile, blockedAt: r.createdAt }));
}