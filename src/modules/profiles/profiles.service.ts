import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import type { SetupProfileInput } from './profiles.schemas.js';
import type { UpdateProfileInput } from './profiles.schemas.js';
import { cloudinaryEnabled, signAvatarUpload, MEDIA_ROOT } from '../../lib/cloudinary.js';




export async function isUsernameAvailable(u: string): Promise<boolean> {
  const existing = await prisma.profile.findUnique({
    where: { username: u },
    select: { id: true },
  });
  return existing === null;
}



const MONTH_TINTS = [
  'powder', 'blush', 'sage', 'lavender', 'butter', 'peach',
  'butter', 'sage', 'powder', 'lavender', 'blush', 'peach',
] as const;

export function defaultBlobTint(birthMonth: number): string {
  return MONTH_TINTS[birthMonth - 1] ?? 'powder';
}

export async function setupProfile(userId: string, input: SetupProfileInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { birthMonth: true, profile: { select: { id: true } } },
  });
  if (!user) throw new NotFoundError('User');
  if (user.profile) throw new ConflictError('Profile already set up — use update instead');

  try {
    return await prisma.profile.create({
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
   
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw new ConflictError('That username was just taken — try another');
    }
    throw err;
  }
}

const publicProfileSelect = {
  username: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
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
      showLocation: true,
      city: true,
      country: true,
      user: {
        select: { birthMonth: true, birthDay: true, birthDate: true, ageBracket: true, lastSeenAt: true },
      },
    },
  });

  
  const isOwner = profile?.userId === viewerId;
  if (!profile || (profile.visibility === 'PRIVATE' && !isOwner)) {
    throw new NotFoundError('Profile');
  }
  if (profile.visibility === 'FRIENDS_ONLY' && !isOwner) {
    throw new NotFoundError('Profile'); 
  }

  // Assemble the viewer-appropriate shape. Privacy toggles GATE fields —
  // ungated data never even enters the response object.
  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    blobTint: profile.blobTint,
    isOwner,
    // Day + month are the app's public soul — always visible.
    birthMonth: profile.user.birthMonth,
    birthDay: profile.user.birthDay,
    ...(profile.showBirthYear || isOwner
      ? { birthYear: profile.user.birthDate.getUTCFullYear() }
      : {}),
    ...(profile.showAge || isOwner ? { ageBracket: profile.user.ageBracket } : {}),
    ...(profile.showLocation || isOwner
      ? { city: profile.city, country: profile.country }
      : {}),
  };
}


export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new NotFoundError('Profile'); // setup first, then update

  return prisma.profile.update({
    where: { userId },
    data: input, 
    select: {
      ...publicProfileSelect,
      showBirthYear: true,
      showAge: true,
      showLocation: true,
      showOnlineStatus: true,
      city: true,
      country: true,
    },
  });
}

export async function listInterests() {
  return prisma.interest.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } });
}

export async function setMyInterests(userId: string, interestIds: string[]) {
  const found = await prisma.interest.count({ where: { id: { in: interestIds } } });
  if (found !== interestIds.length) throw new BadRequestError('One or more interests do not exist');

  // Replace-all semantics: the client sends the complete new set.
  await prisma.$transaction([
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.userInterest.createMany({ data: interestIds.map((interestId) => ({ userId, interestId })) }),
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
    throw new BadRequestError('Media uploads are not configured on this server');
  }
  return signAvatarUpload(userId);
}

export async function confirmAvatar(userId: string, publicId: string) {

  const expected = `${MEDIA_ROOT}/avatars/user_${userId}`;
  if (publicId !== expected) {
    throw new BadRequestError('Unexpected avatar reference');
  }

  const profile = await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: publicId },
    select: { username: true, avatarUrl: true },
  });
  return profile;
}

