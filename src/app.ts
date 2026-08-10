import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { globalLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { mountDocs } from "./docs/swagger.js";
import { MOUNTS } from "./config/mount.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  // ---- Middleware (order matters) ----
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  const allowedOrigins = env.WEB_ORIGIN;
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) cb(null, true);
        else cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url?.startsWith("/api/v1/health") ?? false,
      },
    }),
  );
  app.use(globalLimiter);

  // ---- Docs ----
  mountDocs(app);

  // ---- API v1 ----
  const v1 = express.Router();
  for (const { path, router } of MOUNTS) v1.use(path, router);
  app.use("/api/v1", v1);

  // ---- Terminal handlers (must be LAST) ----
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
