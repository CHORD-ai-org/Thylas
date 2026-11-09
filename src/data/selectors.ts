import { BOARDS, FILES, FOLDERS, PROCESSES, RECENT } from './mock';
import type { Board, FileItem, Folder, Process, RunState, Workspace } from './types';
import type { Tone } from '../lib/tone';
import { liveIds, listWorkspaces } from '../state/workspaces';

/* Every read below crosses the same gate. A workspace can be deleted at
   runtime, and its files, boards, runs and folders are still in the sample
   data; without this filter a deleted workspace's objects would keep appearing
   in Recently, in the palette, and behind an open tab. */
const alive = (wsId: string | undefined): boolean =>
  wsId !== undefined && liveIds().has(wsId);

export const workspaces = (): Workspace[] => listWorkspaces();

export function getWorkspace(id: string | undefined): Workspace | undefined {
  return listWorkspaces().find((w) => w.id === id);
}

export function foldersIn(wsId: string): Folder[] {
  return alive(wsId) ? FOLDERS.filter((f) => f.wsId === wsId) : [];
}

export function filesIn(wsId: string): FileItem[] {
  return alive(wsId) ? FILES.filter((f) => f.wsId === wsId) : [];
}

export function filesInFolder(wsId: string, folderId: string | null): FileItem[] {
  return alive(wsId) ? FILES.filter((f) => f.wsId === wsId && f.folderId === folderId) : [];
}

export function getFile(id: string | undefined): FileItem | undefined {
  const file = FILES.find((f) => f.id === id);
  return file && alive(file.wsId) ? file : undefined;
}

export function boardsIn(wsId: string): Board[] {
  return alive(wsId) ? BOARDS.filter((b) => b.wsId === wsId) : [];
}

export function getBoard(id: string | undefined): Board | undefined {
  const board = BOARDS.find((b) => b.id === id);
  return board && alive(board.wsId) ? board : undefined;
}

export function processesIn(wsId: string): Process[] {
  return alive(wsId) ? PROCESSES.filter((p) => p.wsId === wsId) : [];
}

/** Runs waiting on a person, across every workspace. Overview owns the only
    cross-workspace list in the app; keeping the filter here means the lede and
    the "Needs you" rows can never disagree about what counts. */
export function needsInput(): Process[] {
  return PROCESSES.filter((p) => p.state === 'needs_input' && alive(p.wsId));
}

export function getProcess(id: string | undefined): Process | undefined {
  const run = PROCESSES.find((p) => p.id === id);
  return run && alive(run.wsId) ? run : undefined;
}

export function recent(): typeof RECENT {
  return RECENT.filter((item) => alive(item.wsId));
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

