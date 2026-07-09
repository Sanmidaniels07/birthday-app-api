import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { healthRouter } from './modules/health/health-routes.js';
import { mountDocs } from './docs/swagger.js';

export function createApp() {
  const app = express();

 
  app.set('trust proxy', 1);

  app.use(helmet());                                  
  app.use(cors({
    origin: env.WEB_ORIGIN,                          
    credentials: true,                                
  }));
  app.use(compression());                            
  app.use(express.json({ limit: '1mb' }));            
  app.use(pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false, 
    },
  }));                                                
  app.use(globalLimiter);    
  
  // ---- Docs ----
   mountDocs(app);

  const v1 = express.Router();
  
  app.use('/api/v1', v1);

  v1.use('/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}