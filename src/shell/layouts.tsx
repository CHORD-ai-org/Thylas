import type { ReactNode } from 'react';
import { useApp } from '../state/app';
import { TabStrip } from './TabStrip';
import { ContextPanel } from './ContextPanel';
import s from './shell.module.css';

export function PlainLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className={s.plain} data-scroll-region="page">
      <div className={[s.plainInner, wide ? s.plainWide : ''].join(' ')}>{children}</div>
    </main>
  );
}

export function WorkspaceLayout({
  wsId,
  panel,
  panelTitle = 'Details',
  panelMeta,
  flush = false,
  children,
}: {
  wsId: string;
  panel?: ReactNode;
  panelTitle?: string;
  panelMeta?: string;
  flush?: boolean;
  children: ReactNode;
}) {
  const { panelOpen } = useApp();
  const ctx = `ws:${wsId}`;

  return (
    <>
      <TabStrip ctx={ctx} wsId={wsId} variant="workspace" />
      <div className={s.body}>
        <main className={[s.surface, flush ? s.surfaceFlush : ''].join(' ')} data-scroll-region="surface">
          {children}
        </main>
        {panel && panelOpen ? (
          <ContextPanel ctx="workspace" title={panelTitle} meta={panelMeta}>
            {panel}
          </ContextPanel>
        ) : null}
      </div>
    </>
  );
}
