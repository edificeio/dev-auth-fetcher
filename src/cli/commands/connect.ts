import { EnvSyncService, type ConnectOptions } from '../../services/EnvSyncService.js';
import { logger } from '../../utils/logger.js';

export type { ConnectOptions };

export async function runConnectCommand(options: ConnectOptions): Promise<void> {
  logger.info('🔗 Connexion aux environnements de recette…');

  const service = new EnvSyncService();

  await service.runInteractive(options);

  logger.success('✅ Synchronisation des cookies terminée.');
}
