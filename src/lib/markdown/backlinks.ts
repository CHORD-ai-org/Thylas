/**
 * The reverse index, built from bodies rather than stored. Storing it would mean
 * migrating it, invalidating it, and being wrong about it after a rename;
 * rebuilding it over a few hundred notes costs nothing and cannot drift.
 */
import { resolveLinks } from './links';

export type LinkSource = {
  id: string;
  title: string;
  scope: 'personal' | 'workspace';
  wsId?: string;
  body: string;
};

const scopeKey = (note: LinkSource): string =>
  note.scope === 'personal' ? 'personal' : `ws:${note.wsId ?? ''}`;

/** Titles of the notes this one is allowed to reach: same scope, same workspace.
    Exported because the reader needs the same map to decide between a resolved
    chip and a dashed one — one rule, two callers. */
export function titlesFor(note: LinkSource, notes: LinkSource[]): Map<string, string> {
  return titleIndex(notes, scopeKey(note));
}

function titleIndex(notes: LinkSource[], scope: string): Map<string, string> {
  const index = new Map<string, string>();
  for (const note of notes) {
    if (scopeKey(note) !== scope) continue;
    index.set(note.title.trim().toLowerCase(), note.id);
  }
  return index;
}

/** Notes this body links to, in first-mention order, without duplicates. */
export function outgoing(note: LinkSource, notes: LinkSource[]): string[] {
  const ids = resolveLinks(note.body, titlesFor(note, notes))
    .map((link) => link.id)
    /* A self-link is a note pointing at itself; it is not a backlink, and
       listing it would make every note claim one inbound reference. */
    .filter((id): id is string => id !== null && id !== note.id);
  return [...new Set(ids)];
}

export function buildBacklinks(notes: LinkSource[]): Map<string, string[]> {
  const backlinks = new Map<string, string[]>();
  for (const note of notes) {
    for (const targetId of outgoing(note, notes)) {
      const sources = backlinks.get(targetId) ?? [];
      sources.push(note.id);
      backlinks.set(targetId, sources);
    }
  }
  return backlinks;
}
