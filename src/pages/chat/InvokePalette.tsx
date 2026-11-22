import { useMemo } from 'react';
import { boardsIn, filesIn } from '../../data/selectors';
import { useArtifacts, artifactsView } from '../../state/artifacts';
import { useCoworkers, coworkersView } from '../../state/coworkers';
import { useNotes, listNotes } from '../../state/notes';
import { useWorkspaces } from '../../state/workspaces';
import { rank, type InvokeItem, type InvokeQuery } from '../../lib/invoke';
import s from './chat.module.css';

/**
 * The invocation palette (roadmap P0-2). Groups, ranks and renders objects the
 * composer can reference. It only reads stores the composer already uses —
 * invoking never mutates anything.
 */

const GROUP_LABEL: Record<InvokeItem['group'], string> = {
  coworker: 'CW',
  artifact: 'Art',
  resource: 'Obj',
  workspace: 'WS',
  gsc: 'GSC',
  action: 'Do',
};

export function useInvokeItems(): InvokeItem[] {
  const workspaces = useWorkspaces();
  useCoworkers();
  useArtifacts();
  useNotes();

  return useMemo(() => {
    const items: InvokeItem[] = [];
    for (const ws of workspaces) {
      items.push({ id: ws.id, group: 'workspace', kind: 'workspace', label: ws.name, scope: ws.id });
      for (const file of filesIn(ws.id)) {
        items.push({ id: file.id, group: 'resource', kind: 'file', label: file.name, detail: file.kind, scope: ws.id });
      }
      for (const board of boardsIn(ws.id)) {
        items.push({ id: board.id, group: 'resource', kind: 'board', label: board.name, scope: ws.id });
      }
    }
    for (const note of listNotes()) {
      items.push({
        id: note.id,
        group: 'resource',
        kind: 'note',
        label: note.title,
        scope: note.wsId ?? 'personal',
      });
    }
    for (const coworker of coworkersView()) {
      items.push({ id: coworker.id, group: 'coworker', kind: 'coworker', label: coworker.name, detail: coworker.description, scope: 'shared' });
    }
    for (const artifact of artifactsView()) {
      items.push({ id: artifact.id, group: 'artifact', kind: artifact.kind, label: artifact.name, detail: artifact.summary, scope: 'shared' });
    }
    return items;
  }, [workspaces]);
}

export function invokeItems(query: InvokeQuery, items: InvokeItem[], usage: string[]): InvokeItem[] {
  return rank(items, query, usage).slice(0, 8);
}

export function InvokePalette({
  items,
  cursor,
  onPick,
  onHover,
}: {
  items: InvokeItem[];
  cursor: number;
  onPick: (item: InvokeItem) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div className={[s.invokePopover, 'glass'].join(' ')} role="listbox" aria-label="Invoke" data-invoke-popover>
      {items.length === 0 ? (
        <p className={s.popoverNote} data-invoke-empty>
          No match. Keep typing, or press Esc to cancel.
        </p>
      ) : (
        items.map((item, index) => (
          <button
            key={`${item.group}:${item.id}`}
            type="button"
            role="option"
            aria-selected={index === cursor}
            className={[s.invokeRow, index === cursor ? s.invokeRowOn : ''].join(' ').trim()}
            data-invoke-item={item.id}
            data-invoke-group={item.group}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(e) => {
              /* Mouse-down, not click: the textarea must not blur first. */
              e.preventDefault();
              onPick(item);
            }}
          >
            <span className={s.popoverKind}>{GROUP_LABEL[item.group]}</span>
            <span className={s.convTitle}>{item.label}</span>
            {item.detail ? <span className={s.invokeDetail}>{item.detail}</span> : null}
          </button>
        ))
      )}
    </div>
  );
}
