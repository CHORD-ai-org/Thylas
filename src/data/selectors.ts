import { BOARDS, FILES, FOLDERS, NOTES, PROCESSES, RECENT, WORKSPACES } from './mock';
import type { Board, FileItem, Folder, Note, Process, RunState, Workspace } from './types';
import type { Tone } from '../lib/tone';

export const workspaces = (): Workspace[] => WORKSPACES;

export function getWorkspace(id: string | undefined): Workspace | undefined {
  return WORKSPACES.find((w) => w.id === id);
}

export function foldersIn(wsId: string): Folder[] {
  return FOLDERS.filter((f) => f.wsId === wsId);
}

export function filesIn(wsId: string): FileItem[] {
  return FILES.filter((f) => f.wsId === wsId);
}

export function filesInFolder(wsId: string, folderId: string | null): FileItem[] {
  return FILES.filter((f) => f.wsId === wsId && f.folderId === folderId);
}

export function getFile(id: string | undefined): FileItem | undefined {
  return FILES.find((f) => f.id === id);
}

export function notes(): Note[] {
  return NOTES;
}

export function getNote(id: string | undefined): Note | undefined {
  return NOTES.find((n) => n.id === id);
}

export function notesFor(wsId: string): Note[] {
  return NOTES.filter((n) => n.wsId === wsId);
}

export function boardsIn(wsId: string): Board[] {
  return BOARDS.filter((b) => b.wsId === wsId);
}

export function getBoard(id: string | undefined): Board | undefined {
  return BOARDS.find((b) => b.id === id);
}

export function processesIn(wsId: string): Process[] {
  return PROCESSES.filter((p) => p.wsId === wsId);
}

export function getProcess(id: string | undefined): Process | undefined {
  return PROCESSES.find((p) => p.id === id);
}

export function recent(): typeof RECENT {
  return RECENT;
}

export const STATE_LABEL: Record<RunState, string> = {
  queued: 'queued',
  running: 'running',
  needs_input: 'needs you',
  succeeded: 'done',
  failed: 'failed',
  stopped: 'stopped',
};

export const STATE_TONE: Record<RunState, Tone> = {
  queued: 'idle',
  running: 'live',
  needs_input: 'warn',
  succeeded: 'ok',
  failed: 'error',
  stopped: 'idle',
};

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Distinct note bodies are counted as authored "reading minutes" in the list meta. */
export function noteMeta(n: Note): string {
  return `${n.scope === 'personal' ? 'Personal' : (getWorkspace(n.wsId)?.name ?? 'Workspace')} · ${n.updated}`;
}
