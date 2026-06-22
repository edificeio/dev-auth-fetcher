import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  loadUserCredentialsStore,
  saveUserCredentialsStore,
  getProfilesForEnvironment,
  addOrUpdateProfileForEnvironment,
  getLastConnection,
  getRecentConnections,
  getLoginRecency,
  recordConnection,
  connectionSignature,
  type UserCredentialsStore,
} from '../../src/config/credentialsStore.js';

describe.sequential('credentialsStore', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'credentials-store-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    process.env.DEV_AUTH_USER = 'test-user';
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    delete process.env.DEV_AUTH_USER;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loadUserCredentialsStore retourne un store vide si le fichier n'existe pas", async () => {
    const store = await loadUserCredentialsStore();
    expect(store.environmentProfiles).toEqual({});
  });

  it('saveUserCredentialsStore puis loadUserCredentialsStore persiste les données', async () => {
    const store: UserCredentialsStore = {
      environmentProfiles: {
        'recette-ode1': [
          { login: 'u1', password: 'p1' },
          { login: 'u2', password: 'p2' },
        ],
      },
    };
    await saveUserCredentialsStore(store);
    const loaded = await loadUserCredentialsStore();
    expect(loaded.environmentProfiles['recette-ode1']).toHaveLength(2);
    expect(loaded.environmentProfiles['recette-ode1'][0]).toEqual({ login: 'u1', password: 'p1' });
  });

  it("getProfilesForEnvironment retourne la liste pour l'env ou []", async () => {
    await saveUserCredentialsStore({
      environmentProfiles: {
        'recette-ode1': [{ login: 'a', password: 'b' }],
      },
    });
    const list = await getProfilesForEnvironment('recette-ode1');
    expect(list).toEqual([{ login: 'a', password: 'b' }]);
    const empty = await getProfilesForEnvironment('other-env');
    expect(empty).toEqual([]);
  });

  it('addOrUpdateProfileForEnvironment ajoute un nouveau profil', async () => {
    await addOrUpdateProfileForEnvironment('recette-ode1', { login: 'user1', password: 'pass1' });
    const list = await getProfilesForEnvironment('recette-ode1');
    expect(list).toEqual([{ login: 'user1', password: 'pass1' }]);
  });

  it('addOrUpdateProfileForEnvironment met à jour le mot de passe si même login', async () => {
    await addOrUpdateProfileForEnvironment('recette-ode1', { login: 'user1', password: 'pass1' });
    await addOrUpdateProfileForEnvironment('recette-ode1', { login: 'user1', password: 'pass2' });
    const list = await getProfilesForEnvironment('recette-ode1');
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ login: 'user1', password: 'pass2' });
  });

  it('addOrUpdateProfileForEnvironment isole les environnements', async () => {
    await saveUserCredentialsStore({ environmentProfiles: {} });
    await addOrUpdateProfileForEnvironment('recette-ode1', { login: 'u', password: 'p1' });
    await addOrUpdateProfileForEnvironment('recette-ode2', { login: 'u', password: 'p2' });
    expect(await getProfilesForEnvironment('recette-ode1')).toEqual([
      { login: 'u', password: 'p1' },
    ]);
    expect(await getProfilesForEnvironment('recette-ode2')).toEqual([
      { login: 'u', password: 'p2' },
    ]);
  });

  it('recordConnection / getLastConnection : la dernière connexion remonte en tête', async () => {
    expect(await getLastConnection()).toBeNull();
    await recordConnection('recette-ode1', 'user1');
    const last = await getLastConnection();
    expect(last?.envId).toBe('recette-ode1');
    expect(last?.login).toBe('user1');
  });

  it('recordConnection plafonne à 3 et garde le plus-récent-d’abord', async () => {
    await recordConnection('recette-ode1', 'a');
    await recordConnection('recette-ode1', 'b');
    await recordConnection('recette-ode1', 'c');
    await recordConnection('recette-ode1', 'd');
    const recents = await getRecentConnections();
    expect(recents).toHaveLength(3);
    expect(recents.map((r) => r.login)).toEqual(['d', 'c', 'b']);
  });

  it('recordConnection déduplique le même combo et le remonte sans doublon', async () => {
    await recordConnection('recette-ode1', 'a', { allApps: false, appIds: ['app1'], appNames: [] });
    await recordConnection('recette-ode1', 'b', { allApps: false, appIds: ['app1'], appNames: [] });
    await recordConnection('recette-ode1', 'a', { allApps: false, appIds: ['app1'], appNames: [] });
    const recents = await getRecentConnections();
    expect(recents.map((r) => r.login)).toEqual(['a', 'b']);
  });

  it('recordConnection : un jeu d’apps ou un login différent crée une entrée distincte', async () => {
    await recordConnection('recette-ode1', 'a', { allApps: false, appIds: ['app1'], appNames: [] });
    await recordConnection('recette-ode1', 'a', { allApps: false, appIds: ['app2'], appNames: [] });
    await recordConnection('recette-ode1', 'b', { allApps: false, appIds: ['app1'], appNames: [] });
    expect(await getRecentConnections()).toHaveLength(3);
  });

  it('connectionSignature est insensible à l’ordre des apps', () => {
    const a = connectionSignature({ envId: 'e', login: 'u', appIds: ['x', 'y'] });
    const b = connectionSignature({ envId: 'e', login: 'u', appIds: ['y', 'x'] });
    expect(a).toBe(b);
  });

  it('migre un store legacy lastConnection vers recentConnections', async () => {
    await saveUserCredentialsStore({
      environmentProfiles: {},
      lastConnection: { envId: 'recette-ode2', login: 'legacy' },
    } as UserCredentialsStore);
    const recents = await getRecentConnections();
    expect(recents).toHaveLength(1);
    expect(recents[0].envId).toBe('recette-ode2');
    expect(recents[0].login).toBe('legacy');
    expect(typeof recents[0].connectedAt).toBe('number');
  });

  it('getLoginRecency retourne le connectedAt max par login, scopé à l’env', async () => {
    await recordConnection('recette-ode1', 'a');
    await recordConnection('recette-ode2', 'b');
    await recordConnection('recette-ode1', 'a', { allApps: true, appIds: [], appNames: [] });
    const recency = await getLoginRecency('recette-ode1');
    expect(recency.has('a')).toBe(true);
    expect(recency.has('b')).toBe(false);
  });
});
