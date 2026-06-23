import { describe, it, expect } from 'vitest';

import { parseEnvContent, mergeEnv, formatEnvContent } from '../../src/utils/envFile.js';

describe('parseEnvContent', () => {
  it('parse des lignes KEY=value', () => {
    const content = 'FOO=bar\nBAZ=qux\n';
    expect(parseEnvContent(content)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignore les commentaires et lignes vides', () => {
    const content = '# comment\n\nFOO=bar\n# autre\nBAZ=qux';
    expect(parseEnvContent(content)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('déquote les valeurs entre guillemets', () => {
    const content = 'FOO="hello world"\nBAZ=\'single\'';
    expect(parseEnvContent(content)).toEqual({ FOO: 'hello world', BAZ: 'single' });
  });

  it('retourne un objet vide pour une chaîne vide', () => {
    expect(parseEnvContent('')).toEqual({});
  });
});

describe('mergeEnv', () => {
  it('fusionne existing et patch', () => {
    const existing = { A: '1', B: '2' };
    const patch = { B: 'overridden', C: '3' };
    expect(mergeEnv(existing, patch)).toEqual({ A: '1', B: 'overridden', C: '3' });
  });
});

describe('formatEnvContent', () => {
  it('formate un objet en lignes KEY=value', () => {
    const values = { VITE_XSRF_TOKEN: 'abc', VITE_ONE_SESSION_ID: 'xyz' };
    const out = formatEnvContent(values);
    expect(out).toContain('VITE_XSRF_TOKEN="abc"');
    expect(out).toContain('VITE_ONE_SESSION_ID="xyz"');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('ajoute les commentaires en en-tête', () => {
    const values = { FOO: 'bar' };
    const out = formatEnvContent(values, ['# Connected as: user', 'Date: 2025']);
    expect(out).toContain('# Connected as: user');
    expect(out).toContain('# Date: 2025');
    expect(out).toContain('FOO="bar"');
  });
});
