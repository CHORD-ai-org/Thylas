import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createConnectorEntries, listLocalFolderEntries, normalizeConnectionLocator } from './connectors.ts';

/**
 * Detail-page browsing (08 P0-3): listing one level of a connected folder.
 * The traversal guard is the security boundary — `subpath` may never escape
 * the connection root.
 */
let root = '';

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'thylas-conn-'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'README.md'), '# hi');
  await writeFile(join(root, 'docs', 'a.md'), 'a');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('listLocalFolderEntries', () => {
  it('lists one level with dirs first', async () => {
    const entries = await listLocalFolderEntries(root, '');
    expect(entries.map((e) => `${e.kind}:${e.name}`)).toEqual(['dir:docs', 'file:README.md']);
  });

  it('lists a subfolder', async () => {
    const entries = await listLocalFolderEntries(root, 'docs');
    expect(entries).toEqual([{ name: 'a.md', kind: 'file' }]);
  });

  it('refuses a path that escapes the root', async () => {
    await expect(listLocalFolderEntries(root, '../')).rejects.toThrow(/escapes/);
    await expect(listLocalFolderEntries(root, 'docs/../../')).rejects.toThrow(/escapes/);
  });
});

describe('createConnectorEntries', () => {
  it('answers null for kinds without a listing connector', async () => {
    const entries = createConnectorEntries();
    expect(await entries('github-repo', 'owner/repo', '')).toBeNull();
    expect(await entries('local-folder', root, '')).toHaveLength(2);
  });

  it('still normalizes github locators', () => {
    expect(normalizeConnectionLocator('github-repo', 'https://github.com/a/b.git')).toBe('a/b');
  });
});
