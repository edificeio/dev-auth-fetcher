import * as fs from 'fs/promises';
import * as path from 'path';

import { AppConfigError } from '../utils/errors.js';
import { getAppConfigPath, getConfigDir, getEnvironmentsConfigDir } from '../utils/paths.js';

import type { AppConfig } from './config.types.js';

const DEFAULT_APP_CONFIG: AppConfig = {
  appsRoot: '',
  defaultEnvironment: 'recette-ode1',
  profiles: [],
};

/**
 * Charge le fichier app.config.json. Retourne null si absent.
 */
export async function loadAppConfig(): Promise<AppConfig | null> {
  const configPath = getAppConfigPath();
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const data = JSON.parse(content) as AppConfig;
    if (!data.appsRoot || typeof data.appsRoot !== 'string') {
      throw new AppConfigError('appsRoot manquant ou invalide dans app.config.json');
    }
    return {
      ...DEFAULT_APP_CONFIG,
      ...data,
    };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return null;
    }
    throw new AppConfigError(
      `Impossible de charger app.config.json: ${nodeErr instanceof Error ? nodeErr.message : String(err)}`
    );
  }
}

/**
 * Sauvegarde la configuration globale.
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  const configPath = getAppConfigPath();
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
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
  const dir = getConfigDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(getEnvironmentsConfigDir(), { recursive: true });
  const newConfig: AppConfig = { ...DEFAULT_APP_CONFIG, appsRoot: process.cwd() };
  await saveAppConfig(newConfig);
  return newConfig;
}
