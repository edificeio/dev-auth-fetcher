import { loadAppConfig } from '../../config/appConfig.js';
import { discoverApps } from '../../core/apps/AppDiscovery.js';
import { logger } from '../../utils/logger.js';

export async function runListAppsCommand(): Promise<void> {
  const config = await loadAppConfig();
  if (!config?.appsRoot) {
    logger.error(
      "La configuration n'est pas initialisée. Exécutez d'abord : dev-auth-fetcher onboard"
    );
    return;
  }

  const apps = await discoverApps(config.appsRoot);
  if (apps.length === 0) {
    logger.warn(`Aucune application avec frontend trouvée dans ${config.appsRoot}`);
    return;
  }

  logger.info(`Applications trouvées (${apps.length}) :`);
  for (const app of apps) {
    console.log(`  - ${app.name}  ${app.envPath}`);
  }
}
