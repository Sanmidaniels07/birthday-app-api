import { registerEndpoint } from '../../docs/openapi.js';
import {
  queueQuerySchema,
  resolveSchema,
  userActionSchema,
  userSearchQuerySchema,
} from './admin.schemas.js';

// ---- The moderation queue (AD2) ----

registerEndpoint({
  method: 'get', path: '/admin/reports', tag: 'Admin',
  summary: 'Moderation queue, OLDEST first (filters: ?status=, ?targetType=, ?reportedUsername=)',
  secured: true,
  responses: {
    '200': { description: 'Report cards with reporter and reported-user profiles' },
    '403': { description: 'Not staff' },
  },
});
registerEndpoint({
  method: 'get', path: '/admin/reports/{reportId}', tag: 'Admin',
  summary: 'Report detail: content snapshot (survives author deletion) + priorReports count',
  secured: true,
  responses: { '200': { description: 'Report, evidence, pattern signal' }, '404': { description: 'No such report' } },
});
registerEndpoint({
  method: 'post', path: '/admin/reports/{reportId}/take', tag: 'Admin',
  summary: 'Claim an OPEN report for review (race-safe)', secured: true,
  responses: { '200': { description: 'Taken' }, '409': { description: 'Not open — someone beat you to it' } },
});
registerEndpoint({
  method: 'post', path: '/admin/reports/{reportId}/resolve', tag: 'Admin',
  summary: 'Resolve with a mandatory audit note (min 10 chars)', secured: true,
  body: resolveSchema,
  responses: { '200': { description: 'RESOLVED' }, '409': { description: 'Already closed' } },
});
registerEndpoint({
  method: 'post', path: '/admin/reports/{reportId}/dismiss', tag: 'Admin',
  summary: 'Dismiss with a mandatory audit note', secured: true,
  body: resolveSchema,
  responses: { '200': { description: 'DISMISSED' }, '409': { description: 'Already closed' } },
});

// ---- Enforcement (AD2 — ADMIN only) ----

registerEndpoint({
  method: 'post', path: '/admin/users/{username}/suspend', tag: 'Admin',
  summary: 'Suspend a user: sessions revoked, sockets disconnected (ADMIN only)', secured: true,
  body: userActionSchema,
  responses: {
    '200': { description: 'SUSPENDED' },
    '400': { description: 'Self or staff target' },
    '403': { description: 'Requires ADMIN' },
    '409': { description: 'Already in that status' },
  },
});
registerEndpoint({
  method: 'post', path: '/admin/users/{username}/ban', tag: 'Admin',
  summary: 'Ban a user (same session-kill chain as suspend; ADMIN only)', secured: true,
  body: userActionSchema,
  responses: {
    '200': { description: 'BANNED' },
    '400': { description: 'Self or staff target' },
    '403': { description: 'Requires ADMIN' },
    '409': { description: 'Already in that status' },
  },
});
registerEndpoint({
  method: 'post', path: '/admin/users/{username}/reactivate', tag: 'Admin',
  summary: 'Restore a suspended/banned user to ACTIVE (ADMIN only)', secured: true,
  body: userActionSchema,
  responses: { '200': { description: 'ACTIVE' }, '403': { description: 'Requires ADMIN' }, '409': { description: 'Already active' } },
});
registerEndpoint({
  method: 'post', path: '/admin/content/takedown', tag: 'Admin',
  summary: 'Soft-remove a post, comment, or message (ADMIN only)', secured: true,
  responses: {
    '200': { description: 'Removed' },
    '403': { description: 'Requires ADMIN' },
    '404': { description: 'Missing or already removed' },
  },
});

// ---- User management + stats (AD3) ----

registerEndpoint({
  method: 'get', path: '/admin/users', tag: 'Admin',
  summary: 'Staff user search — sees private, unverified, suspended, banned (?q=, ?status=)',
  secured: true,
  body: undefined,
  responses: { '200': { description: 'User rows with account state' } },
});
registerEndpoint({
  method: 'get', path: '/admin/users/{username}', tag: 'Admin',
  summary: 'User dossier: full account + activity counts (posts, reports against/filed, friends)',
  secured: true,
  responses: { '200': { description: 'The dossier' }, '404': { description: 'No such user' } },
});
registerEndpoint({
  method: 'get', path: '/admin/stats', tag: 'Admin',
  summary: 'Platform stats: users (total/verified/new/active), content, open reports', secured: true,
  responses: { '200': { description: 'The numbers' } },
});

// ---- Job triggers (AD3 — ADMIN only) ----

registerEndpoint({
  method: 'post', path: '/admin/jobs/birthday-sweep', tag: 'Admin',
  summary: 'Manually run the birthday notification sweep (idempotent; ADMIN only)', secured: true,
  responses: { '200': { description: 'Counts: { today, upcoming }' }, '403': { description: 'Requires ADMIN' } },
});
registerEndpoint({
  method: 'post', path: '/admin/jobs/recompute-brackets', tag: 'Admin',
  summary: 'Manually run the age-bracket recompute (idempotent; ADMIN only)', secured: true,
  responses: { '200': { description: 'Counts: { checked, changed }' }, '403': { description: 'Requires ADMIN' } },
});