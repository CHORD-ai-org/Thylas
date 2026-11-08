import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  MAX_TABS_BYTES,
  TABS_KEY,
  TABS_KEY_V1,
  TABS_VERSION,
  closeTab,
  makeObjectTab,
  openTab,
  pruneForQuota,
  reconcileTabs,
  type Tab,
  type TabType,
  type TabsState,
} from '../lib/tabs';
import { getBoard, getFile, getNote, getProcess, workspaces } from '../data/selectors';

type ObjectTabSeed = {
  type: TabType;
  label: string;
  path: string;
  live?: boolean;
};

export type PanelContext = 'workspace' | 'notes' | 'ask';
type UiState = {
  version: 2;
  railCollapsed: boolean;
  panelWidth: Record<PanelContext, number>;
};

export const PANEL_MIN = 280;
export const PANEL_MAX = 480;
const DEFAULT_WIDTH: Record<PanelContext, number> = { workspace: 340, notes: 300, ask: 360 };
const clampWidth = (n: number): number => Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(n)));

type AppState = {
  railCollapsed: boolean;
  panelOpen: boolean;
  paletteOpen: boolean;
  tabs: TabsState;
  toggleRail: () => void;
  togglePanel: () => void;
  panelWidthFor: (ctx: PanelContext) => number;
  setPanelWidthFor: (ctx: PanelContext, w: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  openObjectTab: (ctx: string, seed: ObjectTabSeed) => void;
  closeObjectTab: (ctx: string, id: string) => void;
};

const AppCtx = createContext<AppState | null>(null);

const UI_KEY = 'thylas:ui:v2';
const UI_KEY_V1 = 'thylas:ui:v1';

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[thylas] ${message}`);
}

function readJson<T>(store: Storage, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(store: Storage, key: string, value: unknown): void {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota, private mode, or a blocked Storage: the app keeps working in memory.
    warnOnce('storage', 'Storage is full or blocked; UI state is in-memory only for this tab.');
  }
}

function loadUi(): UiState {
  const v2 = readJson<unknown>(localStorage, UI_KEY, null);
  if (v2 && typeof v2 === 'object') {
    const candidate = v2 as Partial<UiState>;
    if (candidate.version === 2 && candidate.panelWidth && typeof candidate.panelWidth === 'object') {
      return {
        version: 2,
        railCollapsed: Boolean(candidate.railCollapsed),
        panelWidth: {
          workspace: clampWidth(candidate.panelWidth.workspace ?? DEFAULT_WIDTH.workspace),
          notes: clampWidth(candidate.panelWidth.notes ?? DEFAULT_WIDTH.notes),
          ask: clampWidth(candidate.panelWidth.ask ?? DEFAULT_WIDTH.ask),
        },
      };
    }
  }
  // v1 had one global width. Keep it for the workspace context; Notes always
  // wanted the narrower column and that was the known defect SP-03b closes.
  const v1 = readJson<{ railCollapsed?: boolean; panelWidth?: number } | null>(localStorage, UI_KEY_V1, null);
  return {
    version: 2,
    railCollapsed: Boolean(v1?.railCollapsed),
    panelWidth: {
      workspace: clampWidth(v1?.panelWidth ?? DEFAULT_WIDTH.workspace),
      notes: DEFAULT_WIDTH.notes,
      ask: DEFAULT_WIDTH.ask,
    },
  };
}

function isTabArray(value: unknown): value is Tab[] {
  return (
    Array.isArray(value) &&
    value.every(
      (t) =>
        t &&
        typeof t === 'object' &&
        typeof (t as Tab).id === 'string' &&
        typeof (t as Tab).path === 'string' &&
        typeof (t as Tab).label === 'string' &&
        typeof (t as Tab).type === 'string',
    )
  );
}

function isTabsState(value: unknown): value is TabsState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isTabArray);
}

/** v2 is a versioned envelope; v1 was a bare context→tabs map. Malformed or
    half-written entries are dropped rather than resurrected as broken tabs. */
function loadTabs(): TabsState {
  const v2 = readJson<unknown>(sessionStorage, TABS_KEY, null);
  if (v2 && typeof v2 === 'object') {
    const envelope = v2 as { version?: unknown; contexts?: unknown };
    if (envelope.version === TABS_VERSION && isTabsState(envelope.contexts)) {
      return envelope.contexts;
    }
  }
  const v1 = readJson<unknown>(sessionStorage, TABS_KEY_V1, null);
  return isTabsState(v1) ? v1 : {};
}

/** Until a resource service exists, resolution comes from the sample model.
    reconcileTabs stays pure because the resolver is injected. */
function objectExists(tab: Tab): boolean {
  const id = tab.path.split('/').pop() ?? '';
  if (tab.type === 'file') return Boolean(getFile(id));
  if (tab.type === 'note') return Boolean(getNote(id));
  if (tab.type === 'board') return Boolean(getBoard(id));
  if (tab.type === 'run') return Boolean(getProcess(id));
  return true;
}

function knownContexts(): string[] {
  return ['notes', ...workspaces().map((w) => `ws:${w.id}`)];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState<UiState>(loadUi);
  const [panelOpen, setPanelOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tabs, setTabs] = useState<TabsState>(loadTabs);

  // One reconciliation on mount: mark deleted objects, drop dead contexts.
  useEffect(() => {
    setTabs((prev) => reconcileTabs(prev, knownContexts(), objectExists));
  }, []);

  useEffect(() => writeJson(localStorage, UI_KEY, ui), [ui]);

  useEffect(() => {
    let contexts = tabs;
    if (JSON.stringify({ version: TABS_VERSION, contexts }).length > MAX_TABS_BYTES) {
      contexts = pruneForQuota(tabs);
      warnOnce('quota', 'Tab set exceeded its storage budget; the oldest tabs were not persisted.');
    }
    writeJson(sessionStorage, TABS_KEY, { version: TABS_VERSION, contexts });
  }, [tabs]);

  const toggleRail = useCallback(
    () => setUi((v: typeof ui) => ({ ...v, railCollapsed: !v.railCollapsed })),
    [],
  );
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const setPanelWidthFor = useCallback((ctx: PanelContext, w: number) => {
    setUi((v) => ({ ...v, panelWidth: { ...v.panelWidth, [ctx]: clampWidth(w) } }));
  }, []);
  const panelWidthFor = useCallback(
    (ctx: PanelContext) => ui.panelWidth[ctx] ?? DEFAULT_WIDTH[ctx],
    [ui],
  );

  const openObjectTab = useCallback((ctx: string, seed: ObjectTabSeed) => {
    setTabs((prev) => openTab(prev, ctx, makeObjectTab(seed)));
  }, []);

  const closeObjectTab = useCallback((ctx: string, id: string) => {
    setTabs((prev) => closeTab(prev, ctx, id));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (meta && e.key === '\\') {
        e.preventDefault();
        setPanelOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      railCollapsed: ui.railCollapsed,
      panelOpen,
      paletteOpen,
      tabs,
      toggleRail,
      togglePanel,
      panelWidthFor,
      setPanelWidthFor,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      openObjectTab,
      closeObjectTab,
    }),
    [ui, panelOpen, paletteOpen, tabs, toggleRail, togglePanel, panelWidthFor, setPanelWidthFor, openObjectTab, closeObjectTab],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Registers an object tab for the current route. Every detail surface calls this
 *  and nothing else writes to the strip — one writer, no reconciler drift. */
export function useRegisterTab(ctx: string | null, seed: ObjectTabSeed | null): void {
  const { openObjectTab } = useApp();
  const type = seed?.type;
  const label = seed?.label;
  const path = seed?.path;
  const live = seed?.live;
  useEffect(() => {
    if (!ctx || !type || !label || !path) return;
    openObjectTab(ctx, { type, label, path, live });
  }, [ctx, type, label, path, live, openObjectTab]);
}
