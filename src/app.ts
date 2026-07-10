import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { mountDocs } from './docs/swagger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { profilesRouter } from './modules/profiles/profiles.routes.js';
import { communitiesRouter } from './modules/communities/communities.routes.js';
import { matchingRouter } from './modules/matching/matching.routes.js';
import { socialRouter } from './modules/social/social.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // ---- Middleware (order matters) ----
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false,
    },
  }));
  app.use(globalLimiter);

  // ---- Docs ----
  mountDocs(app);

  // ---- API v1 ----
  const v1 = express.Router();
  v1.use('/health', healthRouter);
  v1.use('/auth', authRouter);
  v1.use('/profiles', profilesRouter);
  v1.use('/communities', communitiesRouter);
  v1.use('/matching', matchingRouter);
  v1.use('/social', socialRouter);
  app.use('/api/v1', v1);

  // ---- Terminal handlers (must be LAST) ----
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}