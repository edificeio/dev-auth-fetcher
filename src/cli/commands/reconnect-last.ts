import { getLastConnection } from '../../config/credentialsStore.js';
import {
  EnvSyncService,
  describeLastConnectionApps,
  reconnectOptionsFromLast,
} from '../../services/EnvSyncService.js';
import { logger } from '../../utils/logger.js';

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
      ? `Reconnexion automatique : ${last.envId} / ${last.login} (${describeLastConnectionApps(last)})`
      : `Reconnexion : ${last.envId} / ${last.login} (sélection des apps à choisir)`
  );

  await new EnvSyncService().runInteractive(reconnectOptionsFromLast(last));
}
