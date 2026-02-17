import { getLastConnection } from '../../config/credentialsStore.js';
import { EnvSyncService } from '../../services/EnvSyncService.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger();

export async function runReconnectLastCommand(): Promise<void> {
  const last = await getLastConnection();
  if (!last) {
    logger.warn(
      "Aucune connexion précédente trouvée. Utilisez d'abord la commande 'connect' pour établir une première connexion."
    );
    return;
  }

  const appIdsOrNames = last.appIds ?? last.appNames;
  const hasAppSelection = last.allApps === true || (appIdsOrNames?.length ?? 0) > 0;
  logger.info(
    hasAppSelection
      ? `Reconnexion automatique : ${last.envId} / ${last.login} (${last.allApps ? 'toutes les apps' : appIdsOrNames!.join(', ')})`
      : `Reconnexion : ${last.envId} / ${last.login} (sélection des apps à choisir)`
  );

  const service = new EnvSyncService();
  await service.runInteractive({
    env: last.envId,
    login: last.login,
    ...(last.allApps === true
      ? { all: true }
      : appIdsOrNames?.length
        ? { apps: appIdsOrNames }
        : {}),
    skipConfirm: hasAppSelection,
  });
}
