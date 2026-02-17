import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import type { UserProfile } from './config.types.js';

const CREDENTIALS_DIR = '.dev-auth-fetcher';
const CREDENTIALS_SUBDIR = 'credentials';

export interface LastConnection {
  envId: string;
  login: string;
  /** true si "toutes les applications" avaient été sélectionnées */
  allApps?: boolean;
  /** ids des applications sélectionnées (prioritaire pour reconnect) */
  appIds?: string[];
  /** noms des applications (rétrocompatibilité, affichage) */
  appNames?: string[];
}

export interface UserCredentialsStore {
  environmentProfiles: Record<string, UserProfile[]>;
  lastConnection?: LastConnection;
}

const DEFAULT_STORE: UserCredentialsStore = {
  environmentProfiles: {},
  lastConnection: undefined,
};

/**
 * Identifiant de l'utilisateur courant (surchargeable via DEV_AUTH_USER).
 */
export function getUserId(): string {
  return process.env.DEV_AUTH_USER ?? os.userInfo().username;
}

/**
 * Chemin du fichier de credentials pour l'utilisateur courant (relatif à process.cwd()).
 */
export function getUserCredentialsPath(): string {
  return path.join(process.cwd(), CREDENTIALS_DIR, CREDENTIALS_SUBDIR, getUserId() + '.json');
}

/**
 * Charge le store des credentials de l'utilisateur. Retourne un store vide si le fichier n'existe pas.
 */
export async function loadUserCredentialsStore(): Promise<UserCredentialsStore> {
  const filePath = getUserCredentialsPath();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as UserCredentialsStore;
    return {
      environmentProfiles: data.environmentProfiles ?? {},
      lastConnection: data.lastConnection,
    };
  } catch (err) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') {
      return { ...DEFAULT_STORE };
    }
    throw err;
  }
}

/**
 * Sauvegarde le store des credentials (crée le répertoire si besoin).
 */
export async function saveUserCredentialsStore(store: UserCredentialsStore): Promise<void> {
  const filePath = getUserCredentialsPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Retourne la liste des profils enregistrés pour un environnement.
 */
export async function getProfilesForEnvironment(envId: string): Promise<UserProfile[]> {
  const store = await loadUserCredentialsStore();
  return store.environmentProfiles[envId] ?? [];
}

/**
 * Ajoute ou met à jour un profil pour un environnement (même login = mise à jour du mot de passe).
 */
export async function addOrUpdateProfileForEnvironment(
  envId: string,
  profile: UserProfile
): Promise<void> {
  const store = await loadUserCredentialsStore();
  if (!store.environmentProfiles[envId]) {
    store.environmentProfiles[envId] = [];
  }
  const list = store.environmentProfiles[envId];
  const existingIndex = list.findIndex((p) => p.login === profile.login);
  if (existingIndex >= 0) {
    list[existingIndex] = profile;
  } else {
    list.push(profile);
  }
  await saveUserCredentialsStore(store);
}

/**
 * Retourne la dernière connexion (envId + login) si disponible.
 */
export async function getLastConnection(): Promise<LastConnection | null> {
  const store = await loadUserCredentialsStore();
  return store.lastConnection ?? null;
}

/**
 * Enregistre la dernière connexion (envId, login, et sélection d'apps) dans le store utilisateur.
 */
export async function setLastConnection(
  envId: string,
  login: string,
  appSelection?: { allApps: boolean; appIds: string[]; appNames?: string[] }
): Promise<void> {
  const store = await loadUserCredentialsStore();
  store.lastConnection = {
    envId,
    login,
    allApps: appSelection?.allApps,
    appIds: appSelection?.appIds?.length ? appSelection.appIds : undefined,
    appNames: appSelection?.appNames?.length ? appSelection.appNames : undefined,
  };
  await saveUserCredentialsStore(store);
}
