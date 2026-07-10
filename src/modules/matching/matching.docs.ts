import { registerEndpoint } from '../../docs/openapi.js';

registerEndpoint({
  method: 'get', path: '/matching/discover', tag: 'Matching',
  summary: 'Scored people-discovery (?limit=, max 50)', secured: true,
  responses: {
    '200': {
      description: 'Ranked matches with human-readable reasons',
      example: {
        data: [{
          username: 'maya_s', displayName: 'Maya', avatarUrl: null, blobTint: 'blush',
          score: 71, reasons: ['Birthday twin', '2 shared interests', 'Same city'], sharedInterests: 2,
        }],
      },
    },
  },
});