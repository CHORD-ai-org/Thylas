import { useRef } from 'react';
import type { ReactNode } from 'react';
import { PANEL_MAX, PANEL_MIN, useApp, type PanelContext } from '../state/app';
import { IconClose } from '../components/icons';
import { IconButton } from '../components/ui';
import s from './shell.module.css';

export function ContextPanel({
  ctx,
  title,
  meta,
  children,
}: {
  ctx: PanelContext;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  const { panelWidthFor, setPanelWidthFor, togglePanel } = useApp();
  const width = panelWidthFor(ctx);
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startW: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = drag.current.startX - e.clientX;
    setPanelWidthFor(ctx, Math.min(PANEL_MAX, Math.max(PANEL_MIN, drag.current.startW + delta)));
  };

  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <aside className={s.panel} style={{ width }} data-panel-context={ctx} aria-label={title}>
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
        <h2 className={s.panelTitle}>
          {title}
          {meta ? <span className={s.panelMeta}>{meta}</span> : null}
        </h2>
        <IconButton label="Hide panel" onClick={togglePanel}>
          <IconClose size={13} />
        </IconButton>
      </header>
      <div className={s.panelBody}>{children}</div>
    </aside>
  );
}
