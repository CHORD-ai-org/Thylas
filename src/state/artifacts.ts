/**
 * The Artifacts store: what changed since the page loaded.
 *
 * Seven seeds ship with the page (see data/artifacts.ts); this store holds the
 * session's facts on top of them — artifacts created, sections edited (each edit
 * appends a version), status transitions, tombstones — under the house envelope:
 * versioned key, validated read, caps, seeds untouched.
 */
import { useSyncExternalStore } from 'react';
import {
  ARTIFACTS,
  KIND_SECTIONS,
  type Artifact,
  type ArtifactCover,
  type ArtifactKind,
  type ArtifactSection,
  type ArtifactStatus,
} from '../data/artifacts';
import { sanitizeCover } from '../lib/cover';

const KEY = 'thylas:artifacts:v1';

const MAX_ARTIFACTS = 100;
const MAX_VERSIONS = 50;

export type StoreArtifact = Artifact;

type State = {
  /** Content edits: artifactId → appended versions. */
  edits: Record<string, { v: number; at: number; by: string; note: string }[]>;
  /** Section content overrides: artifactId → sectionId → body. */
  sectionBodies: Record<string, Record<string, string>>;
  statusOverrides: Record<string, ArtifactStatus>;
  added: Artifact[];
  removed: string[];
  log: { id: string; at: number; text: string }[];
};

const EMPTY: State = {
  edits: {},
  sectionBodies: {},
  statusOverrides: {},
  added: [],
  removed: [],
  log: [],
};

const STATUSES: ArtifactStatus[] = ['draft', 'in-review', 'accepted', 'deprecated'];
const KINDS: ArtifactKind[] = ['concept', 'methodology', 'executable', 'product', 'empirical', 'structural', 'external'];

function isArtifact(value: unknown): value is Artifact {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Partial<Artifact>;
  return (
    typeof a.id === 'string' &&
    a.id.startsWith('a-') &&
    typeof a.kind === 'string' &&
    KINDS.includes(a.kind as ArtifactKind) &&
    typeof a.name === 'string' &&
    typeof a.summary === 'string' &&
    typeof a.status === 'string' &&
    STATUSES.includes(a.status as ArtifactStatus) &&
    typeof a.createdAt === 'number' &&
    Array.isArray(a.sections) &&
    a.sections.every((s) => typeof s === 'object' && s !== null && typeof (s as ArtifactSection).body === 'string') &&
    a.sections.length <= 16 &&
    Array.isArray(a.versions)
  );
}

function read(): State {
  if (typeof localStorage === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;
    const p = parsed as Partial<State> & { version?: unknown };
    if (p.version !== 1) return EMPTY;
    const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    const edits: State['edits'] = {};
    if (p.edits && typeof p.edits === 'object') {
      for (const [id, list] of Object.entries(p.edits)) {
        if (Array.isArray(list)) {
          const clean = list.filter(
            (v) => typeof v === 'object' && v !== null && typeof (v as { v?: unknown }).v === 'number' && typeof (v as { note?: unknown }).note === 'string',
          );
          if (clean.length > 0) edits[id] = clean as State['edits'][string];
        }
      }
    }
    const sectionBodies: State['sectionBodies'] = {};
    if (p.sectionBodies && typeof p.sectionBodies === 'object') {
      for (const [id, sections] of Object.entries(p.sectionBodies)) {
        if (sections && typeof sections === 'object') {
          const clean: Record<string, string> = {};
          for (const [sid, body] of Object.entries(sections)) if (typeof body === 'string') clean[sid] = body;
          if (Object.keys(clean).length > 0) sectionBodies[id] = clean;
        }
      }
    }
    const statusOverrides: State['statusOverrides'] = {};
    if (p.statusOverrides && typeof p.statusOverrides === 'object') {
      for (const [id, st] of Object.entries(p.statusOverrides)) {
        if (typeof st === 'string' && STATUSES.includes(st as ArtifactStatus)) statusOverrides[id] = st as ArtifactStatus;
      }
    }
    return {
      edits,
      sectionBodies,
      statusOverrides,
      added: Array.isArray(p.added)
        ? p.added.filter(isArtifact).map((a) => {
            /* Cover is optional and white-listed: a stored hue or symbol we do
               not know is dropped, not rendered. */
            const cover = sanitizeCover(a.cover);
            return cover ? { ...a, cover } : { ...a, cover: undefined };
          })
        : [],
      removed: strList(p.removed).filter((id) => ARTIFACTS.some((a) => a.id === id)),
      log: Array.isArray(p.log)
        ? p.log.filter((d) => typeof d === 'object' && d !== null && typeof (d as { text?: unknown }).text === 'string')
        : [],
    };
  } catch {
    return EMPTY;
  }
}

let snapshot: State = read();
const listeners = new Set<() => void>();

function commit(next: State): void {
  snapshot = next;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, ...snapshot }));
    } catch {
      /* quota: the session keeps working in memory */
    }
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): State => snapshot;

/* ---- reads ---------------------------------------------------------------- */

