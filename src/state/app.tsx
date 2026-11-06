import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Tab, TabType } from '../data/types';

type ObjectTabSeed = {
  type: TabType;
  label: string;
  path: string;
  live?: boolean;
};

type AppState = {
  railCollapsed: boolean;
  panelOpen: boolean;
  panelWidth: number;
  paletteOpen: boolean;
  tabs: Record<string, Tab[]>;
  toggleRail: () => void;
  togglePanel: () => void;
  setPanelWidth: (w: number) => void;
  openPalette: () => void;
  closePalette: () => void;
  openObjectTab: (ctx: string, seed: ObjectTabSeed) => void;
  closeObjectTab: (ctx: string, id: string) => void;
};

const AppCtx = createContext<AppState | null>(null);

const TABS_KEY = 'thylas:tabs:v1';
const UI_KEY = 'thylas:ui:v1';

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
    /* storage full or blocked: the UI degrades to in-memory state */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ui, setUi] = useState(() =>
    readJson(localStorage, UI_KEY, { railCollapsed: false, panelWidth: 340 }),
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tabs, setTabs] = useState<Record<string, Tab[]>>(() =>
    readJson<Record<string, Tab[]>>(sessionStorage, TABS_KEY, {}),
  );

  useEffect(() => writeJson(localStorage, UI_KEY, ui), [ui]);
  useEffect(() => writeJson(sessionStorage, TABS_KEY, tabs), [tabs]);

  const toggleRail = useCallback(
    () => setUi((v: typeof ui) => ({ ...v, railCollapsed: !v.railCollapsed })),
    [],
  );
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);
  const setPanelWidth = useCallback(
    (w: number) => setUi((v: typeof ui) => ({ ...v, panelWidth: w })),
    [],
  );

  const openObjectTab = useCallback((ctx: string, seed: ObjectTabSeed) => {
    setTabs((prev) => {
      const list = prev[ctx] ?? [];
      if (list.some((t) => t.path === seed.path)) return prev;
      const tab: Tab = {
        id: seed.path,
        kind: 'object',
        type: seed.type,
        label: seed.label,
        path: seed.path,
        live: seed.live,
      };
      return { ...prev, [ctx]: [...list, tab] };
    });
  }, []);

  const closeObjectTab = useCallback((ctx: string, id: string) => {
    setTabs((prev) => ({ ...prev, [ctx]: (prev[ctx] ?? []).filter((t) => t.id !== id) }));
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
      panelWidth: ui.panelWidth,
      paletteOpen,
      tabs,
      toggleRail,
      togglePanel,
      setPanelWidth,
      openPalette: () => setPaletteOpen(true),
      closePalette: () => setPaletteOpen(false),
      openObjectTab,
      closeObjectTab,
    }),
    [ui, panelOpen, paletteOpen, tabs, toggleRail, togglePanel, setPanelWidth, openObjectTab, closeObjectTab],
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
