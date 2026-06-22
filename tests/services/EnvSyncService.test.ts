import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { saveUserCredentialsStore } from '../../src/config/credentialsStore.js';
import type { AuthCredentials, AuthCookies, IAuthClient } from '../../src/core/auth/AuthClient.js';
import { EnvSyncService } from '../../src/services/EnvSyncService.js';
import { readEnvFile } from '../../src/utils/envFile.js';
import { AuthError } from '../../src/utils/errors.js';

/** Faux client d'auth : enregistre les arguments reçus et renvoie des cookies fixes. */
class FakeAuthClient implements IAuthClient {
  calls: Array<{ envUrl: string; credentials: AuthCredentials }> = [];

  constructor(private readonly result: AuthCookies | Error) {}

  async loginAndGetCookies(envUrl: string, credentials: AuthCredentials): Promise<AuthCookies> {
    this.calls.push({ envUrl, credentials });
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

describe.sequential('EnvSyncService.runInteractive', () => {
  let tempDir: string;
  let appsRoot: string;
  let appEnvPath: string;
  let originalCwd: string;

  const ENV_ID = 'recette-test';
  const ENV_URL = 'https://recette-test.example.com/';
  const LOGIN = 'me';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'env-sync-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
    process.env.DEV_AUTH_USER = 'test-user';

    // config/app.config.json + config/environments/<env>.json
    await mkdir(join(tempDir, 'config', 'environments'), { recursive: true });
    appsRoot = join(tempDir, 'apps');
    await writeFile(
      join(tempDir, 'config', 'app.config.json'),
      JSON.stringify({ appsRoot, defaultEnvironment: ENV_ID }, null, 2)
    );
    await writeFile(
      join(tempDir, 'config', 'environments', `${ENV_ID}.json`),
      JSON.stringify({ id: ENV_ID, label: 'Recette Test', url: ENV_URL }, null, 2)
    );

    // une app détectable (apps/myapp/frontend) avec un .env existant à préserver
    const frontendDir = join(appsRoot, 'myapp', 'frontend');
    await mkdir(frontendDir, { recursive: true });
    appEnvPath = join(frontendDir, '.env');
    await writeFile(appEnvPath, 'EXISTING=keepme\n');

    // profil enregistré pour éviter tout prompt de mot de passe
    await saveUserCredentialsStore({
      environmentProfiles: { [ENV_ID]: [{ login: LOGIN, password: 'secret', role: 'Enseignant' }] },
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    delete process.env.DEV_AUTH_USER;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('authentifie et injecte les cookies dans le .env de l’app (sans prompt)', async () => {
    const client = new FakeAuthClient({ xsrfToken: 'xsrf-123', sessionId: 'sess-456' });
    const service = new EnvSyncService(client);

    await service.runInteractive({ env: ENV_ID, login: LOGIN, apps: ['myapp'], skipConfirm: true });

    // le client a été appelé avec l'URL et les credentials du profil enregistré
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].envUrl).toBe(ENV_URL);
    expect(client.calls[0].credentials).toEqual({ login: LOGIN, password: 'secret' });

    // le .env contient les clés VITE_* et préserve l'existant
    const env = await readEnvFile(appEnvPath);
    expect(env.VITE_XSRF_TOKEN).toBe('xsrf-123');
    expect(env.VITE_ONE_SESSION_ID).toBe('sess-456');
    expect(env.VITE_RECETTE).toBe(ENV_URL);
    expect(env.EXISTING).toBe('keepme');
  });

  it("ne touche pas au .env si l'authentification échoue", async () => {
    const client = new FakeAuthClient(new AuthError('bad credentials'));
    const service = new EnvSyncService(client);

    await expect(
      service.runInteractive({ env: ENV_ID, login: LOGIN, apps: ['myapp'], skipConfirm: true })
    ).rejects.toThrow('bad credentials');

    const env = await readEnvFile(appEnvPath);
    expect(env).toEqual({ EXISTING: 'keepme' });
  });

  it('abandonne proprement sur un environnement inconnu', async () => {
    const client = new FakeAuthClient({ xsrfToken: 'x', sessionId: 's' });
    const service = new EnvSyncService(client);

    await service.runInteractive({
      env: 'does-not-exist',
      login: LOGIN,
      apps: ['myapp'],
      skipConfirm: true,
    });

    expect(client.calls).toHaveLength(0);
    const env = await readEnvFile(appEnvPath);
    expect(env).toEqual({ EXISTING: 'keepme' });
  });
});
