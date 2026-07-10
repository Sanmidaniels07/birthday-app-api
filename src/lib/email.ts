import { Resend } from 'resend';
import { env, isProd } from '../config/env.js';
import { logger } from './logger.js';

/**
 * One email gateway for the whole app.
 * Missing RESEND_API_KEY → emails log to console instead of sending
 * (dev machines shouldn't need email credentials to run signup).
 */
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!resend || !env.EMAIL_FROM) {
    logger.info({ to: params.to, subject: params.subject }, '📧 email (console mode — no RESEND_API_KEY)');
    return;
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    logger.error({ error, to: params.to }, 'email send failed');
    if (isProd) throw new Error('EMAIL_SEND_FAILED');
  }
}