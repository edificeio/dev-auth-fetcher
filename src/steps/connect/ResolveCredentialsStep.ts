import inquirer from 'inquirer';

import { getProfilesForEnvironment } from '../../config/credentialsStore.js';

const CHOICE_NEW_CREDENTIALS = '__new__';

export interface ResolvedCredentials {
  login: string;
  password: string;
  role?: string;
  /** true si l'identifiant doit être enregistré après une connexion réussie. */
  shouldSave: boolean;
}

/**
 * Demande mot de passe (+ rôle), et login si non prérenseigné.
 * Les identifiants saisis ici sont à enregistrer après succès (shouldSave: true).
 */
async function promptCredentials(opts: {
  withLogin: boolean;
  presetLogin?: string;
}): Promise<ResolvedCredentials> {
  const answers = await inquirer.prompt<{ login?: string; password: string; role?: string }>([
    ...(opts.withLogin ? [{ type: 'input' as const, name: 'login', message: 'Login :' }] : []),
    { type: 'password' as const, name: 'password', message: 'Mot de passe :' },
    {
      type: 'input' as const,
      name: 'role',
      message: 'Rôle (optionnel, ex: Enseignant, Élève, Admin) :',
      default: '',
    },
  ]);
  return {
    login: opts.presetLogin ?? answers.login!,
    password: answers.password,
    role: answers.role?.trim() || undefined,
    shouldSave: true,
  };
}

/**
 * Résout l'identifiant à utiliser pour un environnement :
 * - `options.login` fourni : réutilise le profil enregistré s'il existe, sinon demande le mot de passe ;
 * - sinon, s'il existe des profils : laisse choisir un profil existant ou en saisir un nouveau ;
 * - sinon : saisie complète.
 */
export async function resolveCredentialsStep(
  envId: string,
  options: { login?: string }
): Promise<ResolvedCredentials> {
  const savedProfiles = await getProfilesForEnvironment(envId);

  if (options.login) {
    const existing = savedProfiles.find((p) => p.login === options.login);
    if (existing) {
      return {
        login: existing.login,
        password: existing.password,
        role: existing.role,
        shouldSave: false,
      };
    }
    return promptCredentials({ withLogin: false, presetLogin: options.login });
  }

  if (savedProfiles.length > 0) {
    const choices = [
      ...savedProfiles.map((p) => ({
        name: p.role ? `${p.login} (${p.role})` : p.login,
        value: p.login,
      })),
      { name: '➕ Nouvel identifiant', value: CHOICE_NEW_CREDENTIALS },
    ];
    const { selectedLogin } = await inquirer.prompt<{ selectedLogin: string }>([
      {
        type: 'list',
        name: 'selectedLogin',
        message: 'Choisissez un identifiant ou saisissez un nouveau :',
        choices,
      },
    ]);
    if (selectedLogin === CHOICE_NEW_CREDENTIALS) {
      return promptCredentials({ withLogin: true });
    }
    const profile = savedProfiles.find((p) => p.login === selectedLogin)!;
    return {
      login: profile.login,
      password: profile.password,
      role: profile.role,
      shouldSave: false,
    };
  }

  return promptCredentials({ withLogin: true });
}
