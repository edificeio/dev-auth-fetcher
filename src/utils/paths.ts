import os from 'os';
import path from 'path';

/**
 * Helpers de chemins cross-platform (MacOS, Linux, Windows).
 * Toujours utiliser path.join / path.resolve au lieu de concaténer avec '/'.
 */

/** Nom du dossier de données utilisateur (sous le HOME). */
const DATA_DIR_NAME = '.dev-auth-fetcher';

/**
 * Joint des segments de chemin de manière portable.
 */
export function joinPath(...segments: string[]): string {
  return path.join(...segments);
}

/**
 * Résout un chemin par rapport à une base.
 */
export function resolvePath(base: string, ...segments: string[]): string {
  return path.resolve(base, ...segments);
}

/**
 * Dossier unique des données utilisateur (non versionnées) : config + credentials.
 * Par défaut `~/.dev-auth-fetcher`, surchargeable via la variable DEV_AUTH_FETCHER_HOME.
 */
export function getUserDataDir(): string {
  const override = process.env.DEV_AUTH_FETCHER_HOME?.trim();
  return override || path.join(os.homedir(), DATA_DIR_NAME);
}

/**
 * Chemin du fichier de config utilisateur (appsRoot, defaultEnvironment).
 */
export function getAppConfigPath(): string {
  return path.join(getUserDataDir(), 'config.json');
}

/**
 * Répertoire des credentials utilisateur (un fichier par identité).
 */
export function getCredentialsDir(): string {
  return path.join(getUserDataDir(), 'credentials');
}

/**
 * Répertoire des définitions d'environnements : versionnées et partagées,
 * elles restent dans le repo (`<cwd>/config/environments`).
 */
export function getEnvironmentsConfigDir(): string {
  return resolvePath(process.cwd(), 'config', 'environments');
}

/** Ancien emplacement de la config (pour migration unique). */
export function getLegacyAppConfigPath(): string {
  return resolvePath(process.cwd(), 'config', 'app.config.json');
}

/** Ancien répertoire des credentials (pour migration unique). */
export function getLegacyCredentialsDir(): string {
  return path.join(process.cwd(), DATA_DIR_NAME, 'credentials');
}
