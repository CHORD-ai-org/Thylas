/// <reference types="node" />
/**
 * Profile Initialization API (Phase 3). Session first (401) → user-scoped
 * store → write: authorization is enforced here, never by hiding a control in
 * the UI. Per-source failures never invalidate results from other sources.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  PROFILE_PATH,
  isCandidatePatch,
  isSourceBody,
  profileFailure,
  profileStatusFor,
  type ProfileErrorKind,
  type ProfileState,
} from '../../src/lib/profile.ts';
import { sessionFailure, statusForSession, type SessionUser } from '../../src/lib/session.ts';
import { readBody, sendJson } from '../http.ts';
import type { ServerConfig } from '../config.ts';
import type { SessionSource } from '../session/source.ts';
import type { FetchedPage, PageFetcher, AddressLookup } from '../profile/fetch.ts';
import { fetchPublicPage } from '../profile/fetch.ts';
import { createDeepSeekExtractor, extractPageItems, type LlmCaller } from '../profile/extract.ts';
import {
  addCandidates,
  addSource,
  commitCandidates,
  createProfileStore,
  markSource,
  removeSource,
  resetSession,
  reviewCandidate,
  startSession,
  type ProfileStore,
} from '../profile/store.ts';

export type ProfileRouter = (req: IncomingMessage, res: ServerResponse, path: string) => void;

export type ProfileDeps = {
  store: ProfileStore;
  sessionSource: SessionSource;
  config: ServerConfig;
  llm?: LlmCaller;
  fetcher?: PageFetcher;
  lookupAddresses?: AddressLookup;
  now?: () => string;
};

const ok = (res: ServerResponse, state: ProfileState): void => sendJson(res, 200, { ok: true, state });

function fail(res: ServerResponse, kind: ProfileErrorKind, message: string, retryable = false): void {
  sendJson(res, profileStatusFor(kind), profileFailure(kind, message, retryable));
}

function unauthorized(res: ServerResponse): void {
  sendJson(res, statusForSession('unauthorized'), sessionFailure('unauthorized', 'Sign in to initialize your profile.'));
}

async function body(req: IncomingMessage, res: ServerResponse): Promise<unknown | undefined> {
  const raw = await readBody(req);
  if (raw === null) {
    fail(res, 'contract', 'The request body is too large.');
    return undefined;
  }
  try {
    return JSON.parse(raw || '{}') as unknown;
  } catch {
    fail(res, 'contract', 'The request body is not JSON.');
    return undefined;
  }
}

/** Restricted platforms: no fake integration — the source is recorded as-is. */
function isUnsupportedSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)linkedin\.com$/.test(host);
  } catch {
    return false;
  }
}

