import type { Request, Response } from 'express';
import * as service from './reports.service.js';
import { ok } from '../../utils/response.js';

export async function create(req: Request, res: Response) {
  ok(res, await service.createReport(req.user!.sub, req.body), undefined, 201);
}
export async function mine(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.listMyReports(req.user!.sub, { cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}