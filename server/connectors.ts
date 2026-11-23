/// <reference types="node" />
/**
 * Connector probes (P0-3). A probe answers one question: is this locator
 * currently resolvable? It never copies, syncs or indexes the resource — the
 * connection only registers a reference (引用不复制).
 *
 * Only `local-folder` resolves today; other kinds stay `unknown` until their
 * connectors land. Route tests inject their own probe, so this module is the
 * only place that touches the filesystem.
 */
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { ConnectionHealth, ConnectionKind } from '../src/lib/projects.ts';

export type LocatorProbe = (kind: ConnectionKind, locator: string) => Promise<ConnectionHealth>;

/**
 * P1-3: one locator vocabulary per kind. `github-repo` accepts either the
 * `owner/repo` shorthand or the full URL and stores `owner/repo`, so the same
 * repository cannot arrive twice under two spellings (duplicate detection is
 * the unique index on (project, kind, locator)).
 */
export function normalizeConnectionLocator(kind: ConnectionKind, locator: string): string {
  const trimmed = locator.trim();
  if (kind !== 'github-repo') return trimmed;
  const match =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/.exec(trimmed) ??
    /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed);
  const owner = match?.[1];
  const repo = match?.[2];
  return match && owner && repo ? `${owner}/${repo.replace(/\.git$/, '')}` : trimmed;
}

/** A well-formed `owner/repo` is `unknown` until a network probe exists —
    "looks right" must never be reported as "verified". */
export function isValidGithubRepo(locator: string): boolean {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(locator);
}

export const probeLocalFolder: LocatorProbe = async (_kind, locator) => {
  if (!isAbsolute(locator)) return 'broken';
  try {
    const stats = await stat(locator);
    return stats.isDirectory() ? 'ok' : 'broken';
  } catch {
    return 'broken';
  }
};

export const createConnectorProbe = (): LocatorProbe => {
  return async (kind, locator) => {
    if (kind === 'local-folder') return probeLocalFolder(kind, locator);
    if (kind === 'github-repo') return isValidGithubRepo(locator) ? 'unknown' : 'broken';
    return 'unknown';
  };
};
