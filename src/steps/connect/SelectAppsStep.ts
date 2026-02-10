import inquirer from 'inquirer';
import { discoverApps } from '../../core/apps/AppDiscovery';
import type { AppSummary } from '../../core/apps/AppDiscovery';

export interface SelectAppsResult {
  apps: AppSummary[];
}

const CHOICE_ALL = '__all__';

/**
 * Découvre les applications et permet de sélectionner une app, toutes, ou une liste.
 */
export async function selectAppsStep(
  appsRoot: string,
  options: { app?: string; all?: boolean },
): Promise<SelectAppsResult> {
  const discovered = await discoverApps(appsRoot);

  if (discovered.length === 0) {
    return { apps: [] };
  }

  if (options.all) {
    return { apps: discovered };
  }

  if (options.app) {
    const found = discovered.find((a) => a.name === options.app);
    return { apps: found ? [found] : [] };
  }

  const choices = [
    { name: 'Toutes les applications', value: CHOICE_ALL },
    ...discovered.map((a) => ({ name: a.name, value: a.id })),
  ];

  const { selected } = await inquirer.prompt<{ selected: string }>([
    {
      type: 'list',
      name: 'selected',
      message: "Sélectionnez l'application à mettre à jour :",
      choices,
    },
  ]);

  if (selected === CHOICE_ALL) {
    return { apps: discovered };
  }
  const app = discovered.find((a) => a.id === selected);
  return { apps: app ? [app] : [] };
}
