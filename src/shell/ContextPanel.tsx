import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../state/app';
import { IconClose } from '../components/icons';
import { IconButton } from '../components/ui';
import s from './shell.module.css';

export function ContextPanel({ title, children }: { title: string; children: ReactNode }) {
  const { panelWidth, setPanelWidth, togglePanel } = useApp();
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startW: panelWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = drag.current.startX - e.clientX;
    setPanelWidth(Math.min(480, Math.max(280, drag.current.startW + delta)));
  };

  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <aside className={s.panel} style={{ width: panelWidth }} aria-label={title}>
      <div
        className={s.panelGrip}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <header className={s.panelHead}>
        <h2 className={s.panelTitle}>{title}</h2>
        <IconButton label="Hide panel" onClick={togglePanel}>
          <IconClose size={13} />
        </IconButton>
      </header>
      <div className={s.panelBody}>{children}</div>
    </aside>
  );
}
