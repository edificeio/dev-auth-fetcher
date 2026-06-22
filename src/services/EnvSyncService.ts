import inquirer from 'inquirer';
import ora from 'ora';

import { loadAppConfig } from '../config/appConfig.js';
import type { EnvironmentConfig } from '../config/config.types.js';
import {
  addOrUpdateProfileForEnvironment,
  getRecentConnections,
  recordConnection,
  type LastConnection,
  type RecentConnection,
} from '../config/credentialsStore.js';
import { listEnvironments, getEnvironmentById } from '../config/envConfigs.js';
import type { AppSummary } from '../core/apps/AppDiscovery.js';
import type { AuthCookies, IAuthClient } from '../core/auth/AuthClient.js';
import { FetchAuthClient } from '../core/auth/FetchAuthClient.js';
import { updateAppsEnv } from '../core/env/EnvManager.js';
import { confirmAndRunStep } from '../steps/connect/ConfirmAndRunStep.js';
import {
  resolveCredentialsStep,
  type ResolvedCredentials,
} from '../steps/connect/ResolveCredentialsStep.js';
import { selectAppsStep } from '../steps/connect/SelectAppsStep.js';
import { logger } from '../utils/logger.js';

const RECONNECT_CHOICE = '__reconnect_last__';

/** Au-delà de ce délai sans info d'expiration, une session est considérée comme probablement périmée. */
const STALE_AFTER_MS = 8 * 60 * 60 * 1000;
/** En mode watch, on rafraîchit ce délai avant l'expiration estimée. */
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
/** Intervalle de rafraîchissement de repli quand l'expiration du cookie est inconnue. */
const WATCH_FALLBACK_INTERVAL_MS = 30 * 60 * 1000;
/** Délai minimum entre deux rafraîchissements (anti-boucle serrée). */
const WATCH_MIN_DELAY_MS = 5000;

export interface ConnectOptions {
  env?: string;
  app?: string;
  all?: boolean;
  /** Liste d'ids ou noms d'apps (ex. app1, entcore/mediacentre). Utilisée par reconnect-last. */
  apps?: string[];
  login?: string;
  /** Si true, ne pas demander de confirmation (reconnect-last entièrement automatique). */
  skipConfirm?: boolean;
  /** Si true, garder la session fraîche : ré-authentifier et réinjecter avant expiration. */
  watch?: boolean;
}

/** Décrit la sélection d'apps d'une connexion (pour l'affichage). */
export function describeLastConnectionApps(last: LastConnection): string {
  if (last.allApps === true) return 'toutes les apps';
  const ids = last.appIds ?? last.appNames;
  return ids?.length ? ids.join(', ') : 'apps à choisir';
}

/** Formate une durée (ms) en « 3h12 » / « 12 min » / « moins d'une minute ». */
function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 1) return "moins d'une minute";
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return hours === 0 ? `${minutes} min` : `${hours}h${String(minutes).padStart(2, '0')}`;
}

/** true si la session d'une connexion est (probablement) périmée. */
export function isSessionStale(c: RecentConnection, now: number = Date.now()): boolean {
  if (typeof c.expiresAt === 'number') return now >= c.expiresAt;
  return now - c.connectedAt >= STALE_AFTER_MS;
}

/** « connecté il y a 3h12 » (+ ⚠️ si probablement expiré). */
export function describeFreshness(c: RecentConnection, now: number = Date.now()): string {
  const age = `connecté il y a ${formatDuration(now - c.connectedAt)}`;
  return isSessionStale(c, now) ? `${age} ⚠️ probablement expiré` : age;
}

/** Construit les options `connect` permettant de rejouer une connexion. */
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

