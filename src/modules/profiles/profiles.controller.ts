import type { Request, Response } from 'express';
import * as profilesService from './profiles.service.js';
import { ok } from '../../utils/response.js';
import { signCoverUpload } from '../../lib/cloudinary.js';

export async function usernameAvailable(req: Request, res: Response) {
  const u = req.query.u as string; 
  const available = await profilesService.isUsernameAvailable(u);
  ok(res, { username: u, available });
}

export async function setup(req: Request, res: Response) {
  const profile = await profilesService.setupProfile(req.user!.sub, req.body);
  ok(res, profile, undefined, 201);
}

export async function getByUsername(req: Request, res: Response) {
  const profile = await profilesService.getProfileByUsername(
    req.params.username as string,
    req.user!.sub,
  );
  ok(res, profile);
}

export async function update(req: Request, res: Response) {
  const profile = await profilesService.updateProfile(req.user!.sub, req.body);
  ok(res, profile);
}

export async function interests(_req: Request, res: Response) {
  ok(res, await profilesService.listInterests());
}

export async function myInterests(req: Request, res: Response) {
  ok(res, await profilesService.listMyInterests(req.user!.sub));
}

export async function setInterests(req: Request, res: Response) {
  ok(res, await profilesService.setMyInterests(req.user!.sub, req.body.interestIds));
}

export async function avatarSignature(req: Request, res: Response) {
  ok(res, profilesService.getAvatarUploadSignature(req.user!.sub));
}

export async function confirmAvatar(req: Request, res: Response) {
  ok(res, await profilesService.confirmAvatar(req.user!.sub, req.body.publicId, req.body.version));
}

export async function search(req: Request, res: Response) {
  const { q, limit } = req.query as { q: string; limit?: string };
  ok(res, await profilesService.searchProfiles(req.user!.sub, q, Number(limit ?? 10)));
}
export async function presence(req: Request, res: Response) {
  ok(res, await profilesService.getPresence(req.user!.sub, req.params.username as string));
}

export async function myProfile(req: Request, res: Response) {
  ok(res, await profilesService.getMyProfile(req.user!.sub));
}

export async function signCover(req: Request, res: Response) {
  ok(res, signCoverUpload(req.user!.sub));
}

export async function confirmCover(req: Request, res: Response) {
  ok(res, await profilesService.confirmCoverUpload(req.user!.sub, req.body.publicId, req.body.version));
}