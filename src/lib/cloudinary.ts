import { v2 as cloudinary } from 'cloudinary';
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


export function signAvatarUpload(userId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    timestamp,
    folder: 'bday/avatars',
    public_id: `user_${userId}`,          // one avatar per user — new upload replaces old
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

/** Dev and staging share one free-tier cloud — folders provide the isolation. */
export const MEDIA_ROOT = `bday-${env.NODE_ENV}`;