import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/error-handler.js';
import { inboxQuerySchema, notificationIdParam, preferencesSchema, subscribeSchema, unsubscribeSchema } from './notifications.schemas.js';
import * as controller from './notifications.controller.js';
import { requireRole } from '../../middleware/auth.js';
import { recomputeBrackets } from '../../jobs/recompute-brackets.job.js';
import { birthdayNotifications } from '../../jobs/birthday-notifications.job.js';


export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', validate({ query: inboxQuerySchema }), controller.list);
notificationsRouter.get('/unread-count', controller.unread);
notificationsRouter.post('/read-all', controller.markAll);
notificationsRouter.get('/preferences', controller.preferences);
notificationsRouter.patch('/preferences', validate({ body: preferencesSchema }), controller.updatePreferences);
notificationsRouter.post('/:notificationId/read', validate({ params: notificationIdParam }), controller.markRead);

notificationsRouter.get('/push/public-key', controller.vapidKey);
notificationsRouter.post('/push/subscribe', validate({ body: subscribeSchema }), controller.subscribe);
notificationsRouter.post('/push/unsubscribe', validate({ body: unsubscribeSchema }), controller.unsubscribe);


// Manual job triggers — ADMIN only. The admin slice will grow a proper home for these.
notificationsRouter.post('/jobs/birthday-sweep', requireRole('ADMIN'), async (_req, res) => {
  res.json({ data: await birthdayNotifications() });
});
notificationsRouter.post('/jobs/recompute-brackets', requireRole('ADMIN'), async (_req, res) => {
  res.json({ data: await recomputeBrackets() });
});