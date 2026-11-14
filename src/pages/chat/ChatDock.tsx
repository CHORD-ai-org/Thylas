import { useRef } from 'react';
import { useChat, setDock, setDockWidth, DOCK_MAX, DOCK_MIN } from '../../state/chat';
import { IconClose } from '../../components/icons';
import { IconButton } from '../../components/ui';
import { ChatCore } from './ChatCore';
import d from './chat.module.css';

/**
 * The embedded surface: one dock beside any route, resized with the same
 * pointer-capture grip as ContextPanel but with a wider clamp. It renders the
 * same ChatCore the /chat page renders — no second chat system.
 */
export function ChatDock() {
  const { dock } = useChat();
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  if (!dock.open) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startW: dock.width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setDockWidth(Math.min(DOCK_MAX, Math.max(DOCK_MIN, drag.current.startW + drag.current.startX - e.clientX)));
  };
  const stop = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <aside className={[d.dock, 'glass'].join(' ')} style={{ width: dock.width }} aria-label="Chat panel" data-chat-dock>
      <div
        className={d.dockGrip}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat panel"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <ChatCore
        embedded
        headerExtra={
          <IconButton label="Hide chat panel" onClick={() => setDock(false)} data-dock-close>
            <IconClose size={13} />
          </IconButton>
        }
      />
    </aside>
  );
}
