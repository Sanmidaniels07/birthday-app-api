import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { recomputeBrackets } from './recompute-brackets.job.js';
import { birthdayNotifications } from './birthday-notifications.job.js';

/**
 * In-process schedules, all UTC.
 *  00:15 — bracket recompute (before the birthday sweep reads brackets)
 *  07:00 — birthday taps (morning-ish for the largest user timezones;
 *          per-user-timezone delivery is a hardening-era refinement)
 * Every job body is idempotent — a doubled or missed run is harmless.
 */
export function startJobs(): void {
  cron.schedule('15 0 * * *', () => {
    void recomputeBrackets().catch((err) => logger.error({ err }, 'bracket recompute job failed'));
  }, { timezone: 'UTC' });

  cron.schedule('0 7 * * *', () => {
    void birthdayNotifications().catch((err) => logger.error({ err }, 'birthday notification job failed'));
  }, { timezone: 'UTC' });

  logger.info('Cron jobs scheduled (brackets 00:15 UTC, birthdays 07:00 UTC)');
}