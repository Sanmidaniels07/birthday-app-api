import { registerEndpoint } from '../../docs/openapi.js';
import { signupSchema, verifyEmailSchema, resendOtpSchema, loginSchema } from './auth.schemas.js';

registerEndpoint({
  method: 'post', path: '/auth/signup', tag: 'Auth',
  summary: 'Create an account (sends a 6-digit verification code)',
  body: signupSchema,
  responses: {
    '202': { description: 'Verification code sent', example: { data: { email: 'you@example.com', message: 'We sent a 6-digit verification code to your email.' } } },
    '400': { description: 'Validation failed' },
    '429': { description: 'Rate limited' },
  },
});

registerEndpoint({
  method: 'post', path: '/auth/verify-email', tag: 'Auth',
  summary: 'Verify email with the 6-digit code',
  body: verifyEmailSchema,
  responses: {
    '200': { description: 'Verified', example: { data: { verified: true } } },
    '400': { description: 'Invalid or expired code' },
  },
});

registerEndpoint({
  method: 'post', path: '/auth/resend-otp', tag: 'Auth',
  summary: 'Resend the verification code',
  body: resendOtpSchema,
  responses: { '200': { description: 'Sent (if the address needs one)' }, '429': { description: 'Rate limited' } },
});

registerEndpoint({
  method: 'post', path: '/auth/login', tag: 'Auth',
  summary: 'Log in (sets httpOnly refresh cookie, returns access token)',
  body: loginSchema,
  responses: {
    '200': { description: 'Logged in', example: { data: { accessToken: 'eyJ…', user: { id: 'ckx…', fullName: 'Daniel', email: 'you@example.com', role: 'USER' } } } },
    '401': { description: 'Invalid email or password' },
    '403': { description: 'Email not verified / account not active' },
  },
});

registerEndpoint({
  method: 'post', path: '/auth/refresh', tag: 'Auth',
  summary: 'Rotate refresh token (cookie in, cookie + access token out)',
  responses: { '200': { description: 'New session issued' }, '401': { description: 'Invalid, expired, or reused session' } },
});

registerEndpoint({
  method: 'post', path: '/auth/logout', tag: 'Auth',
  summary: 'Revoke the current session',
  responses: { '204': { description: 'Logged out' } },
});

registerEndpoint({
  method: 'get', path: '/auth/me', tag: 'Auth',
  summary: 'Current authenticated user',
  secured: true,
  responses: { '200': { description: 'The user' }, '401': { description: 'Missing or invalid token' } },
});