export function useArtifacts(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function artifactsView(): StoreArtifact[] {
  const list = [...ARTIFACTS, ...snapshot.added]
    .filter((a) => !snapshot.removed.includes(a.id))
    .map((a) => {
      const versions = [...a.versions, ...(snapshot.edits[a.id] ?? [])];
      const sections = a.sections.map((s) => ({
        ...s,
        body: snapshot.sectionBodies[a.id]?.[s.id] ?? s.body,
      }));
      return {
        ...a,
        sections,
        versions: versions.slice(-MAX_VERSIONS),
        status: snapshot.statusOverrides[a.id] ?? a.status,
        updatedAt: versions.length > 0 ? Math.max(a.updatedAt, versions.at(-1)!.at) : a.updatedAt,
      };
    });
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ARTIFACTS);
}

export function artifactById(id: string | undefined): StoreArtifact | undefined {
  if (!id) return undefined;
  return artifactsView().find((a) => a.id === id);
}

export function artifactsLog(): State['log'] {
  return [...snapshot.log].sort((a, b) => b.at - a.at);
}

/** Test seam: the module reads storage once, so a test needs a fresh read. */
/* ---- writes ---------------------------------------------------------------- */

function entry(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function log(text: string): State['log'] {
  return [{ id: entry('d'), at: Date.now(), text }, ...snapshot.log];
}

export function artifactCount(): number {
  return artifactsView().length;
}

/** Creates an artifact from the creation flow: name, kind, first section body. */
export function createArtifact(input: {
  kind: ArtifactKind;
  name: string;
  summary: string;
  firstTitle: string;
  firstBody: string;
  author: string;
  source?: Artifact['source'];
  cover?: ArtifactCover;
}): Artifact {
  const now = Date.now();
  const cover = sanitizeCover(input.cover);
  const artifact: Artifact = {
    id: entry('a'),
    kind: input.kind,
    name: input.name.trim().slice(0, 80) || 'Untitled artifact',
    summary: input.summary.trim().slice(0, 200),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    author: input.author,
    source: input.source ?? 'native',
    sections: KIND_SECTIONS[input.kind].map((title, i) => ({
      id: `s${i + 1}`,
      title,
      body: i === 0 ? input.firstBody : '',
    })),
    relations: [],
    versions: [{ v: 1, at: now, by: input.author, note: 'created' }],
    ...(cover ? { cover } : {}),
  };
  commit({
    ...snapshot,
    added: [...snapshot.added, artifact],
    log: log(`Created ${artifact.name} (${input.kind}).`),
  });
  return artifact;
}

/** Creates an external reference: name, system, location, summary. */
export function createExternalReference(input: {
  system: ExternalSystem;
  location: string;
  name: string;
  summary: string;
  author: string;
}): Artifact {
  const now = Date.now();
  const artifact: Artifact = {
    id: entry('a'),
    kind: 'external',
    name: input.name.trim().slice(0, 80) || 'External reference',
    summary: input.summary.trim().slice(0, 200),
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
    author: input.author,
    source: { system: input.system, location: input.location.trim() },
    sections: KIND_SECTIONS.external.map((title, i) => ({
      id: `s${i + 1}`,
      title,
      body: i === 0 ? input.summary : '',
    })),
    relations: [],
    versions: [{ v: 1, at: now, by: input.author, note: 'referenced' }],
  };
  commit({
    ...snapshot,
    added: [...snapshot.added, artifact],
    log: log(`Referenced ${artifact.name} (${input.system}) — the source stays its system of record.`),
  });
  return artifact;
}

/**
 * Saves a section edit. Content changes append a version — append-only,
 * attributed; old versions are never rewritten.
 */
export function saveSection(artifactId: string, sectionId: string, body: string, by: string): void {
  const current = artifactById(artifactId);
  if (!current) return;
  const section = current.sections.find((s) => s.id === sectionId);
  if (!section || section.body === body) return;
  commit({
    ...snapshot,
    sectionBodies: {
      ...snapshot.sectionBodies,
      [artifactId]: { ...snapshot.sectionBodies[artifactId], [sectionId]: body },
    },
    edits: {
      ...snapshot.edits,
      [artifactId]: [
        ...(snapshot.edits[artifactId] ?? []),
        { v: current.versions.at(-1)!.v + 1, at: Date.now(), by, note: `edited "${section.title}"` },
      ],
    },
    log: log(`Edited "${section.title}" of ${current.name} — v${current.versions.at(-1)!.v + 1}.`),
  });
}

export function setArtifactStatus(artifactId: string, status: ArtifactStatus): void {
  const current = artifactById(artifactId);
  if (!current || current.status === status) return;
  commit({
    ...snapshot,
    statusOverrides: { ...snapshot.statusOverrides, [artifactId]: status },
    log: log(`${current.name} is now ${status}.`),
  });
}

export function removeArtifact(artifactId: string): void {
  const current = artifactById(artifactId);
  if (!current) return;
  const isAdded = snapshot.added.some((a) => a.id === artifactId);
  commit({
    ...snapshot,
    added: isAdded ? snapshot.added.filter((a) => a.id !== artifactId) : snapshot.added,
    removed: isAdded ? snapshot.removed : [...snapshot.removed, artifactId],
    log: log(`Deleted ${current.name}.`),
  });
}

export function resetArtifacts(): void {
  commit(EMPTY);
}

/** Test seam. */
export function __readForTest(): State {
  return read();
}

export type ExternalSystem = 'notion' | 'obsidian' | 'github';
