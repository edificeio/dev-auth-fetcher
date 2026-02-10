import { chromium } from 'playwright';
import type { IAuthClient, AuthCredentials, AuthCookies } from './AuthClient';
import { AuthError } from '../../utils/errors';

const LOGIN_TIMEOUT_MS = 30_000;
const AVATAR_SELECTOR_TIMEOUT_MS = 10_000;

/**
 * Implémentation Playwright : ouvre la page de login, remplit le formulaire, récupère les cookies XSRF-TOKEN et oneSessionId.
 */
export class PlaywrightAuthClient implements IAuthClient {
  async loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(envUrl, { waitUntil: 'networkidle', timeout: LOGIN_TIMEOUT_MS });

      await page.fill('#email', credentials.login);
      await page.fill('#password', credentials.password);
      await page.click('button.flex-magnet-bottom-right');

      try {
        await page.waitForSelector('.avatar', { timeout: AVATAR_SELECTOR_TIMEOUT_MS });
      } catch {
        // Temps de navigation dépassé, on continue et on vérifie les cookies
      }

      const cookies = await context.cookies();
      const xsrfToken = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '';
      const sessionId = cookies.find((c) => c.name === 'oneSessionId')?.value ?? '';

      if (!xsrfToken || !sessionId) {
        throw new AuthError(
          'Échec de la connexion. Vérifiez les identifiants et réessayez. (Cookies XSRF-TOKEN ou oneSessionId absents.)',
        );
      }

      return { xsrfToken, sessionId };
    } finally {
      await browser.close();
    }
  }
}
