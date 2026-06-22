import inquirer from 'inquirer';
import ora from 'ora';

import { loadAppConfig } from '../config/appConfig.js';
import type { EnvironmentConfig } from '../config/config.types.js';
import {
  addOrUpdateProfileForEnvironment,
  getLastConnection,
  setLastConnection,
  type LastConnection,
} from '../config/credentialsStore.js';
import { listEnvironments, getEnvironmentById } from '../config/envConfigs.js';
import type { IAuthClient } from '../core/auth/AuthClient.js';
import { FetchAuthClient } from '../core/auth/FetchAuthClient.js';
import { updateAppsEnv } from '../core/env/EnvManager.js';
import { confirmAndRunStep } from '../steps/connect/ConfirmAndRunStep.js';
import { resolveCredentialsStep } from '../steps/connect/ResolveCredentialsStep.js';
import { selectAppsStep } from '../steps/connect/SelectAppsStep.js';
import { logger } from '../utils/logger.js';

const RECONNECT_CHOICE = '__reconnect_last__';

export interface ConnectOptions {
  env?: string;
  app?: string;
  all?: boolean;
  /** Liste d'ids ou noms d'apps (ex. app1, entcore/mediacentre). Utilisée par reconnect-last. */
  apps?: string[];
  login?: string;
  /** Si true, ne pas demander de confirmation (reconnect-last entièrement automatique). */
  skipConfirm?: boolean;
}

/** Décrit la sélection d'apps d'une dernière connexion (pour l'affichage). */
export function describeLastConnectionApps(last: LastConnection): string {
  if (last.allApps === true) return 'toutes les apps';
  const ids = last.appIds ?? last.appNames;
  return ids?.length ? ids.join(', ') : 'apps à choisir';
}

/** Construit les options `connect` permettant de rejouer une dernière connexion. */
export function reconnectOptionsFromLast(last: LastConnection): ConnectOptions {
  const appIdsOrNames = last.appIds ?? last.appNames;
  const hasAppSelection = last.allApps === true || (appIdsOrNames?.length ?? 0) > 0;
  return {
    env: last.envId,
    login: last.login,
    ...(last.allApps === true
      ? { all: true }
      : appIdsOrNames?.length
        ? { apps: appIdsOrNames }
        : {}),
    skipConfirm: hasAppSelection,
  };
}

/**
 * Orchestration de la commande connect : choix de l'env, des apps, identifiant
 * (existant ou nouveau), auth, mise à jour des .env.
 */
export class EnvSyncService {
  constructor(private readonly authClient: IAuthClient = new FetchAuthClient()) {}

  async runInteractive(options: ConnectOptions): Promise<void> {
    const config = await loadAppConfig();
    if (!config?.appsRoot) {
      logger.error(
        "La configuration n'est pas initialisée. Exécutez d'abord : dev-auth-fetcher onboard"
      );
      return;
    }

    const resolved = await this.resolveEnvironment(options);
    if (resolved === 'reconnect') return; // une reconnexion rapide a déjà été rejouée
    if (!resolved) return;
    const { env, envId } = resolved;

    const { apps, allSelected } = await selectAppsStep(config.appsRoot, {
      app: options.app,
      all: options.all,
      apps: options.apps,
    });
    if (apps.length === 0) {
      logger.warn('Aucune application sélectionnée.');
      return;
    }

    const creds = await resolveCredentialsStep(envId, { login: options.login });

    if (!options.skipConfirm) {
      const confirmed = await confirmAndRunStep({ environment: env, apps, login: creds.login });
      if (!confirmed) {
        logger.info('Annulé.');
        return;
      }
    }

    const spinner = ora('Connexion en cours…').start();
    try {
      const cookies = await this.authClient.loginAndGetCookies(env.url, {
        login: creds.login,
        password: creds.password,
      });
      spinner.succeed('Connexion réussie.');

      if (creds.shouldSave) {
        await addOrUpdateProfileForEnvironment(envId, {
          login: creds.login,
          password: creds.password,
          role: creds.role,
        });
        logger.info('Identifiant enregistré pour cet environnement.');
      }

      // Mémoriser la dernière connexion (envId, login, apps) pour reconnect-last.
      await setLastConnection(envId, creds.login, {
        allApps: allSelected,
        appIds: apps.map((a) => a.id),
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
        { login: creds.login }
      );
      updateSpinner.succeed(`${apps.length} fichier(s) .env mis à jour.`);
    } catch (err) {
      spinner.fail('Échec de la connexion.');
      logger.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Résout l'environnement cible. Retourne `{ env, envId }`, `'reconnect'` si une
   * reconnexion rapide a été rejouée, ou `null` en cas d'abandon / erreur.
   */
  private async resolveEnvironment(
    options: ConnectOptions
  ): Promise<{ env: EnvironmentConfig; envId: string } | 'reconnect' | null> {
    if (options.env) {
      const env = await getEnvironmentById(options.env);
      if (!env) {
        logger.error(`Environnement inconnu : ${options.env}`);
        return null;
      }
      return { env, envId: options.env };
    }

    const envs = await listEnvironments();
    if (envs.length === 0) {
      logger.error("Aucun environnement configuré. Exécutez d'abord : dev-auth-fetcher onboard");
      return null;
    }

    const last = await getLastConnection();
    const envChoices = envs.map((e) => ({ name: `${e.label} (${e.url})`, value: e.id }));
    if (last) {
      envChoices.unshift({
        name: `🔄 Reconnexion rapide : ${last.envId} / ${last.login} (${describeLastConnectionApps(last)})`,
        value: RECONNECT_CHOICE,
      });
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
      await this.runInteractive(reconnectOptionsFromLast(last));
      return 'reconnect';
    }

    const env = await getEnvironmentById(selectedEnvId);
    if (!env) {
      logger.error('Environnement non trouvé.');
      return null;
    }
    return { env, envId: selectedEnvId };
  }
}
