import { mkdtemp, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { discoverApps } from '../../../src/core/apps/AppDiscovery';
import { AppDiscoveryError } from '../../../src/utils/errors';

describe('AppDiscovery', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'dev-auth-fetcher-test-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('retourne une liste vide si aucun dossier frontend', async () => {
    await mkdir(join(tempRoot, 'not-an-app'), { recursive: true });
    const apps = await discoverApps(tempRoot);
    expect(apps).toEqual([]);
  });

  it('détecte les applications avec un dossier frontend', async () => {
    await mkdir(join(tempRoot, 'app1', 'frontend'), { recursive: true });
    await mkdir(join(tempRoot, 'app2', 'frontend'), { recursive: true });
    const apps = await discoverApps(tempRoot);
    expect(apps).toHaveLength(2);
    const names = apps.map((a) => a.name).sort();
    expect(names).toEqual(['app1', 'app2']);
    expect(apps[0].envPath).toContain('frontend');
    expect(apps[0].envPath).toContain('.env');
  });

  it("lance AppDiscoveryError si le répertoire n'existe pas", async () => {
    await expect(discoverApps(join(tempRoot, 'nonexistent'))).rejects.toThrow(AppDiscoveryError);
  });

  it('détecte les applications sous entcore (entcore/{application}/frontend)', async () => {
    await mkdir(join(tempRoot, 'entcore', 'app1', 'frontend'), { recursive: true });
    await mkdir(join(tempRoot, 'entcore', 'app2', 'frontend'), { recursive: true });
    const apps = await discoverApps(tempRoot);
    expect(apps).toHaveLength(2);
    const app1 = apps.find((a) => a.id === 'entcore/app1');
    const app2 = apps.find((a) => a.id === 'entcore/app2');
    expect(app1).toBeDefined();
    expect(app2).toBeDefined();
    expect(app1!.name).toBe('app1');
    expect(app1!.envPath).toContain('entcore');
    expect(app1!.envPath).toContain('app1');
    expect(app1!.envPath).toContain('frontend');
    expect(app1!.envPath).toContain('.env');
  });

  it('détecte à la fois les apps à la racine et sous entcore (ids distincts)', async () => {
    await mkdir(join(tempRoot, 'app1', 'frontend'), { recursive: true });
    await mkdir(join(tempRoot, 'entcore', 'app1', 'frontend'), { recursive: true });
    const apps = await discoverApps(tempRoot);
    expect(apps).toHaveLength(2);
    const rootApp = apps.find((a) => a.id === 'app1');
    const entcoreApp = apps.find((a) => a.id === 'entcore/app1');
    expect(rootApp).toBeDefined();
    expect(entcoreApp).toBeDefined();
    expect(rootApp!.name).toBe('app1');
    expect(entcoreApp!.name).toBe('app1');
    expect(rootApp!.path).not.toContain('entcore');
    expect(entcoreApp!.path).toContain('entcore');
  });
});
