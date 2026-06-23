import { generateDefaultEnvironmentConfigs } from '../../config/envConfigs.js';

/**
 * Génère les fichiers d'environnements par défaut dans ~/.dev-auth-fetcher/environments/.
 */
export async function generateEnvConfigsStep(): Promise<void> {
  await generateDefaultEnvironmentConfigs();
}
