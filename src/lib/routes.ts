import type { Id } from '../data/types';

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
  workspaceSettings: (wsId: Id) => `/w/${wsId}/settings`,
  notes: () => '/notes',
  note: (noteId: Id) => `/notes/${noteId}`,
  account: (section = 'profile') => `/account/${section}`,
};
