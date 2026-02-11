import { AuthError } from '../../utils/errors.js';

import type { IAuthClient, AuthCredentials, AuthCookies } from './AuthClient.js';

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
 * Implémentation fetch : POST vers /auth/login, extraction des cookies depuis Set-Cookie.
 */
export class FetchAuthClient implements IAuthClient {
  async loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies> {
    const baseUrl = envUrl.replace(/\/$/, '');
    const loginUrl = `${baseUrl}/auth/login`;

    const body = new URLSearchParams({
      email: credentials.login,
      password: credentials.password,
      callBack: '',
      details: '',
    }).toString();

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      referrer: loginUrl,
      redirect: 'manual',
      body,
    });

    const setCookies = response.headers.getSetCookie();
    const cookieMap = new Map<string, string>();

    for (const header of setCookies) {
      const parsed = parseCookie(header);
      if (parsed) {
        cookieMap.set(parsed.name, parsed.value);
      }
    }

    const authenticated = cookieMap.get('authenticated');
    if (authenticated !== 'true') {
      throw new AuthError(
        'Échec de la connexion. Vérifiez les identifiants et réessayez. (Cookie authenticated absent ou invalide.)'
      );
    }

    let sessionId = cookieMap.get('oneSessionId') ?? '';
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

    return { xsrfToken, sessionId };
  }
}
