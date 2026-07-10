import type { AccessTokenPayload } from '../modules/auth/auth.tokens.js';

/**
 * Type augmentation: teaches TypeScript that Express's Request
 * can carry the authenticated user. Set by requireAuth, read everywhere.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};