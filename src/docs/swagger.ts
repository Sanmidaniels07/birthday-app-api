import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

/**
 * OpenAPI spec served at /docs.
 * For now the spec is hand-written. From the auth slice onward we generate
 * paths from the same zod schemas used for validation, so the docs
 * physically cannot drift from what the API actually does.
 */
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
  tags: [{ name: 'Health', description: 'Liveness and readiness probes' }],
  paths: {
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