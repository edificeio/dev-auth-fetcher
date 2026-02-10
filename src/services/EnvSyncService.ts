import inquirer from 'inquirer';
import ora from 'ora';
import { loadAppConfig } from '../config/appConfig';
import { listEnvironments, getEnvironmentById } from '../config/envConfigs';
import type { EnvironmentConfig } from '../config/config.types';
import type { AppSummary } from '../core/apps/AppDiscovery';
import { PlaywrightAuthClient } from '../core/auth/PlaywrightAuthClient';
import type { AuthCredentials } from '../core/auth/AuthClient';
import { updateAppsEnv } from '../core/env/EnvManager';
import { selectAppsStep } from '../steps/connect/SelectAppsStep';
import { confirmAndRunStep } from '../steps/connect/ConfirmAndRunStep';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export interface ConnectOptions {
  env?: string;
  app?: string;
  all?: boolean;
  login?: string;
}

/**
 * Orchestration de la commande connect : choix de l'env, des apps, auth Playwright, mise à jour des .env.
 */
export class EnvSyncService {
  async runInteractive(options: ConnectOptions): Promise<void> {
    const config = await loadAppConfig();
    if (!config?.appsRoot) {
      logger.error(
        "La configuration n'est pas initialisée. Exécutez d'abord : dev-auth-fetcher onboard",
      );
      return;
    }

    let envId = options.env;
    let env: EnvironmentConfig | null = null;

    if (envId) {
      env = await getEnvironmentById(envId);
      if (!env) {
        logger.error(`Environnement inconnu : ${envId}`);
        return;
      }
    } else {
      const envs = await listEnvironments();
      if (envs.length === 0) {
        logger.error(
          "Aucun environnement configuré. Exécutez d'abord : dev-auth-fetcher onboard",
        );
        return;
      }
      const { selectedEnvId } = await inquirer.prompt<{ selectedEnvId: string }>([
        {
          type: 'list',
          name: 'selectedEnvId',
          message: "Sélectionnez l'environnement :",
          choices: envs.map((e) => ({ name: `${e.label} (${e.url})`, value: e.id })),
        },
      ]);
      envId = selectedEnvId;
      env = await getEnvironmentById(envId) ?? null;
    }
    if (!env) {
      logger.error('Environnement non trouvé.');
      return;
    }

    const { apps } = await selectAppsStep(config.appsRoot, {
      app: options.app,
      all: options.all,
    });
    if (apps.length === 0) {
      logger.warn('Aucune application sélectionnée.');
      return;
    }

    let login = options.login;
    let password: string;
    if (!login) {
      const creds = await inquirer.prompt<AuthCredentials>([
        { type: 'input', name: 'login', message: 'Login :' },
        { type: 'password', name: 'password', message: 'Mot de passe :' },
      ]);
      login = creds.login;
      password = creds.password;
    } else {
      const result = await inquirer.prompt<{ password: string }>([
        { type: 'password', name: 'password', message: 'Mot de passe :' },
      ]);
      password = result.password;
    }

    const confirmed = await confirmAndRunStep({
      environment: env,
      apps,
      login,
    });
    if (!confirmed) {
      logger.info('Annulé.');
      return;
    }

    const spinner = ora('Connexion en cours…').start();
    const authClient = new PlaywrightAuthClient();
    try {
      const cookies = await authClient.loginAndGetCookies(env.url, { login, password });
      spinner.succeed('Connexion réussie.');

      const updateSpinner = ora('Mise à jour des fichiers .env…').start();
      await updateAppsEnv(
        apps.map((a) => ({ envPath: a.envPath })),
        {
          xsrfToken: cookies.xsrfToken,
          sessionId: cookies.sessionId,
          recetteUrl: env.url,
        },
        { login },
      );
      updateSpinner.succeed(`${apps.length} fichier(s) .env mis à jour.`);
    } catch (err) {
      spinner.fail('Échec de la connexion.');
      logger.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
