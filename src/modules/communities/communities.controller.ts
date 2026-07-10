import type { Request, Response } from 'express';
import * as service from './communities.service.js';
import { ok } from '../../utils/response.js';

export async function mine(req: Request, res: Response) {
  ok(res, await service.listMyCommunities(req.user!.sub));
}
export async function browse(req: Request, res: Response) {
  const { type, cursor, limit } = req.query as { type?: string; cursor?: string; limit?: string };
  const result = await service.browseCommunities({ type, cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}
export async function detail(req: Request, res: Response) {
  ok(res, await service.getCommunity(req.params.id as string, req.user!.sub));
}
export async function join(req: Request, res: Response) {
  ok(res, await service.joinCommunity(req.user!.sub, req.params.id as string));
}
export async function leave(req: Request, res: Response) {
  ok(res, await service.leaveCommunity(req.user!.sub, req.params.id as string));
}
export async function members(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.listMembers(req.params.id as string, { cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}
export async function autoJoin(req: Request, res: Response) {
  ok(res, await service.setAutoJoin(req.user!.sub, req.body.enabled));
}