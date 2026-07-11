import rateLimit from 'express-rate-limit';

const shared = {
  standardHeaders: true, // send RateLimit-* headers so clients can self-throttle
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } },
} as const;

/** Baseline for the whole API. */
export const globalLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 300,       // per IP
  ...shared,
});

/** Stricter limiter for auth endpoints (login, signup) — mounted in the auth stage. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  ...shared,
});

/** OTP requests are the most abusable — tightest of all. */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  ...shared,
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  ...shared,
});

/** Discovery is compute-heavy and scrape-attractive. */
export const discoverLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  ...shared,
});

/** Social writes — friend requests are the spam/harassment vector. */
export const socialWriteLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  ...shared,
});

/** Post creation — the content-spam vector. */
export const postLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  ...shared,
});

/** Comments/reactions are lighter but still floodable. */
export const interactionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  ...shared,
});