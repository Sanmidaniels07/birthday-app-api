import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/errors.js';
import type { Response } from 'express';
import { isProd } from '../../config/env.js';




export interface AccessTokenPayload {
  sub: string; 
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

export const REFRESH_COOKIE = 'bday_refresh';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    issuer: 'bday-api',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'bday-api' });
    return decoded as AccessTokenPayload;
  } catch {
    
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,                       // invisible to document.cookie — the XSS defense
    secure: isProd,                       // HTTPS-only in prod (localhost is http)
    sameSite: isProd ? 'none' : 'lax',    // 'none' because Vercel and Render are different sites
    path: '/api/v1/auth',                 // only auth routes ever receive it
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
}