import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';
import { buildPaths } from './openapi.js';
import '../modules/auth/auth.docs.js';     
import '../modules/profiles/profiles.docs.js'; 
import '../modules/communities/communities.docs.js';
import '../modules/matching/matching.docs.js'
import '../modules/social/social.docs.js';
import '../modules/feed/feed.docs.js';

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Birthday Social API',
    version: '0.1.0',
    description:
      'API for the birthday-based social platform. All responses use the envelope ' +
      '`{ data, meta? }` on success and `{ error: { code, message, details? } }` on failure.',
  },
  servers: [{ url: 'http://localhost:4000/api/v1', description: 'Local' }],
  tags: [
    { name: 'Health', description: 'Liveness and readiness probes' },
    { name: 'Auth', description: 'Signup, verification, sessions' },
    { name: 'Profiles', description: 'Profile setup, privacy, interests, avatar' },
    { name: 'Communities', description: 'Birthday communities: browse, join, the auto-join toggle' },   
    { name: 'Matching', description: 'Birthday-based people discovery' },
    { name: 'Social', description: 'Friends, requests, follows, blocks' },
    { name: 'Feed', description: 'Posts, reactions, comments' },
    { name: 'Chat', description: 'Conversations, messages, typing, receipts' },

  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    ...buildPaths(),

    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: {
          '200': {
            description: 'Process is up',
            content: {
              'application/json': { example: { data: { status: 'ok', uptime: 123 } } },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (checks database connectivity)',
        responses: {
          '200': {
            description: 'Database reachable',
            content: {
              'application/json': { example: { data: { status: 'ready', db: 'connected' } } },
            },
          },
          '500': { description: 'Database unreachable' },
        },
      },
    },
  },
};

export function mountDocs(app: Express) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Birthday API Docs' }));
  app.get('/docs.json', (_req, res) => {
    res.json(openApiSpec);
  });
}