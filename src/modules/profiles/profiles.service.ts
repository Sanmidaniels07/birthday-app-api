import { prisma } from "../../lib/prisma.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../utils/errors.js";
import type { SetupProfileInput } from "./profiles.schemas.js";
import type { UpdateProfileInput } from "./profiles.schemas.js";
import {
  cloudinaryEnabled,
  signAvatarUpload,
  MEDIA_ROOT,
   signCoverUpload as signCoverUploadGrant 
} from "../../lib/cloudinary.js";
import {
  blockExistsBetween,
  areFriends,
  blockedIdsFor,
} from "../social/social.helpers.js";
import { isOnline } from "../../sockets/index.js";
import { syncUserCommunities } from "../communities/communities.sync.js";
import { logger } from "../../lib/logger.js";
import { splitDate } from "../../utils/phone.js";


export async function isUsernameAvailable(u: string): Promise<boolean> {
  const existing = await prisma.profile.findUnique({
    where: { username: u },
    select: { id: true },
  });
  return existing === null;
}

const MONTH_TINTS = [
  "powder",
  "blush",
  "sage",
  "lavender",
  "butter",
  "peach",
  "butter",
  "sage",
  "powder",
  "lavender",
  "blush",
  "peach",
] as const;

export function defaultBlobTint(birthMonth: number): string {
  return MONTH_TINTS[birthMonth - 1] ?? "powder";
}

export async function setupProfile(userId: string, input: SetupProfileInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthMonth: true, profile: { select: { id: true } } },
  });
  if (!user) throw new NotFoundError("User");
  if (user.profile)
    throw new ConflictError("Profile already set up — use update instead");

  let profile;
  try {
    profile = await prisma.profile.create({
      data: {
        userId,
        username: input.username,
        displayName: input.displayName,
        bio: input.bio ?? null,
        blobTint: input.blobTint ?? defaultBlobTint(user.birthMonth),
        city: input.city ?? null,
        country: input.country ?? null,
      },
      select: publicProfileSelect,
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "P2002"
    ) {
      throw new ConflictError("That username was just taken — try another");
    }
    throw err;
  }
  if (input.anniversaryDate) {
    const { month, day } = splitDate(input.anniversaryDate);
    await prisma.user.update({
      where: { id: userId },
      data: { anniversaryMonth: month, anniversaryDay: day },
    });
  }
  void syncUserCommunities(userId).catch((err) =>
    logger.error({ err, userId }, "community sync on setup failed"),
  );

  return profile;
}

const publicProfileSelect = {
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  coverUrl: true,
  blobTint: true,
  visibility: true,
  createdAt: true,
} as const;

export async function getProfileByUsername(username: string, viewerId: string) {
  const profile = await prisma.profile.findUnique({
    where: { username },
    select: {
      ...publicProfileSelect,
      userId: true,
      showBirthYear: true,
      showAge: true,
      showAnniversary: true,
      showLocation: true,
      city: true,
      country: true,
      user: {
        select: {
          birthMonth: true,
          birthDay: true,
          birthDate: true,
          ageBracket: true,
          lastSeenAt: true,
          anniversaryMonth: true,
          anniversaryDay: true,
        },
      },
    },
  });

  const isOwner = profile?.userId === viewerId;

  if (
    profile &&
    !isOwner &&
    (await blockExistsBetween(viewerId, profile.userId))
  ) {
    throw new NotFoundError("Profile");
  }

  if (!profile || (profile.visibility === "PRIVATE" && !isOwner)) {
    throw new NotFoundError("Profile");
  }

  const [friends, pendingRequest, followRow] = isOwner
    ? [false, null, null]
    : await Promise.all([
        areFriends(viewerId, profile.userId),
        prisma.friendship.findFirst({
          where: {
            status: "PENDING",
            OR: [
              { requesterId: viewerId, addresseeId: profile.userId },
              { requesterId: profile.userId, addresseeId: viewerId },
            ],
          },
          select: { id: true, requesterId: true },
        }),
        prisma.follow.findUnique({
          where: {
            followerId_followeeId: {
              followerId: viewerId,
              followeeId: profile.userId,
            },
          },
          select: { createdAt: true },
        }),
      ]);

  if (profile.visibility === "FRIENDS_ONLY" && !isOwner && !friends) {
    throw new NotFoundError("Profile");
  }

  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    blobTint: profile.blobTint,
    isOwner,
    relationship: isOwner
      ? null
      : {
          isFriend: friends,
          isFollowing: followRow !== null,
          pendingRequest: pendingRequest
            ? {
                requestId: pendingRequest.id,
                direction:
                  pendingRequest.requesterId === viewerId
                    ? ("outgoing" as const)
                    : ("incoming" as const),
              }
            : null,
        },
    birthMonth: profile.user.birthMonth,
    birthDay: profile.user.birthDay,
    ...(profile.showBirthYear || isOwner
      ? { birthYear: profile.user.birthDate.getUTCFullYear() }
      : {}),
    ...(profile.showAge || isOwner
      ? { ageBracket: profile.user.ageBracket }
      : {}),
    ...(profile.showLocation || isOwner
      ? { city: profile.city, country: profile.country }
      : {}),
    ...(profile.showAnniversary || isOwner
      ? { anniversaryMonth: profile.user.anniversaryMonth, anniversaryDay: profile.user.anniversaryDay }
      : {}),
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError("Profile");

  const { anniversaryDate, ...profileFields } = input;
  const touchesAnniversary = anniversaryDate !== undefined;

  const updated = await prisma.$transaction(async (tx) => {
    if (touchesAnniversary) {
      const parsed = anniversaryDate ? splitDate(anniversaryDate) : { month: null, day: null };
      await tx.user.update({
        where: { id: userId },
        data: { anniversaryMonth: parsed.month, anniversaryDay: parsed.day },
      });
    }
    return tx.profile.update({
      where: { userId },
      data: profileFields,
      select: {
        ...publicProfileSelect,
        showBirthYear: true, showAge: true, showAnniversary: true,
        showLocation: true, showOnlineStatus: true, city: true, country: true,
        user: { select: { anniversaryMonth: true, anniversaryDay: true } },
      },
    });
  });

  if (touchesAnniversary) await syncUserCommunities(userId);

  const { user, ...rest } = updated;
  return {
    ...rest,
    anniversaryMonth: user.anniversaryMonth,
    anniversaryDay: user.anniversaryDay,
  };
}

