import { describe, it, expect } from 'vitest';
import { ageOn, signupSchema } from './auth.schemas.js';
import { computeAgeBracket } from './auth.service.js';

describe('ageOn (injected clock — no flaky date math)', () => {
  const now = new Date('2026-07-14T12:00:00Z');

  it('counts a birthday that already happened this year', () => {
    expect(ageOn(now, new Date('2000-05-14T00:00:00Z'))).toBe(26);
  });
  it('does not count a birthday still ahead this year', () => {
    expect(ageOn(now, new Date('2000-11-30T00:00:00Z'))).toBe(25);
  });
  it('turns the age ON the birthday itself', () => {
    expect(ageOn(now, new Date('2000-07-14T00:00:00Z'))).toBe(26);
  });
  it('handles the day before the birthday', () => {
    expect(ageOn(now, new Date('2000-07-15T00:00:00Z'))).toBe(25);
  });
});

describe('computeAgeBracket', () => {
  it.each([
    [13, null], [17, null],       // minors: no bracket, by design
    [18, '18-25'], [25, '18-25'],
    [26, '26-35'], [35, '26-35'],
    [36, '36-45'], [45, '36-45'],
    [46, '46-60'], [60, '46-60'],
    [61, '60+'], [99, '60+'],
  ])('age %i → bracket %s', (age, bracket) => {
    expect(computeAgeBracket(age)).toBe(bracket);
  });
});

describe('signupSchema birthday validation', () => {
  const base = { fullName: 'Test User', email: 'test@example.com', gender: 'MALE' as const, password: 'StrongPass91' };

  it('rejects dates that do not exist (the Feb-31 silent-rollover trap)', () => {
    const result = signupSchema.safeParse({ ...base, birthDate: '2001-02-31' });
    expect(result.success).toBe(false);
  });
  it('rejects under-13', () => {
    const thisYear = new Date().getUTCFullYear();
    const result = signupSchema.safeParse({ ...base, birthDate: `${thisYear - 10}-01-01` });
    expect(result.success).toBe(false);
  });
  it('normalizes email case and whitespace', () => {
    const result = signupSchema.safeParse({ ...base, email: '  DAN@Example.COM ', birthDate: '2000-05-14' });
    expect(result.success && result.data.email).toBe('dan@example.com');
  });
});