import { BOARDS, FILES, FOLDERS, PROCESSES, RECENT, WORKSPACES } from './mock';
import type { Board, FileItem, Folder, Process, RunState, Workspace } from './types';
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

export function boardsIn(wsId: string): Board[] {
  return BOARDS.filter((b) => b.wsId === wsId);
}

export function getBoard(id: string | undefined): Board | undefined {
  return BOARDS.find((b) => b.id === id);
}

export function processesIn(wsId: string): Process[] {
  return PROCESSES.filter((p) => p.wsId === wsId);
}

/** Runs waiting on a person, across every workspace. Overview owns the only
    cross-workspace list in the app; keeping the filter here means the lede and
    the "Needs you" rows can never disagree about what counts. */
export function needsInput(): Process[] {
  return PROCESSES.filter((p) => p.state === 'needs_input');
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

/** The Overview lede. Kept next to `needsInput()` so the zero state cannot be
    a sentence that only exists in a screenshot: it is a tested pure function. */
export function pendingLede(count: number): string {
  const tail = 'Pick up the thread you dropped, or describe something new.';
  if (count === 0) return `Nothing needs you right now. ${tail}`;
  return `${plural(count, 'process', 'processes')} ${count === 1 ? 'needs' : 'need'} a decision. ${tail}`;
}

