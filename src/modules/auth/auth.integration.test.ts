import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';

const app = createApp();
const stamp = Date.now();
const email = `itest-${stamp}@example.com`;
const password = 'IntegrationPass91';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `itest-${stamp}` } } });
  await prisma.$disconnect();
});

describe('auth lifecycle', () => {
  it('signs up → 202, enumeration-safe shape', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      fullName: 'Integration Test', email, birthDate: '2000-05-14', gender: 'MALE', password,
    });
    expect(res.status).toBe(202);
    expect(res.body.data.email).toBe(email);
  });

  it('refuses login before verification with 403, not 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(403);
  });

  it('verifies with the real OTP (read from the DB — the test IS the backend)', async () => {
    // We can't read the email, but we can prove the flow: fetch the OTP
    // row's existence, then simulate the code path by consuming a known
    // code — so instead we overwrite the hash with a known code's hash.
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const { hashOtp } = await import('./auth.crypto.js');
    await prisma.otpCode.updateMany({
      where: { userId: user!.id, purpose: 'EMAIL_VERIFY' },
      data: { codeHash: hashOtp('123456') },
    });
    const res = await request(app).post('/api/v1/auth/verify-email').send({ email, code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.data.verified).toBe(true);
  });

  it('logs in → access token + refresh cookie, no refresh token in body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('bday_refresh');
    expect(res.headers['set-cookie']?.[0]).toContain('bday_refresh');
    expect(res.headers['set-cookie']?.[0]).toContain('HttpOnly');
  });

  it('wrong password and unknown email are indistinguishable', async () => {
    const wrong = await request(app).post('/api/v1/auth/login').send({ email, password: 'nope-nope-1A' });
    const ghost = await request(app).post('/api/v1/auth/login').send({ email: `ghost-${stamp}@example.com`, password });
    expect(wrong.status).toBe(401);
    expect(ghost.status).toBe(401);
    expect(wrong.body.error.message).toBe(ghost.body.error.message); // the anti-oracle, asserted
  });

  it('garbage bearer token → 401 on /me', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });
});