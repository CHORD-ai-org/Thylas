import { describe, expect, it } from 'vitest';
import { routes } from './routes';

/* The route builders are the only place a URL is constructed. If one drifts
   from the router table, every link to that surface breaks silently — which is
   exactly the class of bug this test exists to prevent. */
describe('routes', () => {
  it('builds every workspace-scoped path', () => {
    expect(routes.workspace('ws-1')).toBe('/w/ws-1');
    expect(routes.files('ws-1')).toBe('/w/ws-1/files');
    expect(routes.file('ws-1', 'f-1')).toBe('/w/ws-1/files/f-1');
    expect(routes.boards('ws-1')).toBe('/w/ws-1/boards');
    expect(routes.board('ws-1', 'b-1')).toBe('/w/ws-1/boards/b-1');
    expect(routes.processes('ws-1')).toBe('/w/ws-1/processes');
    expect(routes.run('ws-1', 'r-1')).toBe('/w/ws-1/processes/r-1');
  });

  it('builds global paths', () => {
    expect(routes.overview()).toBe('/overview');
    expect(routes.recently()).toBe('/recently');
    expect(routes.notes()).toBe('/notes');
    expect(routes.note('n-1')).toBe('/notes/n-1');
    expect(routes.account()).toBe('/account/profile');
    expect(routes.account('usage')).toBe('/account/usage');
  });

  it('never produces a double slash, which is how a route silently stops matching', () => {
    const all = [
      routes.files('ws-1'),
      routes.file('ws-1', 'f-1'),
      routes.board('ws-1', 'b-1'),
      routes.run('ws-1', 'r-1'),
      routes.note('n-1'),
      routes.account('plan'),
    ];
    for (const path of all) expect(path).not.toMatch(/\/\//);
  });
});
