import { EnvSyncService } from '../../services/EnvSyncService';
import { createLogger } from '../../utils/logger';

export interface ConnectCommandOptions {
  env?: string;
  app?: string;
  all?: boolean;
  login?: string;
}

const logger = createLogger();

export async function runConnectCommand(
  options: ConnectCommandOptions,
): Promise<void> {
  logger.info('🔗 Connexion aux environnements de recette…');

  const service = new EnvSyncService();

  await service.runInteractive(options);

  logger.success('✅ Synchronisation des cookies terminée.');
}

