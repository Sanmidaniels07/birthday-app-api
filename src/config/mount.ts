import type { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { profilesRouter } from '../modules/profiles/profiles.routes.js';
import { communitiesRouter } from '../modules/communities/communities.routes.js';
import { matchingRouter } from '../modules/matching/matching.routes.js';
import { socialRouter } from '../modules/social/social.routes.js';
import { feedRouter } from '../modules/feed/feed.routes.js';
import { chatRouter } from '../modules/chat/chat.routes.js';
import { callsRouter } from '../modules/calls/calls.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { reportsRouter } from '../modules/reports/reports.routes.js';
import { adminRouter } from '../modules/admin/admin.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { storiesRouter } from '../modules/stories/stories.routes.js';

/**
 * THE mount registry. app.ts mounts from this list; the wiring
 * assertion audits against it. One list, two consumers, zero drift.
 * Adding a module = one entry here (forgetting = boot crash).
 */
export const MOUNTS: Array<{ path: string; router: Router; module: string }> = [
  { path: '/health', router: healthRouter, module: 'health' },
  { path: '/auth', router: authRouter, module: 'auth' },
  { path: '/profiles', router: profilesRouter, module: 'profiles' },
  { path: '/communities', router: communitiesRouter, module: 'communities' },
  { path: '/matching', router: matchingRouter, module: 'matching' },
  { path: '/social', router: socialRouter, module: 'social' },
  { path: '/feed', router: feedRouter, module: 'feed' },
  { path: '/chat', router: chatRouter, module: 'chat' },
  { path: '/calls', router: callsRouter, module: 'calls' },
  { path: '/notifications', router: notificationsRouter, module: 'notifications' },
  { path: '/reports', router: reportsRouter, module: 'reports' },
  { path: '/admin', router: adminRouter, module: 'admin' },
  { path: '/stories', router: storiesRouter, module: 'stories' },
];