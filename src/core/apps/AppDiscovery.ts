import * as fs from 'fs/promises';
import * as path from 'path';

import { AppDiscoveryError } from '../../utils/errors.js';

export interface AppSummary {
  id: string;
  name: string;
  path: string;
  envPath: string;
}

async function isDirectory(p: string): Promise<boolean> {
  return (await fs.stat(p).catch(() => null))?.isDirectory() ?? false;
}

async function isFile(p: string): Promise<boolean> {
  return (await fs.stat(p).catch(() => null))?.isFile() ?? false;
}

/**
 * Parcourt appsRoot et détecte les applications frontend.
 * Quatre schémas supportés (par ordre de priorité dans chaque zone) :
 * - Racine : {application}/frontend
 * - Racine direct : {application}/.env + package.json (sans sous-dossier frontend)
 * - Entcore : entcore/{application}/frontend (id = "entcore/{application}")
 * - Entcore TS : entcore/{application}/src/main/ts (id = "entcore/{application}")
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
    if (!(await isDirectory(appPath))) continue;

    const frontendDir = path.join(appPath, 'frontend');
    if (!(await isDirectory(frontendDir))) continue;

    apps.push({ id: name, name, path: appPath, envPath: path.join(frontendDir, '.env') });
  }

  // Schéma racine direct : {application}/.env + package.json (sans sous-dossier frontend)
  for (const name of entries) {
    if (apps.some((a) => a.id === name)) continue;

    const appPath = path.join(appsRoot, name);
    if (!(await isDirectory(appPath))) continue;
    if (!(await isFile(path.join(appPath, '.env')))) continue;
    if (!(await isFile(path.join(appPath, 'package.json')))) continue;
    if (await isDirectory(path.join(appPath, 'frontend'))) continue;

    apps.push({ id: name, name, path: appPath, envPath: path.join(appPath, '.env') });
  }

  const entcorePath = path.join(appsRoot, 'entcore');
  if (!(await isDirectory(entcorePath))) return apps.sort((a, b) => a.name.localeCompare(b.name));

  let entcoreEntries: string[];
  try {
    entcoreEntries = await fs.readdir(entcorePath);
  } catch {
    entcoreEntries = [];
  }

  // Schéma entcore : entcore/{application}/frontend (id = "entcore/{application}")
  for (const appName of entcoreEntries) {
    const appPath = path.join(entcorePath, appName);
    if (!(await isDirectory(appPath))) continue;

    const frontendDir = path.join(appPath, 'frontend');
    if (!(await isDirectory(frontendDir))) continue;

    apps.push({
      id: `entcore/${appName}`,
      name: appName,
      path: appPath,
      envPath: path.join(frontendDir, '.env'),
    });
  }

  // Schéma entcore TS : entcore/{application}/src/main/ts (id = "entcore/{application}")
  for (const appName of entcoreEntries) {
    if (apps.some((a) => a.id === `entcore/${appName}`)) continue;

    const appPath = path.join(entcorePath, appName);
    if (!(await isDirectory(appPath))) continue;

    const tsDir = path.join(appPath, 'src', 'main', 'ts');
    if (!(await isDirectory(tsDir))) continue;

    apps.push({
      id: `entcore/${appName}`,
      name: appName,
      path: appPath,
      envPath: path.join(tsDir, '.env'),
    });
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}
