/// <reference types="node" />
/**
 * Server-side User state, one JSON file per authenticated user (Phase 2 A1,
 * D-059). Real server persistence, not a browser mock. Kept separate from
 * `server/profile/store.ts` so neither domain overwrites the other.
 *
 * The file store is single-instance by nature. Moving to Postgres later
 * replaces this one module plus a migration; the route does not change.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { USER_DISPLAY_NAME_MAX } from '../../src/lib/user.ts';

export type UserRecord = { displayName: string | null };

export type UserStore = {
  load: (userId: string) => UserRecord;
  save: (userId: string, record: UserRecord) => void;
  root: string;
};

const VERSION = 1;
const EMPTY: UserRecord = { displayName: null };

/** The same id whitelist as the profile store: it decides the file name. */
function safeUserId(userId: string): string | null {
  return /^[A-Za-z0-9_-]{1,80}$/.test(userId) ? userId : null;
}

export function createUserStore(rootDir: string): UserStore {
  const root = isAbsolute(rootDir) ? rootDir : resolve(rootDir);
  return {
    root,
    load(userId) {
      const id = safeUserId(userId);
      if (!id) return { ...EMPTY };
      const file = join(root, `${id}.json`);
      if (!existsSync(file)) return { ...EMPTY };
      try {
        const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
        if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY };
        const p = parsed as Partial<UserRecord> & { version?: unknown };
        if (p.version !== VERSION) return { ...EMPTY };
        return {
          displayName:
            typeof p.displayName === 'string' && p.displayName.trim()
              ? p.displayName.slice(0, USER_DISPLAY_NAME_MAX)
              : null,
        };
      } catch {
        return { ...EMPTY };
      }
    },
    save(userId, record) {
      const id = safeUserId(userId);
      if (!id) return;
      mkdirSync(root, { recursive: true });
      const file = join(root, `${id}.json`);
      const tmp = `${file}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ version: VERSION, ...record }), 'utf8');
      renameSync(tmp, file);
    },
  };
}
