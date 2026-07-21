import { registerEndpoint } from "../../docs/openapi.js";

registerEndpoint({
  method: 'post', path: '/stories/media/sign', tag: 'Stories',
  summary: 'Get a signed upload grant for a story image or video', secured: true,
  responses: { '200': { description: 'Signed Cloudinary upload params' } },
});

registerEndpoint({
  method: 'post', path: '/stories', tag: 'Stories',
  summary: 'Post a new story (expires in 24h)', secured: true,
  responses: { '201': { description: 'The created story' } },
});

registerEndpoint({
  method: 'get', path: '/stories', tag: 'Stories',
  summary: 'Active stories, grouped by author, newest first', secured: true,
  responses: { '200': { description: 'Grouped story feed' } },
});

registerEndpoint({
  method: 'post', path: '/stories/{id}/view', tag: 'Stories',
  summary: 'Mark a story as viewed (idempotent)', secured: true,
  responses: { '204': { description: 'Viewed' } },
});

registerEndpoint({
  method: 'post', path: '/stories/{id}/react', tag: 'Stories',
  summary: 'Toggle an emoji reaction on a story', secured: true,
  responses: { '200': { description: 'Reaction state' } },
});

registerEndpoint({
  method: 'delete', path: '/stories/{id}', tag: 'Stories',
  summary: 'Delete my own story early', secured: true,
  responses: { '204': { description: 'Deleted' } },
});