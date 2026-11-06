import { Outlet } from 'react-router-dom';
import { useApp } from '../state/app';
import { Rail } from './Rail';
import { CommandPalette } from './CommandPalette';
import s from './shell.module.css';

export function AppShell() {
  const { railCollapsed, panelWidth, paletteOpen } = useApp();

  return (
    <div
      className={s.app}
      data-rail={railCollapsed ? 'collapsed' : 'open'}
      style={{ '--panel-w': `${panelWidth}px` } as React.CSSProperties}
      data-palette={paletteOpen || undefined}
    >
      <Rail />
      <div className={s.work}>
        <Outlet />
      </div>
      <CommandPalette />
    </div>
  );
}
