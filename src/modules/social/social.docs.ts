import { registerEndpoint } from '../../docs/openapi.js';
import { sendRequestSchema } from './social.schemas.js';

registerEndpoint({
  method: 'get', path: '/social/friends', tag: 'Social',
  summary: 'My friends', secured: true,
  responses: { '200': { description: 'Friend cards, newest friendships first' } },
});
registerEndpoint({
  method: 'get', path: '/social/requests/incoming', tag: 'Social',
  summary: 'Pending requests sent to me', secured: true,
  responses: { '200': { description: 'Incoming requests' } },
});
registerEndpoint({
  method: 'get', path: '/social/requests/outgoing', tag: 'Social',
  summary: 'Pending requests I sent', secured: true,
  responses: { '200': { description: 'Outgoing requests' } },
});
registerEndpoint({
  method: 'post', path: '/social/requests', tag: 'Social',
  summary: 'Send a friend request by username', secured: true,
  body: sendRequestSchema,
  responses: {
    '201': { description: 'Request created (or revived after a decline)' },
    '404': { description: 'No such user (or blocked)' },
    '409': { description: 'Already friends / already pending / they asked you first' },
  },
});
registerEndpoint({
  method: 'post', path: '/social/requests/{requestId}/accept', tag: 'Social',
  summary: 'Accept (addressee only)', secured: true,
  responses: { '200': { description: 'Accepted' }, '404': { description: 'Not your pending request' } },
});
registerEndpoint({
  method: 'post', path: '/social/requests/{requestId}/decline', tag: 'Social',
  summary: 'Decline (addressee only)', secured: true,
  responses: { '200': { description: 'Declined' }, '404': { description: 'Not your pending request' } },
});
registerEndpoint({
  method: 'post', path: '/social/requests/{requestId}/cancel', tag: 'Social',
  summary: 'Cancel (requester only)', secured: true,
  responses: { '200': { description: 'Cancelled' }, '404': { description: 'Not your pending request' } },
});
registerEndpoint({
  method: 'delete', path: '/social/friends/{username}', tag: 'Social',
  summary: 'Unfriend', secured: true,
  responses: { '200': { description: 'Unfriended' }, '404': { description: 'Not friends' } },
});

registerEndpoint({
  method: 'post', path: '/social/follow/{username}', tag: 'Social',
  summary: 'Follow a user (idempotent)', secured: true,
  responses: { '200': { description: 'Following' }, '404': { description: 'No such user (or blocked)' } },
});
registerEndpoint({
  method: 'delete', path: '/social/follow/{username}', tag: 'Social',
  summary: 'Unfollow (idempotent)', secured: true,
  responses: { '200': { description: 'Not following' } },
});
registerEndpoint({
  method: 'get', path: '/social/following', tag: 'Social',
  summary: 'Who I follow', secured: true,
  responses: { '200': { description: 'Profile cards' } },
});
registerEndpoint({
  method: 'get', path: '/social/followers', tag: 'Social',
  summary: 'Who follows me', secured: true,
  responses: { '200': { description: 'Profile cards' } },
});
registerEndpoint({
  method: 'post', path: '/social/block/{username}', tag: 'Social',
  summary: 'Block (severs friendship and follows, both directions)', secured: true,
  responses: { '200': { description: 'Blocked' }, '404': { description: 'No such user' } },
});
registerEndpoint({
  method: 'delete', path: '/social/block/{username}', tag: 'Social',
  summary: 'Unblock (their block of you, if any, stands)', secured: true,
  responses: { '200': { description: 'Unblocked' } },
});
registerEndpoint({
  method: 'get', path: '/social/blocked', tag: 'Social',
  summary: 'Users I have blocked', secured: true,
  responses: { '200': { description: 'Profile cards' } },
});