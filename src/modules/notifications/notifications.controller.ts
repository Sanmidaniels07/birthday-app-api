import type { Request, Response } from 'express';
import * as service from './notifications.service.js';
import { ok } from '../../utils/response.js';

export async function list(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.listNotifications(req.user!.sub, { cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}
export async function unread(req: Request, res: Response) {
  ok(res, await service.unreadNotificationCount(req.user!.sub));
}
export async function markRead(req: Request, res: Response) {
  ok(res, await service.markNotificationRead(req.user!.sub, req.params.notificationId as string));
}
export async function markAll(req: Request, res: Response) {
  ok(res, await service.markAllRead(req.user!.sub));
}
export async function preferences(req: Request, res: Response) {
  ok(res, await service.getPreferences(req.user!.sub));
}
export async function updatePreferences(req: Request, res: Response) {
  ok(res, await service.updatePreferences(req.user!.sub, req.body));
}

export async function vapidKey(req: Request, res: Response) {
  ok(res, service.getVapidPublicKey());
}
export async function subscribe(req: Request, res: Response) {
  ok(res, await service.subscribePush(req.user!.sub, req.body, req.headers['user-agent']), undefined, 201);
}
export async function unsubscribe(req: Request, res: Response) {
  ok(res, await service.unsubscribePush(req.user!.sub, req.body.endpoint));
}