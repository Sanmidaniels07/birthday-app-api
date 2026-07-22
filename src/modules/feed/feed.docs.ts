import { registerEndpoint } from '../../docs/openapi.js';
import { createPostSchema } from './feed.schemas.js';
import { reactionSchema, addCommentSchema } from './feed.schemas.js';


registerEndpoint({
  method: 'post', path: '/feed/posts/media/sign', tag: 'Feed',
  summary: 'Signed upload slot for ONE post image (call once per image, max 4)', secured: true,
  responses: { '200': { description: 'Upload parameters + signature' }, '429': { description: 'Rate limited' } },
});
registerEndpoint({
  method: 'post', path: '/feed/posts', tag: 'Feed',
  summary: 'Create a post (text, media, or both; isBirthdayPost only on your actual birthday)',
  secured: true,
  body: createPostSchema,
  responses: {
    '201': { description: 'The post card' },
    '400': { description: 'Empty post, foreign media reference, or birthday claim on a non-birthday' },
  },
});
registerEndpoint({
  method: 'get', path: '/feed/posts/{postId}', tag: 'Feed',
  summary: 'A single post', secured: true,
  responses: { '200': { description: 'The post card' }, '404': { description: 'Missing or deleted' } },
});
registerEndpoint({
  method: 'delete', path: '/feed/posts/{postId}', tag: 'Feed',
  summary: 'Soft-delete my post', secured: true,
  responses: { '200': { description: 'Deleted' }, '404': { description: 'Missing, deleted, or not yours' } },
});
registerEndpoint({
  method: 'get', path: '/feed/home', tag: 'Feed',
  summary: 'My home feed: me + friends + followed users, newest first (cursor pagination)', secured: true,
  responses: {
    '200': {
      description: 'Post cards',
      example: { data: [{ id: 'ckx…', body: 'Hello!', isBirthdayPost: false }], meta: { cursor: 'ckx…', hasMore: true } },
    },
  },
});
registerEndpoint({
  method: 'get', path: '/feed/by/{username}', tag: 'Feed',
  summary: "A user's timeline (gated exactly like their profile)", secured: true,
  responses: { '200': { description: 'Post cards' }, '404': { description: 'Not found, private, friends-only, or blocked' } },
});


registerEndpoint({
  method: 'post', path: '/feed/posts/{postId}/reactions', tag: 'Feed',
  summary: 'Toggle an emoji reaction (🎉 ❤️ 👍 😂 😮 🎂)', secured: true,
  body: reactionSchema,
  responses: {
    '200': { description: 'New state', example: { data: { emoji: '🎂', reacted: true } } },
    '400': { description: 'Unsupported emoji' },
    '404': { description: 'Post missing, deleted, or blocked author' },
  },
});
registerEndpoint({
  method: 'get', path: '/feed/posts/{postId}/reactions', tag: 'Feed',
  summary: 'Reaction summary with my state', secured: true,
  responses: {
    '200': { description: 'Per-emoji counts', example: { data: [{ emoji: '🎉', count: 4, reactedByMe: true }] } },
  },
});
registerEndpoint({
  method: 'post', path: '/feed/posts/{postId}/comments', tag: 'Feed',
  summary: 'Comment, or reply with parentId (one level only)', secured: true,
  body: addCommentSchema,
  responses: {
    '201': { description: 'The comment card' },
    '400': { description: 'Reply-to-a-reply refused' },
    '404': { description: 'Post or parent comment not found' },
  },
});
registerEndpoint({
  method: 'get', path: '/feed/posts/{postId}/comments', tag: 'Feed',
  summary: 'Top-level comments oldest-first with inline replies (cursor pagination)', secured: true,
  responses: { '200': { description: 'Comment threads' } },
});
registerEndpoint({
  method: 'delete', path: '/feed/comments/{commentId}', tag: 'Feed',
  summary: 'Soft-delete my comment', secured: true,
  responses: { '200': { description: 'Deleted' }, '404': { description: 'Missing, deleted, or not yours' } },
});

registerEndpoint({
  method: 'get', path: '/feed/birthdays-today', tag: 'Feed',
  summary: "My connections whose birthday is today (UTC)", secured: true,
  responses: {
    '200': { description: 'Profile cards to celebrate', example: { data: [{ username: 'maya_s', displayName: 'Maya', blobTint: 'blush' }] } },
  },
});

registerEndpoint({
  method: 'patch', path: '/feed/posts/{postId}', tag: 'Feed',
  summary: 'Edit my post caption (text only, no time limit)', secured: true,
  responses: { '200': { description: 'Updated post' } },
});