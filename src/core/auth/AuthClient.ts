/**
 * Contrat pour un client d'authentification (récupération des cookies de session).
 */

export interface AuthCredentials {
  login: string;
  password: string;
}

export interface AuthCookies {
  xsrfToken: string;
  sessionId: string;
  /** ms epoch — expiration estimée de la session (Max-Age/Expires du cookie) ; absent si inconnu. */
  expiresAt?: number;
}

export interface IAuthClient {
  loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies>;
  /**
   * Indique si une session est encore vivante. Sonder l'endpoint maintient aussi
   * la session active (timeout d'inactivité glissant côté serveur).
   */
  isSessionAlive(envUrl: string, sessionId: string): Promise<boolean>;
}
