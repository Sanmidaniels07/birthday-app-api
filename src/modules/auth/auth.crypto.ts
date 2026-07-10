import argon2 from 'argon2';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';



export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false; 
  }
}

// ---- OTP codes ----

export function generateOtp(): string {
 
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function verifyOtp(codeHash: string, candidate: string): boolean {
  const a = Buffer.from(codeHash, 'hex');
  const b = Buffer.from(hashOtp(candidate), 'hex');

  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- Refresh tokens ----

export function generateRefreshToken(): string {

  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}