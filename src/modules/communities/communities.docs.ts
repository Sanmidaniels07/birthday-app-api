import { registerEndpoint } from '../../docs/openapi.js';
import { browseQuerySchema, membersQuerySchema, autoJoinSchema } from './communities.schemas.js';

registerEndpoint({
  method: 'get', path: '/communities/mine', tag: 'Communities',
  summary: 'My communities (AUTO + MANUAL, with joinMethod)', secured: true,
  responses: { '200': { description: 'My memberships as community cards' } },
});

registerEndpoint({
  method: 'patch', path: '/communities/auto-join', tag: 'Communities',
  summary: 'Flip the auto-join toggle (synchronously re-syncs AUTO memberships)', secured: true,
  body: autoJoinSchema,
  responses: {
    '200': { description: 'New toggle state', example: { data: { autoJoinBirthdayCommunities: false } } },
  },
});

registerEndpoint({
  method: 'get', path: '/communities', tag: 'Communities',
  summary: 'Browse communities (filter ?type=, cursor pagination)', secured: true,
  responses: {
    '200': {
      description: 'Community cards, most members first',
      example: {
        data: [{ id: 'ckx…', type: 'BIRTHDAY', name: 'May 14 Club', memberCount: 2, coverTint: 'butter' }],
        meta: { cursor: 'ckx…', hasMore: true },
      },
    },
  },
});

registerEndpoint({
  method: 'get', path: '/communities/{id}', tag: 'Communities',
  summary: 'Community detail + my membership status (null if not a member)', secured: true,
  responses: { '200': { description: 'The community' }, '404': { description: 'No such community' } },
});

registerEndpoint({
  method: 'post', path: '/communities/{id}/join', tag: 'Communities',
  summary: 'Join manually (upgrades an AUTO membership to MANUAL)', secured: true,
  responses: {
    '200': { description: 'Joined or upgraded', example: { data: { joined: true, upgraded: false } } },
    '404': { description: 'No such community' },
    '409': { description: 'Already a manual member' },
  },
});

registerEndpoint({
  method: 'post', path: '/communities/{id}/leave', tag: 'Communities',
  summary: 'Leave a MANUAL membership (AUTO ones are governed by the toggle)', secured: true,
  responses: {
    '200': { description: 'Left' },
    '404': { description: 'Not a member' },
    '409': { description: 'AUTO membership — use the auto-join setting instead' },
  },
});

registerEndpoint({
  method: 'get', path: '/communities/{id}/members', tag: 'Communities',
  summary: 'Member list (private profiles excluded, cursor pagination)', secured: true,
  responses: { '200': { description: 'Member profile cards' }, '404': { description: 'No such community' } },
});

registerEndpoint({
  method: 'post', path: '/communities/resync', tag: 'Communities',
  summary: 'Re-run my community auto-join reconciliation', secured: true,
  responses: { '200': { description: 'Synced' } },
});