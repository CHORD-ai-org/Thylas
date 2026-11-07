/* Domain types. One place, no per-feature type files.
   These describe the UI's own model. Wire types for WAM would live in
   services/wam/types.ts once a contract exists — nothing here is that. */

import type { FileKind, Id } from '../lib/types';

export type { FileKind, Id };

export type WorkspaceScope = 'personal' | 'org';

export type Workspace = {
  id: Id;
  name: string;
  scope: WorkspaceScope;
  role?: 'owner' | 'admin' | 'member';
  members?: number;
  counts: { files: number; boards: number; processes: number; notes: number };
};

export type User = {
  name: string;
  email: string;
  initials: string;
  plan: string;
  role: string;
};


export type Source =
  | { kind: 'uploaded' }
  | { kind: 'imported' }
  | { kind: 'produced'; runId: Id; runLabel: string };

export type Reference = {
  kind: 'file' | 'note' | 'board' | 'process';
  id: Id;
  label: string;
  meta?: string;
};

export type FileItem = {
  id: Id;
  wsId: Id;
  folderId: Id | null;
  name: string;
  kind: FileKind;
  size: string;
  updated: string;
  source: Source;
  usedBy: Reference[];
};

export type Folder = {
  id: Id;
  wsId: Id;
  name: string;
};

export type NoteBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string };

export type Note = {
  id: Id;
  title: string;
  scope: 'personal' | 'workspace';
  wsId?: Id;
  updated: string;
  minutes: number;
  refs: Reference[];
  body: NoteBlock[];
};

export type RunState =
  | 'queued'
  | 'running'
  | 'needs_input'
  | 'succeeded'
  | 'failed'
  | 'stopped';

export type RunAction = 'pause' | 'resume' | 'stop' | 'answer' | 'approve' | 'rerun';

export type PlanStep = {
  n: string;
  text: string;
  note?: string;
  changed?: boolean;
};

export type RunEvent = {
  t: string;
  text: string;
  meta?: string;
  kind?: 'tool' | 'checkpoint' | 'artifact' | 'state';
};

export type Process = {
  id: Id;
  wsId: Id;
  name: string;
  type: 'experiment' | 'task' | 'operation' | 'brainstorm';
  state: RunState;
  activity: string;
  credits: number;
  outputs: number;
  started: string;
  intent: string;
  refs: Reference[];
  plan: PlanStep[];
  planNote?: string;
  events: RunEvent[];
  artifacts: { kind: 'file' | 'note' | 'board'; label: string; meta: string; id?: Id }[];
  capabilities: RunAction[];
};

export type BoardSection = {
  id: Id;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tint: string;
};

export type BoardCard = {
  id: Id;
  sectionId: Id;
  x: number;
  y: number;
  w: number;
  title: string;
  eyebrow: string;
  lines: string[];
  ref?: string;
  live?: { runLabel: string; note: string };
};

export type BoardEdge = {
  from: Id;
  to: Id;
  label: string;
};

export type Board = {
  id: Id;
  wsId: Id;
  name: string;
  updated: string;
  cards: number;
  results: number;
  sections: BoardSection[];
  boardCards: BoardCard[];
  edges: BoardEdge[];
};

export type RecentKind = 'file' | 'note' | 'board' | 'process';

export type RecentItem = {
  kind: RecentKind;
  id: Id;
  label: string;
  wsId: Id;
  when: string;
  state?: RunState;
  route: string;
};

export type TabKind = 'room' | 'object';

export type TabType = 'files' | 'boards' | 'processes' | 'file' | 'board' | 'run' | 'note' | 'settings';

export type Tab = {
  id: string;
  kind: TabKind;
  type: TabType;
  label: string;
  path: string;
  live?: boolean;
  unsaved?: boolean;
};
