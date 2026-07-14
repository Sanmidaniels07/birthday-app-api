import { registerEndpoint } from '../../docs/openapi.js';
import { createReportSchema } from './reports.schemas.js';

registerEndpoint({
  method: 'post', path: '/reports', tag: 'Reports',
  summary: 'Report a user (by username), post, message, or comment', secured: true,
  body: createReportSchema,
  responses: {
    '201': { description: 'Filed (duplicate: true if you already have an open report on this)', example: { data: { reportId: 'ckx…', duplicate: false } } },
    '400': { description: 'Self-report, or OTHER without details' },
    '404': { description: 'Target not found (or a message you are not party to)' },
    '429': { description: 'Rate limited' },
  },
});
registerEndpoint({
  method: 'get', path: '/reports/mine', tag: 'Reports',
  summary: 'My filed reports with status (no resolution internals)', secured: true,
  responses: { '200': { description: 'My reports, newest first' } },
});