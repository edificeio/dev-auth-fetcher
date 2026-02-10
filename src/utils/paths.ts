import path from 'path';

/**
 * Helpers de chemins cross-platform (MacOS, Linux, Windows).
 * Toujours utiliser path.join / path.resolve au lieu de concaténer avec '/'.
 */

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
 * Retourne le répertoire du fichier de config (racine du projet CLI).
 */
export function getConfigDir(): string {
  return resolvePath(process.cwd(), 'config');
}

/**
 * Retourne le chemin du fichier app.config.json.
 */
export function getAppConfigPath(): string {
  return joinPath(getConfigDir(), 'app.config.json');
}

/**
 * Retourne le répertoire des configs d'environnements.
 */
export function getEnvironmentsConfigDir(): string {
  return joinPath(getConfigDir(), 'environments');
}
