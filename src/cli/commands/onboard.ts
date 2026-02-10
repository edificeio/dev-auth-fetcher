import { OnboardingService } from '../../services/OnboardingService';
import { createLogger } from '../../utils/logger';

const logger = createLogger();

export async function runOnboardCommand(): Promise<void> {
  logger.info('🔧 Onboarding du projet CLI…');

  const service = new OnboardingService();
  await service.run();

  logger.success('✅ Onboarding terminé.');
}

