import { AuthError } from '../../utils/errors.js';

import type { IAuthClient, AuthCredentials, AuthCookies } from './AuthClient.js';

/** Délai maximum (ms) d'attente d'une réponse du serveur de recette. */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchAuthClientOptions {
  /** Délai maximum d'attente de la réponse, en millisecondes (défaut : 15 000). */
  timeoutMs?: number;
}

/**
 * Parse une chaîne Set-Cookie pour extraire le nom et la valeur du cookie.
 * Format typique : "name=value; Path=/; HttpOnly; ..."
 */
function parseCookie(setCookieHeader: string): { name: string; value: string } | null {
  const eqIndex = setCookieHeader.indexOf('=');
  if (eqIndex < 0) return null;
  const name = setCookieHeader.slice(0, eqIndex).trim();
  const rest = setCookieHeader.slice(eqIndex + 1);
  const semicolonIndex = rest.indexOf(';');
  const value = (semicolonIndex >= 0 ? rest.slice(0, semicolonIndex) : rest).trim();
  return { name, value };
}

/**
 * Estime l'expiration (ms epoch) d'un cookie depuis ses attributs `Max-Age` (prioritaire,
 * en secondes) ou `Expires` (date HTTP). Retourne undefined si aucun n'est exploitable.
 */
export function parseCookieExpiry(
  setCookieHeader: string,
  now: number = Date.now()
): number | undefined {
  const attributes = setCookieHeader.split(';').slice(1);
  for (const attr of attributes) {
    const [rawKey, ...rawVal] = attr.split('=');
    const key = rawKey.trim().toLowerCase();
    const val = rawVal.join('=').trim();
    if (key === 'max-age') {
      const seconds = Number(val);
      if (Number.isFinite(seconds)) return now + seconds * 1000;
    }
  }
  for (const attr of attributes) {
    const [rawKey, ...rawVal] = attr.split('=');
    if (rawKey.trim().toLowerCase() === 'expires') {
      const ts = Date.parse(rawVal.join('=').trim());
      if (!Number.isNaN(ts)) return ts;
    }
  }
  return undefined;
}

/**
 * Implémentation fetch : POST vers /auth/login, extraction des cookies depuis Set-Cookie.
 *
 * Fragilité connue : dépend de la forme actuelle du flux d'auth ENT (endpoint
 * `/auth/login`, body `x-www-form-urlencoded`, cookies `authenticated` / `oneSessionId`
 * / `XSRF-TOKEN`). Tout changement côté serveur (2FA, redirection, renommage de cookie)
 * casse la connexion — d'où les messages d'erreur explicites ci-dessous.
 */
export class FetchAuthClient implements IAuthClient {
  private readonly timeoutMs: number;

  constructor(options: FetchAuthClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies> {
    const baseUrl = envUrl.replace(/\/$/, '');
    const loginUrl = `${baseUrl}/auth/login`;

    const body = new URLSearchParams({
      email: credentials.login,
      password: credentials.password,
      callBack: '',
      details: '',
    }).toString();

    const response = await this.post(loginUrl, body);

    const setCookies = response.headers.getSetCookie();
    const cookieMap = new Map<string, string>();
    let expiresAt: number | undefined;

    for (const header of setCookies) {
      const parsed = parseCookie(header);
      if (parsed) {
        cookieMap.set(parsed.name, parsed.value);
        if (parsed.name === 'oneSessionId') {
          expiresAt = parseCookieExpiry(header);
        }
      }
    }

    const authenticated = cookieMap.get('authenticated');
    if (authenticated !== 'true') {
      throw new AuthError(
        'Échec de la connexion. Vérifiez les identifiants et réessayez. (Cookie authenticated absent ou invalide.)'
      );
    }

    const sessionId = cookieMap.get('oneSessionId') ?? '';
    let xsrfToken = cookieMap.get('XSRF-TOKEN') ?? '';

    if (!xsrfToken || !sessionId) {
      throw new AuthError(
        'Échec de la connexion. Vérifiez les identifiants et réessayez. (Cookies XSRF-TOKEN ou oneSessionId absents.)'
      );
    }

    // Les cookies XSRF sont souvent stockés URL-encodés
    try {
      xsrfToken = decodeURIComponent(xsrfToken);
    } catch {
      // Conserver la valeur brute si le décodage échoue
    }

    return { xsrfToken, sessionId, expiresAt };
  }

  /**
   * POST avec timeout. Convertit les échecs réseau / dépassement de délai en AuthError lisible.
   */
  private async post(loginUrl: string, body: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        referrer: loginUrl,
        redirect: 'manual',
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AuthError(
          `Délai dépassé (${this.timeoutMs} ms) en contactant ${loginUrl}. Le serveur de recette est peut-être indisponible.`
        );
      }
      throw new AuthError(
        `Impossible de contacter ${loginUrl} : ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
