import { registerEndpoint } from '../../docs/openapi.js';
import { preferencesSchema, subscribeSchema, unsubscribeSchema } from './notifications.schemas.js';

// ---- Inbox (N2) ----

registerEndpoint({
  method: 'get', path: '/notifications', tag: 'Notifications',
  summary: 'My notification inbox, newest first (cursor pagination)', secured: true,
  responses: {
    '200': {
      description: 'Notification cards with actor profiles',
      example: {
        data: [{ id: 'ckx…', type: 'FRIEND_REQUEST', title: 'Maya sent you a friend request', readAt: null, entityType: 'friendRequest', entityId: 'ckx…' }],
        meta: { cursor: 'ckx…', hasMore: false },
      },
    },
  },
});
registerEndpoint({
  method: 'get', path: '/notifications/unread-count', tag: 'Notifications',
  summary: 'Unread notification count (the badge number)', secured: true,
  responses: { '200': { description: 'The count', example: { data: { count: 3 } } } },
});
registerEndpoint({
  method: 'post', path: '/notifications/{notificationId}/read', tag: 'Notifications',
  summary: 'Mark one notification read', secured: true,
  responses: { '200': { description: 'Marked' }, '404': { description: 'Not yours, missing, or already read' } },
});
registerEndpoint({
  method: 'post', path: '/notifications/read-all', tag: 'Notifications',
  summary: 'Mark all my notifications read', secured: true,
  responses: { '200': { description: 'How many were marked', example: { data: { marked: 7 } } } },
});
registerEndpoint({
  method: 'get', path: '/notifications/preferences', tag: 'Notifications',
  summary: 'My notification preferences (defaults if never set)', secured: true,
  responses: { '200': { description: 'The six preference booleans' } },
});
registerEndpoint({
  method: 'patch', path: '/notifications/preferences', tag: 'Notifications',
  summary: 'Update preferences (send only the fields to change)', secured: true,
  body: preferencesSchema,
  responses: { '200': { description: 'The full updated preferences' } },
});

// ---- Web push (N3) ----

registerEndpoint({
  method: 'get', path: '/notifications/push/public-key', tag: 'Notifications',
  summary: 'VAPID public key for pushManager.subscribe (enabled: false when unconfigured)', secured: true,
  responses: { '200': { description: 'Key + enabled flag', example: { data: { enabled: true, publicKey: 'BN…' } } } },
});
registerEndpoint({
  method: 'post', path: '/notifications/push/subscribe', tag: 'Notifications',
  summary: 'Register a browser push subscription (one row per browser; endpoint-unique upsert)', secured: true,
  body: subscribeSchema,
  responses: { '201': { description: 'Subscribed' } },
});
registerEndpoint({
  method: 'post', path: '/notifications/push/unsubscribe', tag: 'Notifications',
  summary: 'Remove a push subscription by endpoint', secured: true,
  body: unsubscribeSchema,
  responses: { '200': { description: 'Unsubscribed' } },
});