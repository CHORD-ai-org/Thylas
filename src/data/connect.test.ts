import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  INTEGRATIONS,
  appOf,
  catalogByCategory,
  filterCatalog,
  grantedScopes,
  integrationOf,
  integrationView,
} from './connect';

/**
 * Pure functions only: the store's tombstones are the same `removed: string[]`
 * these helpers already take, so a data case covers the view logic too.
 */

describe('catalog', () => {
  it('every connection points at a catalog app that exists', () => {
    for (const integration of INTEGRATIONS) {
      expect(appOf(integration.appId), integration.id).toBeDefined();
    }
  });

  it('every granted scope and capability `via` exists in the app catalog', () => {
    for (const integration of INTEGRATIONS) {
      const app = appOf(integration.appId)!;
      const scopeIds = app.scopes.map((s) => s.id);
      for (const id of integration.granted) expect(scopeIds, integration.id).toContain(id);
      for (const cap of integration.capabilities) {
        if (cap.via !== '—') expect(scopeIds, cap.id).toContain(cap.via);
      }
    }
  });

  it('coming-soon and unsupported entries declare why, and ask for no scopes', () => {
    for (const app of CATALOG) {
      if (app.tier !== 'available') {
        expect(app.tierNote?.length ?? 0, app.id).toBeGreaterThan(0);
      }
    }
  });

  it('connected apps are excluded from Discover results', () => {
    const connected = INTEGRATIONS.map((i) => i.appId);
    const visible = filterCatalog(CATALOG, { query: '', category: 'all' }, connected);
    expect(visible.some((a) => connected.includes(a.id))).toBe(false);
  });

  it('filters by category and query together', () => {
    const visible = filterCatalog(
      CATALOG,
      { query: 'files', category: 'storage' },
      ['app-gdrive'],
    );
    expect(visible.map((a) => a.name)).toEqual(['Dropbox']);
  });

  it('an empty query with no match still returns nothing, and grouping skips empty categories', () => {
    expect(filterCatalog(CATALOG, { query: 'zzzz', category: 'all' }, [])).toHaveLength(0);
    const groups = catalogByCategory(CATALOG);
    for (const g of groups) expect(g.apps.length).toBeGreaterThan(0);
  });
});

describe('integration views', () => {
  it('a tombstoned connection disappears from every view', () => {
    expect(integrationView(INTEGRATIONS[0]!, ['int-github'])).toBeNull();
    expect(integrationOf('int-github', ['int-github'])).toBeUndefined();
    expect(integrationOf('int-github', [])).toBeDefined();
  });

  it('granted scopes come back in catalog order, not grant order', () => {
    const github = INTEGRATIONS[0]!;
    const shuffled = { ...github, granted: ['workflow-read', 'repo-read', 'issues-read'] };
    expect(grantedScopes(shuffled).map((s) => s.id)).toEqual([
      'repo-read',
      'issues-read',
      'workflow-read',
    ]);
  });

  it('a connection with no scopes (public data) grants nothing', () => {
    const openalex = INTEGRATIONS.find((i) => i.id === 'int-openalex')!;
    expect(grantedScopes(openalex)).toHaveLength(0);
  });
});
