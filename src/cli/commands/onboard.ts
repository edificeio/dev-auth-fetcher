import { OnboardingService } from '../../services/OnboardingService.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger();

export async function runOnboardCommand(): Promise<void> {
  logger.info('🔧 Onboarding du projet CLI…');

  const service = new OnboardingService();
  await service.run();

  logger.success('✅ Onboarding terminé.');
}
