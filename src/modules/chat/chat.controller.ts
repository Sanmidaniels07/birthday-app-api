import type { Request, Response } from 'express';
import * as service from './chat.service.js';
import { ok } from '../../utils/response.js';

export async function createDm(req: Request, res: Response) {
  const { conversation, created } = await service.createOrGetDm(req.user!.sub, req.body.username);
  ok(res, conversation, undefined, created ? 201 : 200);
}
export async function createGroup(req: Request, res: Response) {
  ok(res, await service.createGroup(req.user!.sub, req.body.title, req.body.usernames), undefined, 201);
}
export async function inbox(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.listInbox(req.user!.sub, { cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}
export async function detail(req: Request, res: Response) {
  ok(res, await service.getConversation(req.user!.sub, req.params.conversationId as string));
}export async function send(req: Request, res: Response) {
  ok(
    res,
    await service.sendMessage(req.user!.sub, req.params.conversationId as string, req.body),
    undefined,
    201,
  );
}
export async function history(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.messageHistory(req.user!.sub, req.params.conversationId as string, {
    cursor,
    limit: Number(limit ?? 50),
  });
  ok(res, result.page, result.meta);
}
export async function edit(req: Request, res: Response) {
  ok(
    res,
    await service.editMessage(
      req.user!.sub,
      req.params.conversationId as string,
      req.params.messageId as string,
      req.body.body,
    ),
  );
}
export async function removeMessage(req: Request, res: Response) {
  ok(res, await service.deleteMessage(req.user!.sub, req.params.conversationId as string, req.params.messageId as string));
}

export async function read(req: Request, res: Response) {
  ok(res, await service.markRead(req.user!.sub, req.params.conversationId as string));
}
export async function unread(req: Request, res: Response) {
  ok(res, await service.unreadCounts(req.user!.sub));
}

export async function mediaSign(req: Request, res: Response) {
  const kind = (req.query as { kind: string }).kind as import('../../lib/cloudinary.js').ChatMediaKind;
  ok(res, await service.getChatMediaSignature(req.user!.sub, req.params.conversationId as string, kind));
}


export async function addMember(req: Request, res: Response) {
  ok(
    res,
    await service.addGroupMember(
      req.user!.sub,
      req.params.conversationId as string,
      req.body.username,
    ),
    undefined,
    201,
  );
}

export async function removeMember(req: Request, res: Response) {
  ok(
    res,
    await service.removeGroupMember(
      req.user!.sub,
      req.params.conversationId as string,
      req.params.username as string,
    ),
  );
}

export async function leave(req: Request, res: Response) {
  ok(res, await service.leaveGroup(req.user!.sub, req.params.conversationId as string));
}