import * as fs from 'fs/promises';
import * as path from 'path';

import { AppConfigError } from '../utils/errors.js';
import { getAppConfigPath, getLegacyAppConfigPath, getUserDataDir } from '../utils/paths.js';

import type { AppConfig } from './config.types.js';

const DEFAULT_APP_CONFIG: AppConfig = {
  appsRoot: '',
  defaultEnvironment: 'recette-ode1',
};

/** Parse et valide un fichier de config ; lève sur JSON/appsRoot invalide, null si absent. */
async function readConfigFile(filePath: string): Promise<AppConfig | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as AppConfig;
    if (!data.appsRoot || typeof data.appsRoot !== 'string') {
      throw new AppConfigError('appsRoot manquant ou invalide dans la config');
    }
    return { ...DEFAULT_APP_CONFIG, ...data };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') return null;
    if (err instanceof AppConfigError) throw err;
    throw new AppConfigError(
      `Impossible de charger la config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Charge la config utilisateur (~/.dev-auth-fetcher/config.json). Retourne null si absente.
 * Migre une fois l'ancien fichier versionné (config/app.config.json) s'il existe encore.
 */
export async function loadAppConfig(): Promise<AppConfig | null> {
  const current = await readConfigFile(getAppConfigPath());
  if (current) return current;

  const legacy = await readConfigFile(getLegacyAppConfigPath());
  if (legacy) {
    await saveAppConfig(legacy);
    return legacy;
  }
  return null;
}

/**
 * Sauvegarde la configuration globale dans le dossier de données utilisateur.
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(getUserDataDir(), { recursive: true });
  await fs.writeFile(getAppConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Retourne le chemin racine des applications (depuis la config).
 */
export async function getAppsRoot(): Promise<string | null> {
  const config = await loadAppConfig();
  return config?.appsRoot ?? null;
}

/**
 * Définit le chemin racine des applications et sauvegarde.
 */
export async function setAppsRoot(appsRoot: string): Promise<void> {
  const config = (await loadAppConfig()) ?? { ...DEFAULT_APP_CONFIG };
  config.appsRoot = path.resolve(appsRoot);
  await saveAppConfig(config);
}

/**
 * Retourne l'id de l'environnement par défaut.
 */
export async function getDefaultEnvironmentId(): Promise<string> {
  const config = await loadAppConfig();
  return config?.defaultEnvironment ?? DEFAULT_APP_CONFIG.defaultEnvironment;
}

/**
 * Définit l'environnement par défaut.
 */
export async function setDefaultEnvironmentId(envId: string): Promise<void> {
  const config = (await loadAppConfig()) ?? { ...DEFAULT_APP_CONFIG };
  config.defaultEnvironment = envId;
  await saveAppConfig(config);
}

/**
 * Crée le fichier app.config.json avec des valeurs par défaut si le fichier n'existe pas.
 */
export async function ensureAppConfigExists(): Promise<AppConfig> {
  const config = await loadAppConfig();
  if (config) return config;
  const newConfig: AppConfig = { ...DEFAULT_APP_CONFIG, appsRoot: process.cwd() };
  await saveAppConfig(newConfig);
  return newConfig;
}
