/* Domain types. One place, no per-feature type files.
   These describe the UI's own model. Wire types for WAM would live in
   services/wam/types.ts once a contract exists — nothing here is that. */

import type { FileKind, Id } from '../lib/types';
import type { Tab, TabKind, TabType } from '../lib/tabs';

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
  username: string;
  accountId: string;
  email: string;
  initials: string;
  plan: string;
  role: string;
  memberSince: string;
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

/* A note is a Markdown document. Blocks are a rendering artifact, not storage:
   see lib/markdown/blocks.ts. Keeping one representation means the reader and
   the editor cannot disagree about what the document is. */
export type Note = {
  id: Id;
  title: string;
  scope: 'personal' | 'workspace';
  wsId?: Id;
  body: string;
  /** Bumped on every successful save; the conflict detector, not a timestamp. */
  version: number;
  updatedAt: number;
};

export type NoteIndexEntry = {
  id: Id;
  title: string;
  scope: 'personal' | 'workspace';
  wsId?: Id;
  updatedAt: number;
};

/* The shape the six sample notes were authored in, before the store existed.
   Kept only so they can be converted (data/note-seed.ts) instead of retyped.
   Nothing writes it and no component reads it. */
export type LegacyBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string };

export type LegacyNote = {
  id: Id;
  title: string;
  scope: 'personal' | 'workspace';
  wsId?: Id;
  updated: string;
  minutes: number;
  refs: Reference[];
  body: LegacyBlock[];
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

/* The five fills the canvas can render. Declared here (rather than imported
   from the board page) so `data/` stays the root of the domain model; the page
   narrows this union structurally. */
export type BoardColor = 'plain' | 'sage' | 'amber' | 'clay' | 'stone';

export type BoardSection = {
  id: Id;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: BoardColor;
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
  color?: BoardColor;
  folded?: boolean;
  ref?: string;
  live?: { runLabel: string; note: string };
};

export type BoardEdge = {
  from: Id;
  to: Id;
  label: string;
  fromSide?: 't' | 'r' | 'b' | 'l';
  toSide?: 't' | 'r' | 'b' | 'l';
  shape?: 'curve' | 'ortho';
  direction?: 'none' | 'one' | 'both';
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

/* Tab shapes are pure and now live in lib/tabs.ts alongside the functions
   that operate on them. Re-exported here so the domain module stays the single
   entry point for screens that only need types. The dead 'settings' tab type
   was removed in SP-03b: no route, no surface, no link ever created one. */
export type { Tab, TabKind, TabType };
