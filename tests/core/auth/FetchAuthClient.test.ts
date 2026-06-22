import { describe, it, expect } from 'vitest';

import { parseCookieExpiry } from '../../../src/core/auth/FetchAuthClient.js';

describe('parseCookieExpiry', () => {
  const NOW = 1_700_000_000_000;

  it('calcule expiresAt depuis Max-Age (secondes)', () => {
    const header = 'oneSessionId=abc; Path=/; Max-Age=3600; HttpOnly';
    expect(parseCookieExpiry(header, NOW)).toBe(NOW + 3600 * 1000);
  });

  it('retombe sur Expires si Max-Age est absent', () => {
    const header = 'oneSessionId=abc; Path=/; Expires=Wed, 21 Oct 2099 07:28:00 GMT';
    expect(parseCookieExpiry(header, NOW)).toBe(Date.parse('Wed, 21 Oct 2099 07:28:00 GMT'));
  });

  it('privilégie Max-Age sur Expires', () => {
    const header = 'oneSessionId=abc; Max-Age=60; Expires=Wed, 21 Oct 2099 07:28:00 GMT';
    expect(parseCookieExpiry(header, NOW)).toBe(NOW + 60 * 1000);
  });

  it('retourne undefined sans attribut exploitable', () => {
    expect(parseCookieExpiry('oneSessionId=abc; Path=/; HttpOnly', NOW)).toBeUndefined();
  });
});