export function createProfileRouter(deps: ProfileDeps): ProfileRouter {
  const llm: LlmCaller =
    deps.llm ??
    createDeepSeekExtractor({
      apiKey: deps.config.apiKey,
      baseUrl: deps.config.baseUrl,
      model: deps.config.model,
      timeoutMs: deps.config.timeoutMs,
    });
  const now = deps.now ?? (() => new Date().toISOString());

  return (req, res, path) => {
    void (async () => {
      const session: SessionUser | null = await deps.sessionSource.read(req);
      if (!session) {
        unauthorized(res);
        return;
      }
      const userId = session.id;
      let state = deps.store.load(userId);
      const commit = (next: ProfileState) => {
        state = next;
        deps.store.save(userId, state);
      };
      const method = req.method ?? 'GET';

      if (path === `${PROFILE_PATH}/state` && method === 'GET') return ok(res, state);

      if (path === `${PROFILE_PATH}/sources` && method === 'POST') {
        const parsed = await body(req, res);
        if (parsed === undefined) return;
        if (!isSourceBody(parsed)) {
          fail(res, 'contract', 'A source needs a supported type and a public http(s) URL.');
          return;
        }
        if (isUnsupportedSource(parsed.url)) {
          fail(res, 'unsupported', 'LinkedIn does not allow public retrieval here. Provide a public export or another source.');
          return;
        }
        const next = addSource(state, { type: parsed.type, url: parsed.url, at: now() });
        if (!next.source) {
          fail(res, 'contract', 'That source is already in this session.');
          return;
        }
        commit(startSession(next.state, now()));
        return ok(res, deps.store.load(userId));
      }

      const sourceMatch = path.match(new RegExp(`^${PROFILE_PATH}/sources/([^/]+)$`));
      if (sourceMatch && method === 'DELETE') {
        commit(removeSource(state, decodeURIComponent(sourceMatch[1]!)));
        return ok(res, deps.store.load(userId));
      }

      if (path === `${PROFILE_PATH}/discover` && method === 'POST') {
        /* Only pending/failed sources are retried; successful sources keep their
           original retrieval time — a rerun is not a silent re-read. */
        const targets = state.sources.filter((s) => s.status !== 'ok');
        if (targets.length === 0) return ok(res, state);
        commit({ ...state, session: state.session ? { ...state.session, stage: 'discovering', updatedAt: now() } : null });
        for (const source of targets) {
          const fetched: { ok: true; page: FetchedPage } | { ok: false; failure: ReturnType<typeof profileFailure> } =
            await fetchPublicPage(source.url, { fetcher: deps.fetcher, lookupAddresses: deps.lookupAddresses });
          state = deps.store.load(userId);
          if (!fetched.ok) {
            commit(markSource(state, source.id, { status: 'failed', at: now(), error: fetched.failure.error.message }));
            continue;
          }
          const extracted = await extractPageItems(fetched.page.text, fetched.page.finalUrl, llm);
          state = deps.store.load(userId);
          if (!extracted.ok) {
            commit(markSource(state, source.id, { status: 'failed', at: now(), error: extracted.failure.error.message }));
            continue;
          }
          commit(addCandidates(markSource(state, source.id, { status: 'ok', at: fetched.page.retrievedAt }), source, extracted.items, fetched.page.retrievedAt));
        }
        state = deps.store.load(userId);
        commit({ ...state, session: state.session ? { ...state.session, stage: 'review', updatedAt: now() } : null });
        return ok(res, deps.store.load(userId));
      }

      const candidateMatch = path.match(new RegExp(`^${PROFILE_PATH}/candidates/([^/]+)$`));
      if (candidateMatch && method === 'PATCH') {
        const parsed = await body(req, res);
        if (parsed === undefined) return;
        if (!isCandidatePatch(parsed)) {
          fail(res, 'contract', 'A candidate needs accept, reject, or edit with content.');
          return;
        }
        const id = decodeURIComponent(candidateMatch[1]!);
        if (!state.candidates.some((c) => c.id === id)) {
          fail(res, 'not_found', 'No such candidate in your session.');
          return;
        }
        commit(reviewCandidate(state, id, parsed.action, parsed.content, userId, now()));
        return ok(res, deps.store.load(userId));
      }

      if (path === `${PROFILE_PATH}/commit` && method === 'POST') {
        commit(commitCandidates(state, userId, now()));
        return ok(res, deps.store.load(userId));
      }

      if (path === `${PROFILE_PATH}/reset` && method === 'POST') {
        /* Cancelling keeps confirmed records and history — only the session's
           transients are dropped. */
        commit(resetSession(state));
        return ok(res, deps.store.load(userId));
      }

      fail(res, 'not_found', 'Unknown profile path.');
    })().catch(() => {
      if (!res.headersSent) fail(res, 'upstream', 'The profile service failed.');
    });
  };
}

/** Wires the default file store into the shared router. */
export function createDefaultProfileRouter(
  config: ServerConfig,
  sessionSource: SessionSource,
): ProfileRouter {
  return createProfileRouter({
    config,
    sessionSource,
    store: createProfileStore(config.storageDir === '' ? '.workbuddy/profile' : `${config.storageDir}/profile`),
  });
}
