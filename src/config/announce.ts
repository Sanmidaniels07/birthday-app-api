import { env } from './env.js';
import { logger } from '../lib/logger.js';
import { cloudinaryEnabled } from '../lib/cloudinary.js';
import { pushEnabled } from '../lib/push.js';

/**
 * One boot-time block declaring every optional integration's state.
 * The Cloudinary-vars gap ran silently for four slices because optional
 * env vars degrade quietly — this makes every degradation LOUD at the
 * exact moment someone is watching: deploy time, staring at logs.
 */
export function announceConfig(): void {
  const emailEnabled = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  const turnEnabled = Boolean(env.METERED_DOMAIN && env.METERED_SECRET);

  const line = (name: string, enabled: boolean, degradation: string) =>
    enabled ? `✅ ${name}: enabled` : `⚠️  ${name}: DISABLED — ${degradation}`;

  logger.info(
    [
      `── Integration status (${env.NODE_ENV}) ──`,
      line('Email (Resend)', emailEnabled, 'OTPs log to console; signups cannot verify by inbox'),
      line('Media (Cloudinary)', cloudinaryEnabled, 'avatar/post/chat uploads return 400'),
      line('TURN (Metered)', turnEnabled, 'calls are STUN-only; strict-NAT pairs will fail'),
      line('Web Push (VAPID)', pushEnabled, 'notifications are in-app + socket only'),
    ].join('\n'),
  );

  // In production, degraded integrations are almost certainly mistakes.
  if (env.NODE_ENV === 'production') {
    const missing = [
      !emailEnabled && 'Resend',
      !cloudinaryEnabled && 'Cloudinary',
      !turnEnabled && 'Metered TURN',
      !pushEnabled && 'VAPID',
    ].filter(Boolean);
    if (missing.length > 0) {
      logger.error({ missing }, 'Production booted with disabled integrations — is this intentional?');
    }
  }
}