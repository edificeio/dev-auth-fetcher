import inquirer from 'inquirer';

import type { EnvironmentConfig } from '../../config/config.types.js';
import type { AppSummary } from '../../core/apps/AppDiscovery.js';

export interface ConfirmAndRunInput {
  environment: EnvironmentConfig;
  apps: AppSummary[];
  login: string;
}

/**
 * Affiche un récapitulatif et demande confirmation avant de lancer la synchro.
 */
export async function confirmAndRunStep(input: ConfirmAndRunInput): Promise<boolean> {
  console.log('\nRécapitulatif :');

  console.log(`  Environnement : ${input.environment.label} (${input.environment.url})`);

  console.log(`  Compte : ${input.login}`);

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
