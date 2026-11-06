import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { useApp } from '../state/app';
import type { Tab } from '../data/types';
import { IconClose, IconFiles, IconBoards, IconNotes, IconPanel, IconProcesses } from '../components/icons';
import { IconButton } from '../components/ui';
import s from './shell.module.css';

type Props = { ctx: string; wsId?: string; variant: 'workspace' | 'notes' };

function fallback(tab: Tab, wsId?: string): string {
  if (tab.type === 'file' && wsId) return routes.files(wsId);
  if (tab.type === 'run' && wsId) return routes.processes(wsId);
  if (tab.type === 'board' && wsId) return routes.boards(wsId);
  if (tab.type === 'note') return routes.notes();
  if (tab.type === 'settings' && wsId) return routes.files(wsId);
  return wsId ? routes.files(wsId) : routes.notes();
}

export function TabStrip({ ctx, wsId, variant }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { tabs, closeObjectTab, panelOpen, togglePanel, openPalette } = useApp();

  const objectTabs = tabs[ctx] ?? [];

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
    if (wasActive) navigate(fallback(tab, wsId));
  };

  return (
    <div className={s.strip}>
      <div className={s.stripTabs} role="tablist" aria-label="Open tabs">
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

        {rooms.length > 0 && objectTabs.length > 0 ? <span className={s.stripDivider} aria-hidden /> : null}

        {variant === 'notes' ? (
          <button
            type="button"
            className={[s.tab, s.roomTab, pathname === routes.notes() ? s.tabActive : ''].join(' ')}
            onClick={() => navigate(routes.notes())}
          >
            <span className={s.tabIcon}>
              <IconNotes size={13} />
            </span>
            Notes
          </button>
        ) : null}

        {rooms.length > 0 && objectTabs.length > 0 ? <span className={s.stripDivider} aria-hidden /> : null}
        {variant === 'notes' && objectTabs.length > 0 ? <span className={s.stripDivider} aria-hidden /> : null}

        {objectTabs.map((tab) => {
          const active = pathname === tab.path;
          return (
            <div
              key={tab.id}
              className={[s.tab, s.objectTab, active ? s.tabActive : ''].join(' ')}
              data-active={active || undefined}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={s.tabMain}
                onClick={() => navigate(tab.path)}
                title={tab.label}
              >
                {tab.live ? <span className={s.tabLive} aria-label="live" /> : null}
                <span className={s.tabText}>{tab.label}</span>
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
      </div>

      <div className={s.stripTools}>
        <IconButton label="Search or jump to (Ctrl K)" onClick={openPalette}>
          <span className={s.stripKbd}>⌘K</span>
        </IconButton>
        <IconButton label={panelOpen ? 'Hide panel (Ctrl \\)' : 'Show panel (Ctrl \\)'} active={panelOpen} onClick={togglePanel}>
          <IconPanel />
        </IconButton>
      </div>
    </div>
  );
}
