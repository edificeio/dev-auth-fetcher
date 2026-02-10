import { generateDefaultEnvironmentConfigs } from '../../config/envConfigs';

/**
 * Génère les fichiers config/environments/*.json par défaut.
 */
export async function generateEnvConfigsStep(): Promise<void> {
  await generateDefaultEnvironmentConfigs();
}
