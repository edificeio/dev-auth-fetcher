import * as fs from 'fs/promises';
import * as path from 'path';

import { getEnvironmentsConfigDir } from '../utils/paths.js';

import type { EnvironmentConfig } from './config.types.js';

/**
 * Charge tous les fichiers config/environments/*.json et retourne la liste des environnements.
 */
export async function listEnvironments(): Promise<EnvironmentConfig[]> {
  const dir = getEnvironmentsConfigDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const configs: EnvironmentConfig[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const filePath = path.join(dir, name);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) continue;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as EnvironmentConfig;
      if (data.id && data.label && data.url) {
        configs.push(data);
      }
    } catch {
      // Ignorer les fichiers invalides
    }
  }
  return configs.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Retourne la config d'un environnement par son id.
 */
export async function getEnvironmentById(id: string): Promise<EnvironmentConfig | null> {
  const envs = await listEnvironments();
  return envs.find((e) => e.id === id) ?? null;
}

/**
 * Génère les fichiers de config d'environnements par défaut.
 */
export const DEFAULT_ENVIRONMENTS: EnvironmentConfig[] = [
  {
    id: 'recette-ode1',
    label: 'Recette ODE 1',
    url: 'https://recette-ode1.opendigitaleducation.com/',
  },
  {
    id: 'recette-ode2',
    label: 'Recette ODE 2',
    url: 'https://recette-ode2.opendigitaleducation.com/',
  },
  {
    id: 'recette-ode3',
    label: 'Recette ODE 3',
    url: 'https://recette-ode3.opendigitaleducation.com/',
  },
  {
    id: 'recette-release',
    label: 'Recette Release',
    url: 'https://recette-release.opendigitaleducation.com/',
  },
  { id: 'local', label: 'Local', url: 'http://localhost:8090/' },
];

export async function generateDefaultEnvironmentConfigs(): Promise<void> {
  const dir = getEnvironmentsConfigDir();
  await fs.mkdir(dir, { recursive: true });
  for (const env of DEFAULT_ENVIRONMENTS) {
    const filePath = path.join(dir, `${env.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(env, null, 2), 'utf-8');
  }
}
