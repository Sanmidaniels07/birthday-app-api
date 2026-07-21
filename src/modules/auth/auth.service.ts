import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { hashPassword, generateOtp, hashOtp, verifyOtp } from "./auth.crypto.js";
import { ageOn, type SignupInput, type VerifyEmailInput } from "./auth.schemas.js";
import { verificationEmail } from "../../templates/verification.template.js";
import { sendEmail } from "../../lib/email.js";
import { isProd } from "../../config/env.js";
import { BadRequestError } from "../../utils/errors.js";

import { randomUUID } from "node:crypto";
import { UnauthorizedError, ForbiddenError } from "../../utils/errors.js";
import { verifyPassword, generateRefreshToken, hashRefreshToken } from "./auth.crypto.js";
import { signAccessToken } from "./auth.tokens.js";
import { env } from "../../config/env.js";
import type { LoginInput } from "./auth.schemas.js";
import { syncUserCommunities } from "../communities/communities.sync.js";
import { normalizePhone } from '../../utils/phone.js'; 


const OTP_TTL_MIN = 10;
const MAX_OTP_ATTEMPTS = 5;

export function computeAgeBracket(age: number): string | null {
  if (age < 18) return null;
  if (age <= 25) return "18-25";
  if (age <= 35) return "26-35";
  if (age <= 45) return "36-45";
  if (age <= 60) return "46-60";
  return "60+";
}

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string; 
  user: { id: string; fullName: string; email: string; role: string };
}

/** Build and fire the verification email without blocking the request. */
function dispatchVerificationEmail(email: string, fullName: string, otp: string): void {
  const mail = verificationEmail({
    name: fullName.split(" ")[0] ?? "there",
    code: otp,
    ttlMinutes: OTP_TTL_MIN,
  });
  void sendEmail({ to: email, ...mail }).catch((err) =>
    logger.error({ err, email }, "verification email failed"),
  );
}


export async function signup(input: SignupInput): Promise<{ email: string; otp?: string }> {
  const dob = new Date(`${input.birthDate}T00:00:00Z`);
  const age = ageOn(new Date(), dob);

  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing?.emailVerifiedAt) {
    logger.info({ email: input.email }, "signup attempt on verified email (no-op)");
    return { email: input.email };
  }

  const normalizedPhone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !normalizedPhone) {
    throw new BadRequestError('That phone number doesn\'t look valid');
  }

  const passwordHash = await hashPassword(input.password);
  const otp = generateOtp();

  await prisma.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            fullName: input.fullName,
            passwordHash,
            birthDate: dob,
            birthMonth: dob.getUTCMonth() + 1,
            birthDay: dob.getUTCDate(),
            ageBracket: computeAgeBracket(age),
            gender: input.gender,
            phone: normalizedPhone,
          },
        })
      : await tx.user.create({
          data: {
            fullName: input.fullName,
            email: input.email,
            passwordHash,
            birthDate: dob,
            birthMonth: dob.getUTCMonth() + 1,
            birthDay: dob.getUTCDate(),
            ageBracket: computeAgeBracket(age),
            gender: input.gender,
            phone: normalizedPhone,
          },
        });

    await tx.otpCode.deleteMany({
      where: { userId: user.id, purpose: "EMAIL_VERIFY" },
    });
    await tx.otpCode.create({
      data: {
        userId: user.id,
        codeHash: hashOtp(otp),
        purpose: "EMAIL_VERIFY",
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
      },
    });
  });

  dispatchVerificationEmail(input.email, input.fullName, otp);

  if (!isProd) logger.debug({ otp }, "OTP (dev convenience log)");
  return { email: input.email, ...(isProd ? {} : { otp }) };
}

export async function verifyEmail(input: VerifyEmailInput): Promise<{ verified: true }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (user?.emailVerifiedAt) return { verified: true };

  const fail = () => new BadRequestError("Invalid or expired code");

  if (!user) throw fail();

  const otp = await prisma.otpCode.findFirst({
    where: { userId: user.id, purpose: "EMAIL_VERIFY", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) throw fail();
  if (otp.expiresAt < new Date()) throw fail();
  if (otp.attempts >= MAX_OTP_ATTEMPTS) throw fail();

  if (!verifyOtp(otp.codeHash, input.code)) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw fail();
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    }),
    
    prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  void syncUserCommunities(user.id).catch((err) =>
    logger.error({ err, userId: user.id }, "community sync after verification failed"),
  );

  return { verified: true };
}

export async function resendOtp(email: string): Promise<{ email: string; otp?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Unknown or already-verified: pretend we sent. No enumeration oracle.
  if (!user || user.emailVerifiedAt) return { email };

  const otp = generateOtp();
  await prisma.$transaction(async (tx) => {
    await tx.otpCode.deleteMany({
      where: { userId: user.id, purpose: "EMAIL_VERIFY" },
    });
    await tx.otpCode.create({
      data: {
        userId: user.id,
        codeHash: hashOtp(otp),
        purpose: "EMAIL_VERIFY",
        expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000),
      },
    });
  });

  dispatchVerificationEmail(email, user.fullName, otp);

  if (!isProd) logger.debug({ otp }, "resent OTP (dev convenience log)");

  // Dev/staging convenience ONLY: expose the code so testing doesn't need an inbox.
  // In production the code travels by email alone — returning it would let anyone
  // verify an address they don't own.
  return { email, ...(!isProd ? { otp } : {}) };
}


const refreshExpiry = () =>
  new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

async function issueSession(
  user: { id: string; fullName: string; email: string; role: "USER" | "MODERATOR" | "ADMIN" },
  familyId: string,
  meta: SessionMeta,
): Promise<AuthResult> {
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt: refreshExpiry(),
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
    },
  });

  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken,
    user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
  };
}

export async function login(input: LoginInput, meta: SessionMeta): Promise<AuthResult> {
  const isEmail = input.identifier.includes('@');
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: input.identifier.toLowerCase() } })
    : await (async () => {
        const normalized = normalizePhone(input.identifier);
        return normalized ? prisma.user.findUnique({ where: { phone: normalized } }) : null;
      })();

  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (!user.emailVerifiedAt) {
    throw new ForbiddenError("Please verify your email first");
  }
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("This account is not active");
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

  return issueSession(user, randomUUID(), meta);
}

export async function refresh(presentedToken: string, meta: SessionMeta): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) throw new UnauthorizedError("Invalid session");

  // ── REUSE DETECTED ──
  // This token was already consumed. Two parties hold one token;
  // one of them is a thief. Kill the whole family.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn(
      { userId: stored.userId, familyId: stored.familyId },
      "refresh token REUSE — family revoked",
    );
    throw new UnauthorizedError("Session expired, please log in again");
  }

  if (stored.expiresAt < new Date()) throw new UnauthorizedError("Session expired");
  if (stored.user.status !== "ACTIVE") throw new UnauthorizedError("This account is not active");

  // Rotate: consume this token, issue the next in the SAME family.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueSession(stored.user, stored.familyId, meta);
}

export async function logout(presentedToken: string | undefined): Promise<void> {
  if (!presentedToken) return; 
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(presentedToken) },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      birthDate: true,
      birthMonth: true,
      birthDay: true,
      ageBracket: true,
      gender: true,
      autoJoinBirthdayCommunities: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });
  if (!user) throw new UnauthorizedError('Account no longer exists');
  return user;
}