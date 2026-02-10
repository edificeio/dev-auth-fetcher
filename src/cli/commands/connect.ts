import { EnvSyncService, type ConnectOptions } from '../../services/EnvSyncService';
import { createLogger } from '../../utils/logger';

export type { ConnectOptions };

const logger = createLogger();

export async function runConnectCommand(options: ConnectOptions): Promise<void> {
  logger.info('🔗 Connexion aux environnements de recette…');

  const service = new EnvSyncService();

  await service.runInteractive(options);

  logger.success('✅ Synchronisation des cookies terminée.');
}

