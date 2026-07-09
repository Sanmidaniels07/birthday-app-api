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

// NOTE: in-memory limiters — correct for a single Render instance.
// When we scale horizontally we swap in rate-limit-redis (Upstash)
// as the store, without touching any route code.