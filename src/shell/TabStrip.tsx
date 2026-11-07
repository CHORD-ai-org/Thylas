import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { useApp } from '../state/app';
import { roomPath, rotateIntoView, type Tab } from '../lib/tabs';
import {
  IconBoards,
  IconChevron,
  IconClose,
  IconFiles,
  IconNotes,
  IconPanel,
  IconProcesses,
} from '../components/icons';
import { IconButton } from '../components/ui';
import s from './shell.module.css';

type Props = { ctx: string; wsId?: string; variant: 'workspace' | 'notes' };

/* How many object tabs fit is measured, not guessed: labels differ and the
   rail collapses. Five is the floor because four tabs plus a room row is the
   minimum a workspace needs to stay usable. */
const TAB_FLOOR = 3;
const TAB_CEILING = 8;

/** The type glyph is what makes four kinds of object distinguishable in a strip
 *  that only has room for labels. 12px, --ink-3, no fill. */
function TabGlyph({ type }: { type: Tab['type'] }) {
  const size = 12;
  if (type === 'board') return <IconBoards size={size} />;
  if (type === 'run') return <IconProcesses size={size} />;
  if (type === 'note') return <IconNotes size={size} />;
  return <IconFiles size={size} />;
}

export function TabStrip({ ctx, wsId, variant }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { tabs, closeObjectTab, panelOpen, togglePanel, openPalette } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [limit, setLimit] = useState(TAB_CEILING);
  const menuRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const objectTabs = tabs[ctx] ?? [];

  // Keep the active tab inside the visible slice: a hidden active tab is the
  // classic overflow bug, and rotation is cheaper than making the strip scroll.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const measure = () => {
      // 250 for three room tabs, 75 for the overflow control, ~145 per object tab.
      const next = Math.max(TAB_FLOOR, Math.min(TAB_CEILING, Math.floor((el.clientWidth - 325) / 145)));
      setLimit(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { visible, hidden } = rotateIntoView(objectTabs, pathname, limit);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const rooms =
    variant === 'workspace' && wsId
      ? [
          { label: 'Files', path: routes.files(wsId), icon: <IconFiles size={13} /> },
          { label: 'Whiteboard', path: routes.boards(wsId), icon: <IconBoards size={13} /> },
          { label: 'Processes', path: routes.processes(wsId), icon: <IconProcesses size={13} /> },
        ]
      : [];

  const close = (tab: Tab) => {
    const wasActive = pathname === tab.path;
    closeObjectTab(ctx, tab.id);
    if (wasActive) navigate(roomPath(tab));
  };

  return (
    <div className={s.strip}>
      <div className={s.stripTabs} role="tablist" aria-label="Open tabs" ref={stripRef}>
        {rooms.map((room) => {
          const active = pathname === room.path;
          return (
            <button
              key={room.path}
              type="button"
              role="tab"
              aria-selected={active}
              className={[s.tab, s.roomTab, active ? s.tabActive : ''].join(' ')}
              onClick={() => navigate(room.path)}
            >
              <span className={s.tabIcon}>{room.icon}</span>
              {room.label}
            </button>
          );
        })}

        {variant === 'notes' ? (
          <button
            type="button"
            role="tab"
            aria-selected={pathname === routes.notes()}
            className={[s.tab, s.roomTab, pathname === routes.notes() ? s.tabActive : ''].join(' ')}
            onClick={() => navigate(routes.notes())}
          >
            <span className={s.tabIcon}>
              <IconNotes size={13} />
            </span>
            Notes
          </button>
        ) : null}

        {objectTabs.length > 0 ? <span className={s.stripDivider} aria-hidden /> : null}

        {visible.map((tab) => {
          const active = pathname === tab.path;
          return (
            <div
              key={tab.id}
              className={[s.tab, s.objectTab, active ? s.tabActive : '', tab.missing ? s.tabMissing : ''].join(' ')}
              data-active={active || undefined}
              data-missing={tab.missing || undefined}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={s.tabMain}
                onClick={() => navigate(tab.path)}
                title={tab.missing ? `${tab.label} — this object was deleted. Close the tab to dismiss.` : tab.label}
              >
                <span className={s.tabType} aria-hidden>
                  <TabGlyph type={tab.type} />
                </span>
                <span className={s.tabText}>{tab.label}</span>
                {tab.missing ? <span className={s.tabGone} aria-label="deleted">×</span> : null}
                {tab.live ? <span className={s.tabLive} aria-label="running" /> : null}
              </button>
              <button
                type="button"
                className={s.tabClose}
                aria-label={`Close ${tab.label}`}
                onClick={() => close(tab)}
              >
                <IconClose size={11} />
              </button>
            </div>
          );
        })}

        {hidden.length > 0 ? (
          <div className={s.overflow} ref={menuRef}>
            <button
              type="button"
              className={[s.tab, s.overflowBtn].join(' ')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              +{hidden.length}
              <IconChevron dir="down" size={10} />
            </button>
            {menuOpen ? (
              <div className={s.overflowMenu} role="menu">
                {hidden.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    className={s.overflowItem}
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(tab.path);
                    }}
                  >
                    <span className={s.tabType}>
                      <TabGlyph type={tab.type} />
                    </span>
                    <span className={s.overflowLabel}>{tab.label}</span>
                    {tab.missing ? <span className={s.tabGone} aria-label="deleted">×</span> : null}
                    {tab.live ? <span className={s.tabLive} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={s.stripTools}>
        <IconButton label="Search or jump to (Ctrl K)" onClick={openPalette}>
          <span className={s.stripKbd}>⌘K</span>
        </IconButton>
        <IconButton
          label={panelOpen ? 'Hide panel (Ctrl \\)' : 'Show panel (Ctrl \\)'}
          active={panelOpen}
          onClick={togglePanel}
        >
          <IconPanel />
        </IconButton>
      </div>
    </div>
  );
}
