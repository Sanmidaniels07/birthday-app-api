import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';

/** 404 for requests that matched no route. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} does not exist` },
  });
}

/**
 * The single place errors become HTTP responses.
 * Express 5 forwards rejected async handlers here automatically.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // 1) Known, intentional errors thrown by services
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // 2) Validation failures (zod) → 400 with per-field details
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  // 3) Everything else is a bug — log loudly, hide internals from the client
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Something went wrong' : ((err as Error)?.message ?? 'Unknown error'),
    },
  });
}