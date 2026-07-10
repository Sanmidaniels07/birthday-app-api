import type { Request, Response } from 'express';
import * as service from './matching.service.js';
import { ok } from '../../utils/response.js';

export async function discover(req: Request, res: Response) {
  const limit = Number((req.query as { limit?: string }).limit ?? 20);
  ok(res, await service.discoverMatches(req.user!.sub, limit));
}