/**
 * The AI endpoint status, and the model this person picked.
 *
 * Since D-061 the server serves several providers, so "which model is this" is
 * a real answer with more than one possible value. Three surfaces need it —
 * the Composer picker, the Overview Ask panel and the chat stream — and they
 * must not disagree, so the probe and the resolution live here instead of in
 * each surface.
 *
 * The probe runs once per session: the server's configuration does not change
 * while it runs, and a second probe would only add a second chance to be
 * wrong.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { selectionInCatalog, type AiSelection, type AiStatusBody } from '../lib/ai';
import { probe } from '../services/ai/client';
import { prefsOf, setPref, useUser } from './user';

let status: AiStatusBody | null = null;
let probed = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): AiStatusBody | null => status;

/** One probe per session. A failed probe leaves the controls enabled. */
export function ensureAiStatus(): void {
  if (probed) return;
  probed = true;
  void probe().then((body) => {
    status = body;
    for (const listener of listeners) listener();
  });
}

/** The status of the model endpoint, or null when it could not be reached. */
export function useAiStatus(): AiStatusBody | null {
  useEffect(() => {
    ensureAiStatus();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * The model this person picked — if the server still serves it. A stored
 * choice whose provider was removed or whose model left the allowlist never
 * reaches the wire: the server's default takes over instead.
 */
export function useAiSelection(): AiSelection | null {
  const status = useAiStatus();
  const user = useUser();
  const stored = prefsOf(user).model;
  if (selectionInCatalog(stored, status?.providers)) return stored;
  const fallback = status?.default;
  if (fallback) return { provider: fallback.provider, model: fallback.model };
  return null;
}

/** Remember a choice. The server checks it against its own catalog again. */
export function chooseAiModel(selection: AiSelection): void {
  setPref('model', selection);
}
