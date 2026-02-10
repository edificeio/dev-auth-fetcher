import inquirer from 'inquirer';
import type { AppSummary } from '../../core/apps/AppDiscovery';
import type { EnvironmentConfig } from '../../config/config.types';

export interface ConfirmAndRunInput {
  environment: EnvironmentConfig;
  apps: AppSummary[];
  login: string;
}

/**
 * Affiche un récapitulatif et demande confirmation avant de lancer la synchro.
 */
export async function confirmAndRunStep(input: ConfirmAndRunInput): Promise<boolean> {
  // eslint-disable-next-line no-console
  console.log('\nRécapitulatif :');
  // eslint-disable-next-line no-console
  console.log(`  Environnement : ${input.environment.label} (${input.environment.url})`);
  // eslint-disable-next-line no-console
  console.log(`  Compte : ${input.login}`);
  // eslint-disable-next-line no-console
  console.log(`  Applications : ${input.apps.map((a) => a.name).join(', ') || 'aucune'}`);

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Lancer la connexion et la mise à jour des .env ?',
      default: true,
    },
  ]);
  return confirm;
}
