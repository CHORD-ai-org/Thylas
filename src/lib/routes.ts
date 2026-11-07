import type { Id } from './types';

export const routes = {
  root: () => '/',
  overview: () => '/overview',
  recently: () => '/recently',
  workspace: (wsId: Id) => `/w/${wsId}`,
  files: (wsId: Id) => `/w/${wsId}/files`,
  file: (wsId: Id, fileId: Id) => `/w/${wsId}/files/${fileId}`,
  boards: (wsId: Id) => `/w/${wsId}/boards`,
  board: (wsId: Id, boardId: Id) => `/w/${wsId}/boards/${boardId}`,
  processes: (wsId: Id) => `/w/${wsId}/processes`,
  run: (wsId: Id, runId: Id) => `/w/${wsId}/processes/${runId}`,
  notes: () => '/notes',
  note: (noteId: Id) => `/notes/${noteId}`,
  account: (section = 'profile') => `/account/${section}`,
};

export type WorkspaceRoom = 'files' | 'boards' | 'processes';

/** Which room of a workspace the current path belongs to, if any. An object
    detail path belongs to its room too — switching scope must never carry an
    object tab from workspace A into workspace B. */
export function workspaceRoom(pathname: string): WorkspaceRoom | null {
  const match = /^\/w\/[^/]+\/(files|boards|processes)(?:\/|$)/.exec(pathname);
  return (match?.[1] as WorkspaceRoom | undefined) ?? null;
}

/** Switching workspace keeps the room. From an object detail it lands on the
    room index, which is the only honest target: the object does not exist in
    the other workspace. */
export function switchWorkspace(pathname: string, wsId: Id): string {
  const room = workspaceRoom(pathname) ?? 'files';
  return `/w/${wsId}/${room}`;
}
