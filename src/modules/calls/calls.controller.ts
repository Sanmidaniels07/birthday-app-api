import type { Request, Response } from 'express';
import * as service from './calls.service.js';
import { ok } from '../../utils/response.js';

export async function initiate(req: Request, res: Response) {
  ok(res, await service.initiateCall(req.user!.sub, req.body.conversationId, req.body.type), undefined, 201);
}
export async function answer(req: Request, res: Response) {
  ok(res, await service.answerCall(req.user!.sub, req.params.callId as string));
}
export async function decline(req: Request, res: Response) {
  ok(res, await service.declineCall(req.user!.sub, req.params.callId as string));
}
export async function end(req: Request, res: Response) {
  ok(res, await service.endCall(req.user!.sub, req.params.callId as string));
}

export async function history(req: Request, res: Response) {
  const { conversationId, cursor, limit } = req.query as {
    conversationId: string; cursor?: string; limit?: string;
  };
  const result = await service.callHistory(req.user!.sub, conversationId, {
    cursor,
    limit: Number(limit ?? 20),
  });
  ok(res, result.page, result.meta);
}
export async function iceServers(req: Request, res: Response) {
  ok(res, await service.getIceServers());
}