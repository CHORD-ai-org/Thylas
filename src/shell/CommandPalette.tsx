import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { recent } from '../data/selectors';
import { useWorkspaces } from '../state/workspaces';
import { useApp } from '../state/app';
import { Kbd } from '../components/ui';
import s from './palette.module.css';

type Command = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
};

export function CommandPalette() {
  const { paletteOpen, closePalette, togglePanel, toggleRail } = useApp();
  const spaces = useWorkspaces();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'go-overview', label: 'Overview', group: 'Go', run: () => navigate(routes.overview()) },
      { id: 'go-recently', label: 'Recently', group: 'Go', run: () => navigate(routes.recently()) },
      { id: 'go-notes', label: 'Notes', group: 'Go', run: () => navigate(routes.notes()) },
      { id: 'go-artifacts', label: 'Artifacts', group: 'Go', run: () => navigate(routes.artifacts()) },
      { id: 'go-connect', label: 'Connect', group: 'Go', run: () => navigate(routes.connect()) },
      { id: 'go-chat', label: 'Chat', group: 'Go', run: () => navigate(routes.chat()) },
      { id: 'go-user', label: 'User', group: 'Go', run: () => navigate(routes.user()) },
    ];

    list.push({
      id: 'new-workspace',
      label: 'New workspace',
      group: 'Workspaces',
      run: () => navigate(`${routes.overview()}?new=1`),
    });

    for (const ws of spaces) {
      list.push(
        { id: `go-${ws.id}-files`, label: `Files — ${ws.name}`, group: 'Workspaces', run: () => navigate(routes.files(ws.id)) },
        { id: `go-${ws.id}-boards`, label: `Whiteboard — ${ws.name}`, group: 'Workspaces', run: () => navigate(routes.boards(ws.id)) },
        { id: `go-${ws.id}-processes`, label: `Processes — ${ws.name}`, group: 'Workspaces', run: () => navigate(routes.processes(ws.id)) },
      );
    }

    for (const item of recent()) {
      list.push({
        id: `recent-${item.kind}-${item.id}`,
        label: item.label,
        group: 'Recent',
        hint: item.kind,
        run: () => navigate(item.route),
      });
    }

    list.push(
      { id: 'view-panel', label: 'Toggle context panel', group: 'View', hint: '⌘\\', run: togglePanel },
      { id: 'view-rail', label: 'Toggle sidebar', group: 'View', run: toggleRail },
    );

    return list;
  }, [navigate, togglePanel, toggleRail, spaces]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery('');
    setIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [paletteOpen]);

  useEffect(() => {
    if (index > filtered.length - 1) setIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, index]);

  if (!paletteOpen) return null;

  const runAt = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    closePalette();
    cmd.run();
  };

  let lastGroup = '';

  return (
    <div className={s.scrim} onMouseDown={closePalette} role="presentation">
      <div
        ref={dialogRef}
        className={s.palette}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          /* Escape closes from anywhere in the dialog. It used to live on the
             input alone, so pressing it after tabbing to an option did nothing
             — and the palette stayed open under the user's hands. */
          if (e.key === 'Escape') {
            e.preventDefault();
            closePalette();
            return;
          }
          if (e.key !== 'Tab') return;
          /* `aria-modal` is a promise: everything outside is unreachable. Six
             Tabs used to walk into the rail (audit A1). */
          const focusables = [
            inputRef.current,
            ...Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []),
          ].filter((el): el is HTMLElement => el !== null);
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (!first || !last) return;
          const here = document.activeElement;
          if (!e.shiftKey && here === last) {
            e.preventDefault();
            first.focus();
          } else if (e.shiftKey && here === first) {
            e.preventDefault();
            last.focus();
          }
        }}
      >
        <div className={s.inputRow}>
          <input
            ref={inputRef}
            className={s.input}
            role="combobox"
            aria-label="Search commands"
            aria-expanded
            aria-autocomplete="list"
            aria-activedescendant={filtered[index] ? `palette-${filtered[index].id}` : undefined}
            placeholder="Go to, open, or run…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closePalette();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                runAt(index);
              }
            }}
            aria-controls="palette-list"
          />
          <Kbd>esc</Kbd>
        </div>

        <div className={s.list} id="palette-list" role="listbox">
          {filtered.length === 0 ? <p className={s.none}>Nothing matches “{query}”.</p> : null}
          {filtered.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup ? <div className={s.group}>{cmd.group}</div> : null}
                <button
                  type="button"
                  id={`palette-${cmd.id}`}
                  role="option"
                  aria-selected={i === index}
                  className={[s.row, i === index ? s.rowActive : ''].join(' ')}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => runAt(i)}
                >
                  <span className={s.rowLabel}>{cmd.label}</span>
                  {cmd.hint ? <span className={s.rowHint}>{cmd.hint}</span> : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className={s.foot}>
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move · <Kbd>↵</Kbd> to open
          </span>
          <span>Sample data · no service connected</span>
        </div>
      </div>
    </div>
  );
}
