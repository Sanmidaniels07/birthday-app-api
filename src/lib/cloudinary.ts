import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Dev and staging share one free-tier cloud — folders provide the isolation. */
export const MEDIA_ROOT = `bday-${env.NODE_ENV}`;

export function signAvatarUpload(userId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder: `${MEDIA_ROOT}/avatars`,    
    public_id: `user_${userId}`,
    overwrite: 'true',
    transformation: 'c_fill,g_face,w_512,h_512,q_auto,f_auto',
  };

  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);

  return {
    ...params,
    signature,
    apiKey: env.CLOUDINARY_API_KEY!,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

export function signPostMediaUpload(userId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder: `${MEDIA_ROOT}/posts/${userId}`,
    public_id: `post_${randomUUID()}`,
    transformation: 'c_limit,w_1600,h_1600,q_auto,f_auto',
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  return {
    ...params,
    signature,
    apiKey: env.CLOUDINARY_API_KEY!,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

export type ChatMediaKind = 'image' | 'voice_note' | 'audio' | 'video';

/** Per-kind upload policy — signed in, so the client cannot exceed it. */
const CHAT_MEDIA_POLICY: Record<
  ChatMediaKind,
  { resourceType: 'image' | 'video'; transformation?: string }
> = {
  image: { resourceType: 'image', transformation: 'c_limit,w_1600,h_1600,q_auto,f_auto' },
  // Cloudinary treats all audio as resource_type "video"
  voice_note: { resourceType: 'video' },
  audio: { resourceType: 'video' },
  video: { resourceType: 'video', transformation: 'c_limit,w_1280,h_1280,q_auto' },
};

export function signChatMediaUpload(userId: string, kind: ChatMediaKind) {
  const policy = CHAT_MEDIA_POLICY[kind];
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    timestamp,
    folder: `${MEDIA_ROOT}/chat/${userId}`,
    public_id: `${kind}_${randomUUID()}`,
    ...(policy.transformation ? { transformation: policy.transformation } : {}),
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  return {
    ...params,
    signature,
    kind,
    resourceType: policy.resourceType,
    apiKey: env.CLOUDINARY_API_KEY!,
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${policy.resourceType}/upload`,
  };
}