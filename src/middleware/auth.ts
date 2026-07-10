import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../modules/auth/auth.tokens.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';


export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing access token');
  }

  req.user = verifyAccessToken(header.slice('Bearer '.length));
  next();
}


export function requireRole(...roles: Array<'MODERATOR' | 'ADMIN'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError('Missing access token');
    if (!roles.includes(req.user.role as 'MODERATOR' | 'ADMIN')) {
      throw new ForbiddenError();
    }
    next();
  };
}