/** Sommeil annulable via un AbortSignal. Retourne 'aborted' si interrompu. */
function sleep(ms: number, signal: AbortSignal): Promise<'done' | 'aborted'> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve('aborted');
    const onAbort = () => {
      clearTimeout(timer);
      resolve('aborted');
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve('done');
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Orchestration de la commande connect : choix de l'env, des apps, identifiant
 * (existant ou nouveau), auth, mise à jour des .env, et mode watch optionnel.
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
    const { env } = resolved;

    const { apps, allSelected } = await selectAppsStep(config.appsRoot, {
      app: options.app,
      all: options.all,
      apps: options.apps,
    });
    if (apps.length === 0) {
      logger.warn('Aucune application sélectionnée.');
      return;
    }

    const creds = await resolveCredentialsStep(env.id, { login: options.login });

    if (!options.skipConfirm) {
      const confirmed = await confirmAndRunStep({ environment: env, apps, login: creds.login });
      if (!confirmed) {
        logger.info('Annulé.');
        return;
      }
    }

    const spinner = ora('Connexion en cours…').start();
    let cookies: AuthCookies;
    try {
      cookies = await this.authenticateAndInject(env, apps, creds, allSelected);
    } catch (err) {
      spinner.fail('Échec de la connexion.');
      logger.error(err instanceof Error ? err.message : String(err));
      throw err;
    }
    spinner.succeed(`Connexion réussie — ${apps.length} fichier(s) .env mis à jour.`);

    if (creds.shouldSave) {
      await addOrUpdateProfileForEnvironment(env.id, {
        login: creds.login,
        password: creds.password,
        role: creds.role,
      });
      logger.info('Identifiant enregistré pour cet environnement.');
    }

    if (typeof cookies.expiresAt === 'number') {
      logger.info(`Session valide ~${formatDuration(cookies.expiresAt - Date.now())}.`);
    }

    if (options.watch) {
      await this.runWatch(env, apps, creds, allSelected, cookies);
    }
  }

  /**
   * Authentifie, enregistre la connexion (historique + expiration) et met à jour les .env.
   * Réutilisé par le connect one-shot et par la boucle watch.
   */
  private async authenticateAndInject(
    env: EnvironmentConfig,
    apps: AppSummary[],
    creds: ResolvedCredentials,
    allSelected: boolean
  ): Promise<AuthCookies> {
    const cookies = await this.authClient.loginAndGetCookies(env.url, {
      login: creds.login,
      password: creds.password,
    });

    await recordConnection(
      env.id,
      creds.login,
      {
        allApps: allSelected,
        appIds: apps.map((a) => a.id),
        appNames: apps.map((a) => a.name),
      },
      { expiresAt: cookies.expiresAt }
    );

    await updateAppsEnv(
      apps.map((a) => ({ envPath: a.envPath })),
      {
        xsrfToken: cookies.xsrfToken,
        sessionId: cookies.sessionId,
        recetteUrl: env.url,
      },
      { login: creds.login }
    );

    return cookies;
  }

  /** Délai avant le prochain rafraîchissement watch. */
  private computeRefreshDelay(expiresAt?: number): number {
    if (typeof expiresAt === 'number') {
      return Math.max(WATCH_MIN_DELAY_MS, expiresAt - Date.now() - REFRESH_BUFFER_MS);
    }
    return WATCH_FALLBACK_INTERVAL_MS;
  }

  /**
   * Boucle de rafraîchissement (premier plan) : ré-authentifie et réinjecte avant expiration,
   * jusqu'à Ctrl+C ou échec. Chaque réinjection redémarre le dev-server Vite (reload de la page).
   */
  private async runWatch(
    env: EnvironmentConfig,
    apps: AppSummary[],
    creds: ResolvedCredentials,
    allSelected: boolean,
    initial: AuthCookies
  ): Promise<void> {
    logger.warn(
      'Mode --watch actif : chaque rafraîchissement réécrit les .env → Vite redémarre et recharge la page (perte du HMR). Ctrl+C pour arrêter.'
    );

    const controller = new AbortController();
    const onSigint = () => controller.abort();
    process.on('SIGINT', onSigint);
    let cookies = initial;
    try {
      while (!controller.signal.aborted) {
        const delay = this.computeRefreshDelay(cookies.expiresAt);
        logger.info(
          `Prochain rafraîchissement dans ${formatDuration(delay)} (Ctrl+C pour arrêter).`
        );
        if ((await sleep(delay, controller.signal)) === 'aborted') break;

        const spinner = ora('Rafraîchissement de la session…').start();
        try {
          cookies = await this.authenticateAndInject(env, apps, creds, allSelected);
          spinner.succeed(`Session rafraîchie — ${apps.length} fichier(s) .env mis à jour.`);
        } catch (err) {
          spinner.fail('Échec du rafraîchissement — arrêt du mode --watch.');
          logger.error(err instanceof Error ? err.message : String(err));
          break;
        }
      }
    } finally {
      process.removeListener('SIGINT', onSigint);
    }
    logger.info('Arrêt du mode --watch.');
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

    const recents = await getRecentConnections();
    const recentChoices = recents.map((r, i) => ({
      name: `🔄 ${r.envId} / ${r.login} (${describeLastConnectionApps(r)}) — ${describeFreshness(r)}`,
      value: `${RECONNECT_CHOICE}:${i}`,
    }));
    const envChoices = envs.map((e) => ({ name: `${e.label} (${e.url})`, value: e.id }));
    const choices = recentChoices.length
      ? [...recentChoices, new inquirer.Separator(), ...envChoices]
      : envChoices;

    const { selectedEnvId } = await inquirer.prompt<{ selectedEnvId: string }>([
      {
        type: 'list',
        name: 'selectedEnvId',
        message: "Sélectionnez l'environnement :",
        choices,
      },
    ]);

    if (selectedEnvId.startsWith(`${RECONNECT_CHOICE}:`)) {
      const index = Number(selectedEnvId.slice(RECONNECT_CHOICE.length + 1));
      const recent = recents[index];
      if (recent) {
        // Reporter le flag watch : il porte sur toute la commande, pas sur l'env choisi.
        await this.runInteractive({ ...reconnectOptionsFromLast(recent), watch: options.watch });
        return 'reconnect';
      }
    }

    const env = await getEnvironmentById(selectedEnvId);
    if (!env) {
      logger.error('Environnement non trouvé.');
      return null;
    }
    return { env, envId: selectedEnvId };
  }
}
