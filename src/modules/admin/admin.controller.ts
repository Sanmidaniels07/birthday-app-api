import type { Request, Response } from 'express';
import * as service from './admin.service.js';
import { ok } from '../../utils/response.js';

export async function queue(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const result = await service.moderationQueue({
    status: q.status, targetType: q.targetType, reportedUsername: q.reportedUsername,
    cursor: q.cursor, limit: Number(q.limit ?? 20),
  });
  ok(res, result.page, result.meta);
}
export async function detail(req: Request, res: Response) {
  ok(res, await service.reportDetail(req.params.reportId as string));
}
export async function take(req: Request, res: Response) {
  ok(res, await service.takeReport(req.user!.sub, req.params.reportId as string));
}
export async function resolve(req: Request, res: Response) {
  ok(res, await service.resolveReport(req.user!.sub, req.params.reportId as string, req.body.resolution));
}
export async function dismiss(req: Request, res: Response) {
  ok(res, await service.dismissReport(req.user!.sub, req.params.reportId as string, req.body.resolution));
}
export async function suspend(req: Request, res: Response) {
  ok(res, await service.suspendUser(req.user!.sub, req.params.username as string, req.body.reason));
}
export async function ban(req: Request, res: Response) {
  ok(res, await service.banUser(req.user!.sub, req.params.username as string, req.body.reason));
}
export async function reactivate(req: Request, res: Response) {
  ok(res, await service.reactivateUser(req.user!.sub, req.params.username as string, req.body.reason));
}
export async function takedown(req: Request, res: Response) {
  const { targetType, targetId } = req.body as { targetType: 'POST' | 'COMMENT' | 'MESSAGE'; targetId: string };
  ok(res, await service.takedownContent(req.user!.sub, targetType, targetId));
}

export async function users(req: Request, res: Response) {
  const q = req.query as Record<string, string | undefined>;
  const result = await service.adminSearchUsers({
    q: q.q, status: q.status, cursor: q.cursor, limit: Number(q.limit ?? 20),
  });
  ok(res, result.page, result.meta);
}
export async function userDetail(req: Request, res: Response) {
  ok(res, await service.adminUserDetail(req.params.username as string));
}
export async function stats(_req: Request, res: Response) {
  ok(res, await service.platformStats());
}
export async function birthdaySweep(_req: Request, res: Response) {
  ok(res, await service.triggerBirthdaySweep());
}
export async function bracketRecompute(_req: Request, res: Response) {
  ok(res, await service.triggerBracketRecompute());
}