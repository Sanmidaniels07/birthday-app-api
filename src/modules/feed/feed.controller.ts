import type { Request, Response } from 'express';
import * as service from './feed.service.js';
import { ok } from '../../utils/response.js';

export async function mediaSignature(req: Request, res: Response) {
  ok(res, service.getPostMediaSignature(req.user!.sub));
}
export async function create(req: Request, res: Response) {
  ok(res, await service.createPost(req.user!.sub, req.body), undefined, 201);
}
export async function remove(req: Request, res: Response) {
  ok(res, await service.deletePost(req.user!.sub, req.params.postId as string));
}
export async function detail(req: Request, res: Response) {
  ok(res, await service.getPost(req.user!.sub, req.params.postId as string));
}
export async function home(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.homeFeed(req.user!.sub, { cursor, limit: Number(limit ?? 20) });
  ok(res, result.page, result.meta);
}
export async function byAuthor(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.authorFeed(req.user!.sub, req.params.username as string, {
    cursor,
    limit: Number(limit ?? 20),
  });
  ok(res, result.page, result.meta);
}

export async function react(req: Request, res: Response) {
  ok(res, await service.togglePostReaction(req.user!.sub, req.params.postId as string, req.body.emoji));
}
export async function reactions(req: Request, res: Response) {
  ok(res, await service.postReactions(req.user!.sub, req.params.postId as string));
}
export async function comment(req: Request, res: Response) {
  ok(
    res,
    await service.addComment(req.user!.sub, req.params.postId as string, req.body.body, req.body.parentId),
    undefined,
    201,
  );
}
export async function comments(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.listComments(req.user!.sub, req.params.postId as string, {
    cursor,
    limit: Number(limit ?? 20),
  });
  ok(res, result.page, result.meta);
}
export async function removeComment(req: Request, res: Response) {
  ok(res, await service.deleteComment(req.user!.sub, req.params.commentId as string));
}

export async function birthdays(req: Request, res: Response) {
  ok(res, await service.birthdaysToday(req.user!.sub));
}

export async function editPost(req: Request, res: Response) {
  ok(res, await service.editPost(req.user!.sub, req.params.postId as string, req.body.body));
}

export async function repost(req: Request, res: Response) {
  ok(
    res,
    await service.toggleRepost(req.user!.sub, req.params.postId as string),
  );
}

export async function byAuthorReposts(req: Request, res: Response) {
  const { cursor, limit } = req.query as { cursor?: string; limit?: string };
  const result = await service.authorReposts(
    req.user!.sub,
    req.params.username as string,
    { cursor, limit: Number(limit ?? 20) },
  );
  ok(res, result.page, result.meta);
}

export async function undoRepost(req: Request, res: Response) {
  ok(
    res,
    await service.removeRepost(req.user!.sub, req.params.postId as string),
  );
}