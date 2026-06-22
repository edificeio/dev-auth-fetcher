import { loadAppConfig, setAppsRoot } from '../config/appConfig.js';
import type { AppConfig } from '../config/config.types.js';
import { askRootDirectoryStep } from '../steps/onboarding/AskRootDirectoryStep.js';
import { generateEnvConfigsStep } from '../steps/onboarding/GenerateEnvConfigsStep.js';
import { saveAppConfigStep } from '../steps/onboarding/SaveAppConfigStep.js';
import { selectEnvironmentStep } from '../steps/onboarding/SelectEnvironmentStep.js';
import { logger } from '../utils/logger.js';

/**
 * Orchestration du parcours d'onboarding : root des apps, génération des configs d'environnements, sauvegarde.
 */
export class OnboardingService {
  async run(): Promise<void> {
    const existingConfig = await loadAppConfig();
    const currentRoot = existingConfig?.appsRoot;

    const { appsRoot } = await askRootDirectoryStep(currentRoot);
    await setAppsRoot(appsRoot);
    logger.info(`Racine des applications : ${appsRoot}`);

    const { generateDefaults } = await selectEnvironmentStep();
    if (generateDefaults) {
      await generateEnvConfigsStep();
      logger.success('Fichiers de configuration des environnements créés.');
    }

    const config: AppConfig = (await loadAppConfig()) ?? {
      appsRoot,
      defaultEnvironment: 'recette-ode1',
    };
    await saveAppConfigStep(config);
    logger.success('Configuration enregistrée dans config/app.config.json');
  }
}
