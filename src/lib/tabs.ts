/* Pure tab model. No React, no storage, no application imports.

   `state/app.tsx` is the adapter that owns sessionStorage and the object
   resolver; `shell/TabStrip.tsx` only renders what these functions return.
   Keeping the rules here is what makes "close the active tab", "reload after
   a deletion" and "a deep link you never opened" testable without a browser. */

export type TabType = 'files' | 'boards' | 'processes' | 'file' | 'board' | 'run' | 'note';
export type TabKind = 'room' | 'object';

export type Tab = {
  id: string;
  kind: TabKind;
  type: TabType;
  label: string;
  path: string;
  live?: boolean;
  unsaved?: boolean;
  /** Set by reconcile when the object behind the tab no longer resolves. A
      silently vanished working context is worse than a dimmed tombstone. */
  missing?: boolean;
};

export type TabsState = Record<string, Tab[]>;

export const TABS_VERSION = 2;
export const TABS_KEY = 'thylas:tabs:v2';
export const TABS_KEY_V1 = 'thylas:tabs:v1';

/** sessionStorage is ~5 MB but shared with the rest of the tab. 128 KB of tab
    metadata is already far past a usable strip; the guard is about failing
    gracefully, not about reaching the limit. */
export const MAX_TABS_BYTES = 128 * 1024;

export function makeObjectTab(seed: {
  type: TabType;
  label: string;
  path: string;
  live?: boolean;
}): Tab {
  return { id: seed.path, kind: 'object', ...seed };
}

/** Duplicate open is a focus action, not a new tab. Returning the same
    reference also prevents a pointless persist on every re-render. */
export function openTab(state: TabsState, ctx: string, tab: Tab): TabsState {
  const list = state[ctx] ?? [];
  if (list.some((t) => t.path === tab.path)) return state;
  return { ...state, [ctx]: [...list, tab] };
}

export function closeTab(state: TabsState, ctx: string, id: string): TabsState {
  const list = state[ctx];
  if (!list) return state;
  const next = list.filter((t) => t.id !== id);
  return next.length === list.length ? state : { ...state, [ctx]: next };
}

/** The room a closed object tab returns to. Derived from the tab's own path,
    so an object can never navigate into a different workspace's scope. */
export function roomPath(tab: Tab): string {
  if (tab.type === 'note') return '/notes';
  const ws = /^\/w\/([^/]+)\//.exec(tab.path)?.[1];
  if (!ws) return '/overview';
  if (tab.type === 'run') return `/w/${ws}/processes`;
  if (tab.type === 'board') return `/w/${ws}/boards`;
  return `/w/${ws}/files`;
}

/** Keep only known contexts. Tabs whose object is gone are *marked*, never
    dropped: the user closed nothing, so the app has no right to close it. */
export function reconcileTabs(
  state: TabsState,
  contexts: readonly string[],
  exists: (tab: Tab) => boolean,
): TabsState {
  const allowed = new Set(contexts);
  let changed = Object.keys(state).some((key) => !allowed.has(key));
  const next: TabsState = {};

  for (const ctx of contexts) {
    const list = state[ctx] ?? [];
    let listChanged = false;
    const mapped = list.map((tab) => {
      const missing = !exists(tab);
      if (Boolean(tab.missing) === missing) return tab;
      listChanged = true;
      return missing ? { ...tab, missing: true } : { ...tab, missing: false };
    });
    if (listChanged) changed = true;
    next[ctx] = listChanged ? mapped : list;
  }

  return changed ? next : state;
}

/** The strip never scrolls sideways. The active tab is rotated into the
    visible slice even when it was opened from the overflow menu. */
export function rotateIntoView(
  tabs: readonly Tab[],
  activePath: string,
  limit: number,
): { visible: Tab[]; hidden: Tab[] } {
  if (tabs.length <= limit) return { visible: [...tabs], hidden: [] };
  const head = tabs.slice(0, Math.max(1, limit - 1));
  const active = tabs.find((t) => t.path === activePath);
  const visible = active && !head.includes(active) ? [...head, active] : head;
  return { visible, hidden: tabs.filter((t) => !visible.includes(t)) };
}

function byteLength(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** Drop the oldest tab from the largest context until the payload fits. Used
    at write time; the in-memory set is left alone so the strip does not jump. */
export function pruneForQuota(state: TabsState, maxBytes = MAX_TABS_BYTES): TabsState {
  let next = state;
  let guard = 0;
  while (byteLength(next) > maxBytes && guard++ < 500) {
    const entries = Object.entries(next).filter(([, list]) => list.length > 0);
    if (entries.length === 0) break;
    const [ctx] = entries.reduce((a, b) => (b[1].length >= a[1].length ? b : a));
    next = { ...next, [ctx]: (next[ctx] ?? []).slice(1) };
  }
  return next;
}
