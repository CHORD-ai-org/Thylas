import { describe, expect, it } from 'vitest';
import { routes, switchWorkspace, workspaceRoom } from './routes';

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

  it('names the room behind a path, including object details', () => {
    expect(workspaceRoom('/w/ws-1/files')).toBe('files');
    expect(workspaceRoom('/w/ws-1/files/f-1')).toBe('files');
    expect(workspaceRoom('/w/ws-1/boards/b-1')).toBe('boards');
    expect(workspaceRoom('/w/ws-1/processes/r-1')).toBe('processes');
    expect(workspaceRoom('/notes/n-1')).toBeNull();
    expect(workspaceRoom('/w/ws-1/settings')).toBeNull();
  });

  it('switching workspace keeps the room and never carries an object id', () => {
    expect(switchWorkspace('/w/ws-research/processes', 'ws-onda')).toBe('/w/ws-onda/processes');
    expect(switchWorkspace('/w/ws-research/files/f-1', 'ws-onda')).toBe('/w/ws-onda/files');
    expect(switchWorkspace('/w/ws-research/boards/b-1', 'ws-onda')).toBe('/w/ws-onda/boards');
    expect(switchWorkspace('/notes/n-1', 'ws-onda')).toBe('/w/ws-onda/files');
    expect(switchWorkspace('/overview', 'ws-onda')).toBe('/w/ws-onda/files');
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
