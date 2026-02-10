import { saveAppConfig } from '../../config/appConfig';
import type { AppConfig } from '../../config/config.types';

/**
 * Sauvegarde la configuration globale app.config.json.
 */
export async function saveAppConfigStep(config: AppConfig): Promise<void> {
  await saveAppConfig(config);
}
