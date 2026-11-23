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
    return 'unknown';
  };
};
