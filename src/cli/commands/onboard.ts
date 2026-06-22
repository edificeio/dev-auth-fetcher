import { OnboardingService } from '../../services/OnboardingService.js';
import { logger } from '../../utils/logger.js';

export async function runOnboardCommand(): Promise<void> {
  logger.info('🔧 Onboarding du projet CLI…');

  const service = new OnboardingService();
  await service.run();

  logger.success('✅ Onboarding terminé.');
}
