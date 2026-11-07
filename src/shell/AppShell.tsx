import { Outlet } from 'react-router-dom';
import { useApp } from '../state/app';
import { Rail } from './Rail';
import { CommandPalette } from './CommandPalette';
import { ScrollRestoration } from './ScrollRestoration';
import s from './shell.module.css';

export function AppShell() {
  const { railCollapsed, paletteOpen } = useApp();

  return (
    <div
      className={s.app}
      data-rail={railCollapsed ? 'collapsed' : 'open'}
      data-palette={paletteOpen || undefined}
    >
      <ScrollRestoration />
      <Rail />
      <div className={s.work}>
        <Outlet />
      </div>
      <CommandPalette />
    </div>
  );
}
