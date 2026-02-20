import * as fs from 'fs/promises';
import * as path from 'path';

import { AppDiscoveryError } from '../../utils/errors.js';

export interface AppSummary {
  id: string;
  name: string;
  path: string;
  envPath: string;
}

/**
 * Parcourt appsRoot et détecte les applications ayant un dossier frontend.
 * Deux schémas supportés :
 * - À la racine : {application}/frontend
 * - Sous entcore : entcore/{application}/frontend (id = "entcore/{application}")
 */
export async function discoverApps(appsRoot: string): Promise<AppSummary[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(appsRoot);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      throw new AppDiscoveryError(`Le répertoire des applications n'existe pas: ${appsRoot}`);
    }
    throw new AppDiscoveryError(
      `Impossible de lire le répertoire des applications: ${nodeErr.message}`
    );
  }

  const apps: AppSummary[] = [];

  // Schéma racine : {application}/frontend
  for (const name of entries) {
    const appPath = path.join(appsRoot, name);
    const stat = await fs.stat(appPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const frontendPath = path.join(appPath, 'frontend');
    const frontendStat = await fs.stat(frontendPath).catch(() => null);
    if (!frontendStat?.isDirectory()) continue;

    const envPath = path.join(frontendPath, '.env');
    apps.push({
      id: name,
      name,
      path: appPath,
      envPath,
    });
  }

  // Schéma entcore : entcore/{application}/frontend (id = "entcore/{application}")
  const entcorePath = path.join(appsRoot, 'entcore');
  const entcoreStat = await fs.stat(entcorePath).catch(() => null);
  if (entcoreStat?.isDirectory()) {
    let entcoreEntries: string[];
    try {
      entcoreEntries = await fs.readdir(entcorePath);
    } catch {
      entcoreEntries = [];
    }
    for (const appName of entcoreEntries) {
      const appPath = path.join(entcorePath, appName);
      const stat = await fs.stat(appPath).catch(() => null);
      if (!stat?.isDirectory()) continue;

      const frontendPath = path.join(appPath, 'frontend');
      const frontendStat = await fs.stat(frontendPath).catch(() => null);
      if (!frontendStat?.isDirectory()) continue;

      const envPath = path.join(frontendPath, '.env');
      apps.push({
        id: `entcore/${appName}`,
        name: appName,
        path: appPath,
        envPath,
      });
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}
