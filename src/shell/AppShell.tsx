import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../state/app';
import { useChat } from '../state/chat';
import { Rail } from './Rail';
import { CommandPalette } from './CommandPalette';
import { ScrollRestoration } from './ScrollRestoration';
import { ChatDock } from '../pages/chat/ChatDock';
import s from './shell.module.css';

export function AppShell() {
  const { railCollapsed, paletteOpen } = useApp();
  const { dock } = useChat();
  const location = useLocation();

  return (
    <div
      className={s.app}
      data-rail={railCollapsed ? 'collapsed' : 'open'}
      data-palette={paletteOpen || undefined}
      data-dock={dock.open || undefined}
    >
      <ScrollRestoration />
      <Rail />
      <div className={s.work}>
        <div className={s.dockRow}>
          <div className={s.dockMain}>
            {/* Keyed on the path: every route change replays the enter
                transition. Search-only changes keep the mounted page. */}
            <div className={s.routeStage} key={location.pathname} data-route-stage>
              <Outlet />
            </div>
          </div>
          <ChatDock />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
