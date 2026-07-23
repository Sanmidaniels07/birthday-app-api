import type { Request, Response } from 'express';
import * as service from './social.service.js';
import { ok } from '../../utils/response.js';

export async function friends(req: Request, res: Response) {
  ok(res, await service.listFriends(req.user!.sub));
}
export async function incoming(req: Request, res: Response) {
  ok(res, await service.listRequests(req.user!.sub, 'incoming'));
}
export async function outgoing(req: Request, res: Response) {
  ok(res, await service.listRequests(req.user!.sub, 'outgoing'));
}
export async function send(req: Request, res: Response) {
  ok(res, await service.sendFriendRequest(req.user!.sub, req.body.username), undefined, 201);
}
export async function accept(req: Request, res: Response) {
  ok(res, await service.acceptFriendRequest(req.user!.sub, req.params.requestId as string));
}
export async function decline(req: Request, res: Response) {
  ok(res, await service.declineFriendRequest(req.user!.sub, req.params.requestId as string));
}
export async function cancel(req: Request, res: Response) {
  ok(res, await service.cancelFriendRequest(req.user!.sub, req.params.requestId as string));
}
export async function unfriend(req: Request, res: Response) {
  ok(res, await service.unfriend(req.user!.sub, req.params.username as string));
}

export async function follow(req: Request, res: Response) {
  ok(res, await service.follow(req.user!.sub, req.params.username as string));
}
export async function unfollow(req: Request, res: Response) {
  ok(res, await service.unfollow(req.user!.sub, req.params.username as string));
}
export async function following(req: Request, res: Response) {
  ok(res, await service.listFollowing(req.user!.sub, req.query.username as string | undefined));
}
export async function followers(req: Request, res: Response) {
  ok(res, await service.listFollowers(req.user!.sub, req.query.username as string | undefined));
}
export async function block(req: Request, res: Response) {
  ok(res, await service.blockUser(req.user!.sub, req.params.username as string));
}
export async function unblock(req: Request, res: Response) {
  ok(res, await service.unblockUser(req.user!.sub, req.params.username as string));
}
export async function blocked(req: Request, res: Response) {
  ok(res, await service.listBlocked(req.user!.sub));
}