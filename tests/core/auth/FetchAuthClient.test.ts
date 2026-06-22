import { describe, it, expect, vi, afterEach } from 'vitest';

import { FetchAuthClient, parseCookieExpiry } from '../../../src/core/auth/FetchAuthClient.js';

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

describe('FetchAuthClient.isSessionAlive', () => {
  afterEach(() => vi.restoreAllMocks());

  it('200 → session vivante', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    expect(await new FetchAuthClient().isSessionAlive('https://x.example.com/', 'sid')).toBe(true);
  });

  it('statut non-200 → session morte', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
    expect(await new FetchAuthClient().isSessionAlive('https://x.example.com/', 'sid')).toBe(false);
  });

  it("sonde l'endpoint userinfo avec le seul cookie oneSessionId", async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    await new FetchAuthClient().isSessionAlive('https://x.example.com/', 'abc');
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe('https://x.example.com/auth/oauth2/userinfo');
    expect((init?.headers as Record<string, string>).cookie).toBe('oneSessionId=abc');
  });
});
