import { registerEndpoint } from '../../docs/openapi.js';
import {
  setupProfileSchema,
  updateProfileSchema,
  usernameQuerySchema,
  setInterestsSchema,
  confirmAvatarSchema,
} from './profiles.schemas.js';

registerEndpoint({
  method: 'get', path: '/profiles/username-available', tag: 'Profiles',
  summary: 'Check username availability (query: ?u=)', secured: true,
  responses: { '200': { description: 'Availability', example: { data: { username: 'daniel_o', available: true } } }, '400': { description: 'Invalid or reserved username' } },
});

registerEndpoint({
  method: 'post', path: '/profiles/setup', tag: 'Profiles',
  summary: 'Complete onboarding: claim username, create profile', secured: true,
  body: setupProfileSchema,
  responses: { '201': { description: 'Profile created' }, '409': { description: 'Profile exists / username just taken' } },
});

registerEndpoint({
  method: 'patch', path: '/profiles/me', tag: 'Profiles',
  summary: 'Update profile (null clears a clearable field)', secured: true,
  body: updateProfileSchema,
  responses: { '200': { description: 'Updated profile' }, '404': { description: 'No profile yet — setup first' } },
});

registerEndpoint({
  method: 'get', path: '/profiles/interests', tag: 'Profiles',
  summary: 'The interest catalog', secured: true,
  responses: { '200': { description: 'All interests' } },
});

registerEndpoint({
  method: 'get', path: '/profiles/me/interests', tag: 'Profiles',
  summary: 'My selected interests', secured: true,
  responses: { '200': { description: 'My interests' } },
});

registerEndpoint({
  method: 'put', path: '/profiles/me/interests', tag: 'Profiles',
  summary: 'Replace my interests (send the complete set, 1–15)', secured: true,
  body: setInterestsSchema,
  responses: { '200': { description: 'The new set' }, '400': { description: 'Unknown interest id' } },
});

registerEndpoint({
  method: 'post', path: '/profiles/me/avatar/sign', tag: 'Profiles',
  summary: 'Get a signed direct-upload grant for my avatar', secured: true,
  responses: { '200': { description: 'Upload parameters + signature' }, '429': { description: 'Rate limited' } },
});

registerEndpoint({
  method: 'post', path: '/profiles/me/avatar/confirm', tag: 'Profiles',
  summary: 'Confirm the uploaded avatar public id', secured: true,
  body: confirmAvatarSchema,
  responses: { '200': { description: 'Avatar saved' }, '400': { description: 'Unexpected avatar reference' } },
});

registerEndpoint({
  method: 'get', path: '/profiles/{username}', tag: 'Profiles',
  summary: 'View a profile (privacy-gated; includes relationship context)', secured: true,
  responses: {
    '200': {
      description: 'The visible fields for this viewer, plus relationship (null when own profile)',
      example: {
        data: {
          username: 'maya_s', displayName: 'Maya', bio: null, avatarUrl: null, blobTint: 'blush',
          isOwner: false,
          relationship: { isFriend: false, isFollowing: true, pendingRequest: { requestId: 'ckx…', direction: 'outgoing' } },
          birthMonth: 5, birthDay: 14,
        },
      },
    },
    '404': { description: 'Not found, private, friends-only (non-friend), or blocked' },
  },
});

registerEndpoint({
  method: 'get', path: '/profiles/search', tag: 'Profiles',
  summary: 'Search users by username or display name (?q=, min 2 chars)', secured: true,
  responses: {
    '200': { description: 'Profile cards (private and blocked users excluded)' },
    '400': { description: 'Query too short' },
  },
});

registerEndpoint({
  method: 'get', path: '/profiles/{username}/presence', tag: 'Profiles',
  summary: 'Online status (null = user hides it; lastSeenAt only when offline)', secured: true,
  responses: {
    '200': { description: 'Presence', example: { data: { online: false, lastSeenAt: '2026-07-10T13:00:00Z' } } },
    '404': { description: 'Not found, private, friends-only, or blocked' },
  },
});

registerEndpoint({
  method: 'get', path: '/profiles/me', tag: 'Profiles',
  summary: 'My own full profile (all private fields)', secured: true,
  responses: { '200': { description: 'My profile' }, '404': { description: 'No profile yet' } },
});

registerEndpoint({
  method: 'post', path: '/profiles/me/cover/sign', tag: 'Profiles',
  summary: 'Get a signed direct-upload grant for my cover photo', secured: true,
  responses: { '200': { description: 'Signed Cloudinary upload params' } },
});

registerEndpoint({
  method: 'post', path: '/profiles/me/cover/confirm', tag: 'Profiles',
  summary: 'Confirm the uploaded cover photo public id', secured: true,
  responses: { '200': { description: 'Updated profile' } },
});

registerEndpoint({
  method: 'post',
  path: '/profiles/me/complete-onboarding',
  tag: 'Profiles',
  summary: 'Mark onboarding as finished (call after the last onboarding step)',
  secured: true,
  responses: {
    '200': {
      description: 'Onboarding marked complete',
      example: { data: { onboardingComplete: true } },
    },
    '400': { description: 'Profile not set up yet' },
    '401': { description: 'Not authenticated' },
  },
});