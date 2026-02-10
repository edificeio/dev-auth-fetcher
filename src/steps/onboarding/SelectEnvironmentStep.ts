import inquirer from 'inquirer';

import type { EnvironmentConfig } from '../../config/config.types.js';
import { DEFAULT_ENVIRONMENTS } from '../../config/envConfigs.js';

export interface SelectEnvironmentResult {
  generateDefaults: boolean;
  selectedEnvironments: EnvironmentConfig[];
}

/**
 * Propose de générer les fichiers d'environnements par défaut.
 */
export async function selectEnvironmentStep(): Promise<SelectEnvironmentResult> {
  const { generateDefaults } = await inquirer.prompt<{ generateDefaults: boolean }>([
    {
      type: 'confirm',
      name: 'generateDefaults',
      message:
        'Générer les fichiers de configuration des environnements par défaut (recette-ode1, recette-ode2, recette-release, local) ?',
      default: true,
    },
  ]);
  return {
    generateDefaults,
    selectedEnvironments: generateDefaults ? DEFAULT_ENVIRONMENTS : [],
  };
}
