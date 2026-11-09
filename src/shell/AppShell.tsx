import { Outlet } from 'react-router-dom';
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
            <Outlet />
          </div>
          <ChatDock />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
