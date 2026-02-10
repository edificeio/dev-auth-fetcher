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
}

export interface IAuthClient {
  loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies>;
}