export async function listInterests() {
  return prisma.interest.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function setMyInterests(userId: string, interestIds: string[]) {
  const found = await prisma.interest.count({
    where: { id: { in: interestIds } },
  });
  if (found !== interestIds.length)
    throw new BadRequestError("One or more interests do not exist");

  // Replace-all semantics: the client sends the complete new set.
  await prisma.$transaction([
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.userInterest.createMany({
      data: interestIds.map((interestId) => ({ userId, interestId })),
    }),
  ]);

  return listMyInterests(userId);
}

export async function listMyInterests(userId: string) {
  const rows = await prisma.userInterest.findMany({
    where: { userId },
    select: { interest: { select: { id: true, name: true, slug: true } } },
  });
  return rows.map((r) => r.interest);
}

export function getAvatarUploadSignature(userId: string) {
  if (!cloudinaryEnabled) {
    throw new BadRequestError(
      "Media uploads are not configured on this server",
    );
  }
  return signAvatarUpload(userId);
}

export async function confirmAvatar(userId: string, publicId: string, version?: number) {
  const expected = `${MEDIA_ROOT}/avatars/user_${userId}`;
  if (publicId !== expected) {
    throw new BadRequestError("Unexpected avatar reference");
  }

  const avatarUrl = version ? `${publicId}?v=${version}` : publicId;

  const profile = await prisma.profile.update({
    where: { userId },
    data: { avatarUrl },
    select: { username: true, avatarUrl: true },
  });
  return profile;
}

export async function searchProfiles(
  viewerId: string,
  q: string,
  limit: number,
) {
  const blockedIds = await blockedIdsFor(viewerId);

  const rows = await prisma.profile.findMany({
    where: {
      userId: { notIn: [viewerId, ...blockedIds] },
      visibility: { not: "PRIVATE" },
      user: { status: "ACTIVE", emailVerifiedAt: { not: null } },
      OR: [
        { username: { contains: q.toLowerCase() } },
        { displayName: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [
      { username: "asc" }, // deterministic; relevance ranking is a hardening-era upgrade
    ],
    take: limit,
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      blobTint: true,
      bio: true,
    },
  });

  return rows;
}

export async function getPresence(viewerId: string, username: string) {
  // Reuse the profile gate: can't see the profile → can't see presence.
  await getProfileByUsername(username, viewerId);

  const profile = await prisma.profile.findUnique({
    where: { username },
    select: {
      userId: true,
      showOnlineStatus: true,
      user: { select: { lastSeenAt: true } },
    },
  });
  if (!profile) throw new NotFoundError("Profile"); // unreachable post-gate

  if (!profile.showOnlineStatus) {
    return { online: null, lastSeenAt: null };
  }
  const online = isOnline(profile.userId);
  return { online, lastSeenAt: online ? null : profile.user.lastSeenAt };
}


export async function getMyProfile(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      blobTint: true,
      visibility: true,
      showBirthYear: true,
      showAge: true,
      showAnniversary: true,
      showLocation: true,
      showOnlineStatus: true,
      city: true,
      country: true,
      user: { select: { anniversaryMonth: true, anniversaryDay: true } },
    },
  });
  if (!profile) throw new NotFoundError("Profile");

  const { user, ...rest } = profile;
  return {
    ...rest,
    anniversaryMonth: user.anniversaryMonth,
    anniversaryDay: user.anniversaryDay,
  };
}


export function signCoverUpload(userId: string) {
  return signCoverUploadGrant(userId);
}

export async function confirmCoverUpload(userId: string, publicId: string, version?: number) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError('Profile');

  const coverUrl = version ? `${publicId}?v=${version}` : publicId;

  return prisma.profile.update({
    where: { userId },
    data: { coverUrl },
    select: {
      ...publicProfileSelect,
      coverUrl: true,
    },
  });
}
