import { loadAppConfig } from '../../config/appConfig';
import { discoverApps } from '../../core/apps/AppDiscovery';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export async function runListAppsCommand(): Promise<void> {
  const config = await loadAppConfig();
  if (!config?.appsRoot) {
    logger.error(
      "La configuration n'est pas initialisée. Exécutez d'abord : dev-auth-fetcher onboard",
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
    // eslint-disable-next-line no-console
    console.log(`  - ${app.name}  ${app.envPath}`);
  }
}
