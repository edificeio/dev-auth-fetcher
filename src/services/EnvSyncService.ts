import inquirer from 'inquirer';
import ora from 'ora';

import { loadAppConfig } from '../config/appConfig.js';
import type { EnvironmentConfig } from '../config/config.types.js';
import {
  getProfilesForEnvironment,
  addOrUpdateProfileForEnvironment,
  getLastConnection,
  setLastConnection,
} from '../config/credentialsStore.js';
import { listEnvironments, getEnvironmentById } from '../config/envConfigs.js';
import type { AuthCredentials } from '../core/auth/AuthClient.js';
import { FetchAuthClient } from '../core/auth/FetchAuthClient.js';
import { updateAppsEnv } from '../core/env/EnvManager.js';
import { confirmAndRunStep } from '../steps/connect/ConfirmAndRunStep.js';
import { selectAppsStep } from '../steps/connect/SelectAppsStep.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger();

const CHOICE_NEW_CREDENTIALS = '__new__';

export interface ConnectOptions {
  env?: string;
  app?: string;
  all?: boolean;
  /** Liste de noms d'apps (utilisée par reconnect-last). */
  apps?: string[];
  login?: string;
  /** Si true, ne pas demander de confirmation (reconnect-last entièrement automatique). */
  skipConfirm?: boolean;
}

/**
 * Orchestration de la commande connect : choix de l'env, des apps, identifiant (existant ou nouveau), auth fetch, mise à jour des .env.
 */
export class EnvSyncService {
  async runInteractive(options: ConnectOptions): Promise<void> {
    const config = await loadAppConfig();
    if (!config?.appsRoot) {
      logger.error(
        "La configuration n'est pas initialisée. Exécutez d'abord : dev-auth-fetcher onboard"
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
        logger.error("Aucun environnement configuré. Exécutez d'abord : dev-auth-fetcher onboard");
        return;
      }

      const last = await getLastConnection();
      const RECONNECT_CHOICE = '__reconnect_last__';
      const envChoices = envs.map((e) => ({ name: `${e.label} (${e.url})`, value: e.id }));
      if (last) {
        const appsDesc =
          last.allApps === true
            ? 'toutes les apps'
            : last.appNames?.length
              ? last.appNames.join(', ')
              : 'apps à choisir';
        const quickReconnectLabel = `🔄 Reconnexion rapide : ${last.envId} / ${last.login} (${appsDesc})`;
        envChoices.unshift({ name: quickReconnectLabel, value: RECONNECT_CHOICE });
      }

      const { selectedEnvId } = await inquirer.prompt<{ selectedEnvId: string }>([
        {
          type: 'list',
          name: 'selectedEnvId',
          message: "Sélectionnez l'environnement :",
          choices: envChoices,
        },
      ]);

      if (selectedEnvId === RECONNECT_CHOICE && last) {
        const hasAppSelection = last.allApps === true || (last.appNames?.length ?? 0) > 0;
        await this.runInteractive({
          env: last.envId,
          login: last.login,
          ...(last.allApps === true
            ? { all: true }
            : last.appNames?.length
              ? { apps: last.appNames }
              : {}),
          skipConfirm: hasAppSelection,
        });
        return;
      }

      envId = selectedEnvId;
      env = (await getEnvironmentById(envId)) ?? null;
    }
    if (!env || !envId) {
      logger.error('Environnement non trouvé.');
      return;
    }

    const { apps, allSelected } = await selectAppsStep(config.appsRoot, {
      app: options.app,
      all: options.all,
      apps: options.apps,
    });
    if (apps.length === 0) {
      logger.warn('Aucune application sélectionnée.');
      return;
    }

    const savedProfiles = await getProfilesForEnvironment(envId);
    let login: string;
    let password: string;
    let role: string | undefined;
    let shouldSaveAfterSuccess = false;

    if (options.login) {
      login = options.login;
      const existing = savedProfiles.find((p) => p.login === login);
      if (existing) {
        password = existing.password;
        role = existing.role;
      } else {
        const result = await inquirer.prompt<{ password: string; role?: string }>([
          { type: 'password', name: 'password', message: 'Mot de passe :' },
          {
            type: 'input',
            name: 'role',
            message: 'Rôle (optionnel, ex: Enseignant, Élève, Admin) :',
            default: '',
          },
        ]);
        password = result.password;
        role = result.role?.trim() || undefined;
        shouldSaveAfterSuccess = true;
      }
    } else if (savedProfiles.length > 0) {
      const choices = [
        ...savedProfiles.map((p) => ({
          name: p.role ? `${p.login} (${p.role})` : p.login,
          value: p.login,
        })),
        { name: '➕ Nouvel identifiant', value: CHOICE_NEW_CREDENTIALS },
      ];
      const { selectedLogin } = await inquirer.prompt<{ selectedLogin: string }>([
        {
          type: 'list',
          name: 'selectedLogin',
          message: 'Choisissez un identifiant ou saisissez un nouveau :',
          choices,
        },
      ]);
      if (selectedLogin === CHOICE_NEW_CREDENTIALS) {
        const creds = await inquirer.prompt<AuthCredentials & { role?: string }>([
          { type: 'input', name: 'login', message: 'Login :' },
          { type: 'password', name: 'password', message: 'Mot de passe :' },
          {
            type: 'input',
            name: 'role',
            message: 'Rôle (optionnel, ex: Enseignant, Élève, Admin) :',
            default: '',
          },
        ]);
        login = creds.login;
        password = creds.password;
        role = creds.role?.trim() || undefined;
        shouldSaveAfterSuccess = true;
      } else {
        const profile = savedProfiles.find((p) => p.login === selectedLogin)!;
        login = profile.login;
        password = profile.password;
        role = profile.role;
      }
    } else {
      const creds = await inquirer.prompt<AuthCredentials & { role?: string }>([
        { type: 'input', name: 'login', message: 'Login :' },
        { type: 'password', name: 'password', message: 'Mot de passe :' },
        {
          type: 'input',
          name: 'role',
          message: 'Rôle (optionnel, ex: Enseignant, Élève, Admin) :',
          default: '',
        },
      ]);
      login = creds.login;
      password = creds.password;
      role = creds.role?.trim() || undefined;
      shouldSaveAfterSuccess = true;
    }

    if (!options.skipConfirm) {
      const confirmed = await confirmAndRunStep({
        environment: env,
        apps,
        login,
      });
      if (!confirmed) {
        logger.info('Annulé.');
        return;
      }
    }

    const spinner = ora('Connexion en cours…').start();
    const authClient = new FetchAuthClient();
    try {
      const cookies = await authClient.loginAndGetCookies(env.url, { login, password });
      spinner.succeed('Connexion réussie.');

      if (shouldSaveAfterSuccess) {
        await addOrUpdateProfileForEnvironment(envId, { login, password, role });
        logger.info('Identifiant enregistré pour cet environnement.');
      }

      // Mémoriser la dernière connexion (envId, login, apps) pour reconnect-last.
      await setLastConnection(envId, login, {
        allApps: allSelected,
        appNames: apps.map((a) => a.name),
      });

      const updateSpinner = ora('Mise à jour des fichiers .env…').start();
      await updateAppsEnv(
        apps.map((a) => ({ envPath: a.envPath })),
        {
          xsrfToken: cookies.xsrfToken,
          sessionId: cookies.sessionId,
          recetteUrl: env.url,
        },
        { login }
      );
      updateSpinner.succeed(`${apps.length} fichier(s) .env mis à jour.`);
    } catch (err) {
      spinner.fail('Échec de la connexion.');
      logger.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
