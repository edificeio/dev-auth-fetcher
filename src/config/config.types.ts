/**
 * Types pour la configuration globale et les environnements.
 */

export interface AppConfig {
  appsRoot: string;
  defaultEnvironment: string;
  lastUsedProfile?: string;
  profiles?: UserProfile[];
}

export interface UserProfile {
  login: string;
  password: string;
}

export interface EnvironmentConfig {
  id: string;
  label: string;
  url: string;
}

export const VITE_ENV_KEYS = {
  XSRF_TOKEN: 'VITE_XSRF_TOKEN',
  ONE_SESSION_ID: 'VITE_ONE_SESSION_ID',
  RECETTE: 'VITE_RECETTE',
} as const;
