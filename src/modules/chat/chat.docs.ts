import { registerEndpoint } from '../../docs/openapi.js';
import { createDmSchema, createGroupSchema } from './chat.schemas.js';
import { sendMessageSchema, editMessageSchema,addMemberSchema } from './chat.schemas.js';



registerEndpoint({
  method: 'get', path: '/chat/conversations', tag: 'Chat',
  summary: 'My inbox: conversations newest-activity-first, with latest message preview', secured: true,
  responses: { '200': { description: 'Conversations (cursor pagination)' } },
});
registerEndpoint({
  method: 'post', path: '/chat/conversations/dm', tag: 'Chat',
  summary: 'Open (or return existing) DM with a friend — one thread per pair', secured: true,
  body: createDmSchema,
  responses: {
    '200': { description: 'Existing thread' },
    '201': { description: 'New thread' },
    '404': { description: 'No such user / not your friend' },
  },
});
registerEndpoint({
  method: 'post', path: '/chat/conversations/group', tag: 'Chat',
  summary: 'Create a group (members must be your friends; you become admin)', secured: true,
  body: createGroupSchema,
  responses: { '201': { description: 'The group' }, '404': { description: 'A member is not your friend' } },
});
registerEndpoint({
  method: 'get', path: '/chat/conversations/{conversationId}', tag: 'Chat',
  summary: 'Conversation detail (members only)', secured: true,
  responses: { '200': { description: 'The conversation' }, '404': { description: 'Not found or not a member' } },
});


registerEndpoint({
  method: 'post', path: '/chat/conversations/{conversationId}/messages', tag: 'Chat',
  summary: 'Send a text message (broadcasts message:new to the room)', secured: true,
  body: sendMessageSchema,
  responses: {
    '201': { description: 'The message card' },
    '404': { description: 'Not a member, or replyToId not in this conversation' },
    '429': { description: 'Rate limited' },
  },
});
registerEndpoint({
  method: 'get', path: '/chat/conversations/{conversationId}/messages', tag: 'Chat',
  summary: 'History, newest first; deleted messages ship as placeholders (cursor pagination)', secured: true,
  responses: { '200': { description: 'Message cards' }, '404': { description: 'Not a member' } },
});
registerEndpoint({
  method: 'patch', path: '/chat/conversations/{conversationId}/messages/{messageId}', tag: 'Chat',
  summary: 'Edit my text message (15-minute window; broadcasts message:edited)', secured: true,
  body: editMessageSchema,
  responses: {
    '200': { description: 'Updated card with editedAt' },
    '400': { description: 'Non-text, or window expired' },
    '404': { description: 'Missing, deleted, or not yours' },
  },
});
registerEndpoint({
  method: 'delete', path: '/chat/conversations/{conversationId}/messages/{messageId}', tag: 'Chat',
  summary: 'Delete my message (placeholder remains; broadcasts message:deleted)', secured: true,
  responses: { '200': { description: 'Deleted' }, '404': { description: 'Missing, deleted, or not yours' } },
});

registerEndpoint({
  method: 'post', path: '/chat/conversations/{conversationId}/read', tag: 'Chat',
  summary: 'Mark conversation read up to now (broadcasts conversation:read)', secured: true,
  responses: { '200': { description: 'My new lastReadAt' }, '404': { description: 'Not a member' } },
});
registerEndpoint({
  method: 'get', path: '/chat/unread', tag: 'Chat',
  summary: 'Unread message counts: total + per conversation (own messages excluded)', secured: true,
  responses: {
    '200': { description: 'Counts', example: { data: { total: 3, byConversation: { 'ckx…': 3 } } } },
  },
});

registerEndpoint({
  method: 'post', path: '/chat/conversations/{conversationId}/media/sign', tag: 'Chat',
  summary: 'Signed upload grant for chat media (?kind=image|voice_note|audio|video)', secured: true,
  responses: {
    '200': { description: 'Upload parameters + signature (uploadUrl varies by kind)' },
    '404': { description: 'Not a member' },
    '429': { description: 'Rate limited' },
  },
});


registerEndpoint({
  method: 'post', path: '/chat/conversations/{conversationId}/members', tag: 'Chat',
  summary: 'Add a member to a group (admin only; must be YOUR friend; writes a SYSTEM message)',
  secured: true,
  body: addMemberSchema,
  responses: {
    '201': { description: 'Added (or revived with fresh unread state)' },
    '403': { description: 'Not a group admin' },
    '404': { description: 'Not a group you belong to, or user is not your friend' },
    '409': { description: 'Already a member' },
  },
});
registerEndpoint({
  method: 'delete', path: '/chat/conversations/{conversationId}/members/{username}', tag: 'Chat',
  summary: 'Remove a member (admin only; their live sockets leave the room instantly)',
  secured: true,
  responses: {
    '200': { description: 'Removed' },
    '400': { description: 'Self-removal — use leave' },
    '403': { description: 'Not a group admin' },
    '404': { description: 'No such group or member' },
  },
});
registerEndpoint({
  method: 'post', path: '/chat/conversations/{conversationId}/leave', tag: 'Chat',
  summary: 'Leave a group (last admin leaving promotes the longest-standing member)',
  secured: true,
  responses: {
    '200': { description: 'Left' },
    '404': { description: 'Not a group you belong to' },
  },
});