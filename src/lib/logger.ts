import { pino } from 'pino';
import { isProd } from '../config/env.js';

/**
 * Structured JSON logs in production (Render parses these nicely),
 * pretty-printed colorized logs in development.
 */
export const logger = pino(
  isProd
    ? { level: 'info' }
    : {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      },
);