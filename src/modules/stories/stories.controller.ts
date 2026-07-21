import type { Request, Response } from 'express';
import * as storiesService from './stories.service.js';
import { signStoryUpload, type StoryMediaKind } from '../../lib/cloudinary.js';
import { ok, noContent } from '../../utils/response.js';

export async function create(req: Request, res: Response) {
  ok(res, await storiesService.createStory(req.user!.sub, req.body), undefined, 201);
}

export async function list(req: Request, res: Response) {
  ok(res, await storiesService.listStories(req.user!.sub));
}

export async function view(req: Request, res: Response) {
  await storiesService.viewStory(req.user!.sub, req.params.id as string);
  noContent(res);
}

export async function react(req: Request, res: Response) {
  ok(res, await storiesService.reactToStory(req.user!.sub, req.params.id as string, req.body.emoji));
}

export async function remove(req: Request, res: Response) {
  await storiesService.deleteStory(req.user!.sub, req.params.id as string);
  noContent(res);
}

export async function signMedia(req: Request, res: Response) {
  ok(res, signStoryUpload(req.user!.sub, req.query.kind as StoryMediaKind));
}