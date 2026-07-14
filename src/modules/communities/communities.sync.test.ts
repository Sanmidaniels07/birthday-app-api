import { describe, it, expect } from 'vitest';
import { targetCommunitySpecs } from './communities.sync.js';

describe('targetCommunitySpecs', () => {
  it('adults target three communities with the right identities', () => {
    const specs = targetCommunitySpecs({ birthMonth: 5, birthDay: 14, ageBracket: '26-35' });
    expect(specs).toHaveLength(3);
    expect(specs[0]).toMatchObject({ type: 'BIRTHDAY', month: 5, day: 14, name: 'May 14 Club' });
    expect(specs[1]).toMatchObject({ type: 'BIRTH_MONTH', month: 5, day: null, name: 'May Babies' });
    expect(specs[2]).toMatchObject({ type: 'AGE_BRACKET', bracket: '26-35' });
  });
  it('minors (null bracket) target only two — no age circle', () => {
    const specs = targetCommunitySpecs({ birthMonth: 12, birthDay: 25, ageBracket: null });
    expect(specs).toHaveLength(2);
    expect(specs.every((s) => s.type !== 'AGE_BRACKET')).toBe(true);
  });
});