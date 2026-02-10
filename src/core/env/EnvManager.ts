import { readEnvFile, mergeEnv, writeEnvFile } from '../../utils/envFile';
import { VITE_ENV_KEYS } from '../../config/config.types';
import type { EnvironmentConfig } from '../../config/config.types';

export interface EnvPatch {
  xsrfToken: string;
  sessionId: string;
  recetteUrl: string;
}

/**
 * Met à jour le fichier .env d'une application avec les clés VITE_*.
 * Préserve les autres variables existantes.
 */
export async function updateAppEnv(
  envFilePath: string,
  patch: EnvPatch,
  options: { login?: string } = {},
): Promise<void> {
  const existing = await readEnvFile(envFilePath);
  const headerComments: string[] = [];
  if (options.login) {
    headerComments.push(`# Connected as: ${options.login}`);
  }
  headerComments.push(`# Date: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);

  const newValues = {
    ...existing,
    [VITE_ENV_KEYS.XSRF_TOKEN]: patch.xsrfToken,
    [VITE_ENV_KEYS.ONE_SESSION_ID]: patch.sessionId,
    [VITE_ENV_KEYS.RECETTE]: patch.recetteUrl,
  };
  await writeEnvFile(envFilePath, newValues, headerComments);
}

/**
 * Met à jour les .env de plusieurs applications.
 */
export async function updateAppsEnv(
  appEnvPaths: Array<{ envPath: string }>,
  patch: EnvPatch,
  options: { login?: string } = {},
): Promise<void> {
  for (const { envPath } of appEnvPaths) {
    await updateAppEnv(envPath, patch, options);
  }
}
