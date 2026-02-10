import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvFileError } from './errors';

/**
 * Lit un fichier .env et retourne un objet clé/valeur.
 * Préserve les commentaires pour une réécriture propre si besoin (on ne les garde pas ici pour simplifier le merge).
 */
export async function readEnvFile(filePath: string): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseEnvContent(content);
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return {};
    }
    throw new EnvFileError(`Impossible de lire le fichier .env: ${nodeErr.message}`);
  }
}

/**
 * Parse le contenu d'un fichier .env (lignes KEY=value, ignore les commentaires et lignes vides).
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\(.)/g, '$1');
    }
    result[key] = value;
  }
  return result;
}

/**
 * Fusionne les valeurs existantes avec un patch. Les clés du patch écrasent les existantes.
 */
export function mergeEnv(
  existing: Record<string, string>,
  patch: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...patch };
}

/**
 * Formate un objet env en contenu .env (lignes KEY=value).
 */
export function formatEnvContent(values: Record<string, string>, headerComments: string[] = []): string {
  const lines: string[] = [];
  for (const comment of headerComments) {
    lines.push(comment.startsWith('#') ? comment : `# ${comment}`);
  }
  if (headerComments.length > 0) {
    lines.push('');
  }
  for (const [key, value] of Object.entries(values)) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`${key}="${escaped}"`);
  }
  return lines.join('\n') + '\n';
}

/**
 * Écrit un fichier .env. Crée le répertoire parent si nécessaire.
 */
export async function writeEnvFile(
  filePath: string,
  values: Record<string, string>,
  headerComments: string[] = [],
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const content = formatEnvContent(values, headerComments);
  await fs.writeFile(filePath, content, 'utf-8');
}
