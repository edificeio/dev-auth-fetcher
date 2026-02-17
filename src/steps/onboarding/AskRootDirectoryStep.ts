import path from 'node:path';

import inquirer from 'inquirer';

export interface AskRootResult {
  appsRoot: string;
}

/**
 * Demande à l'utilisateur le chemin racine des applications (ou le confirme).
 */
export async function askRootDirectoryStep(currentAppsRoot?: string): Promise<AskRootResult> {
  const defaultPath = currentAppsRoot || process.cwd();
  const { appsRoot } = await inquirer.prompt<{ appsRoot: string }>([
    {
      type: 'input',
      name: 'appsRoot',
      message:
        "Chemin racine des applications ({app}/frontend ou entcore/{app}/frontend) :",
      default: defaultPath,
      validate: (input: string) => {
        if (!input?.trim()) return 'Le chemin ne peut pas être vide.';
        return true;
      },
    },
  ]);
  return { appsRoot: path.resolve(appsRoot.trim()) };
}
