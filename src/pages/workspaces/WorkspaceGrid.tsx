import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { plural } from '../../data/selectors';
import type { Workspace } from '../../data/types';
import { Button, IconButton } from '../../components/ui';
import { IconPlus, IconTrash } from '../../components/icons';
import { useApp } from '../../state/app';
import {
  MAX_WORKSPACE_NAME,
  createWorkspace,
  deleteWorkspace,
  useWorkspaces,
} from '../../state/workspaces';
import s from './workspaces.module.css';

/** What a delete takes with it, named. An empty workspace says so instead of
    listing four zeroes. */
function contents(ws: Workspace): string {
  const parts = [
    ws.counts.files > 0 ? plural(ws.counts.files, 'file') : null,
    ws.counts.boards > 0 ? plural(ws.counts.boards, 'board') : null,
    ws.counts.processes > 0 ? plural(ws.counts.processes, 'process', 'processes') : null,
    ws.counts.notes > 0 ? plural(ws.counts.notes, 'note') : null,
  ].filter((part): part is string => part !== null);

  if (parts.length === 0) return 'It is empty. Only the name goes.';
  const listed = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Its ${listed} go with it.`;
}

/**
 * The workspace grid: what exists, what a new one would be called, and what a
 * delete would take. Creation and deletion both happen here rather than in a
 * dialog — a modal for a two-word form is a larger surface than the thing it
 * is asking about, and this app has no other dialog.
 */
export function WorkspaceGrid({ autoCreate = false }: { autoCreate?: boolean }) {
  const list = useWorkspaces();
  const navigate = useNavigate();
  const { closeTabsFor } = useApp();

  const [formOpen, setFormOpen] = useState(autoCreate);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formOpen) inputRef.current?.focus();
  }, [formOpen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createWorkspace(name);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setName('');
    setError(null);
    setFormOpen(false);
    /* Straight into the new workspace: it starts empty, and "where is it" is
       the only question a create can leave behind. */
    navigate(routes.files(result.workspace.id));
  };

  const remove = (ws: Workspace) => {
    deleteWorkspace(ws.id);
    setConfirming(null);
    /* The tab strip is the only other place this workspace is on screen; its
       tabs go with it, or the strip keeps a row of rows that lead nowhere. */
    closeTabsFor(`/w/${ws.id}/`);
  };

  return (
    <>
      {list.length === 0 ? (
        <p className={s.empty}>No workspaces yet.</p>
      ) : null}

      <div className={s.grid}>
        {list.map((ws) => (
          <div className={s.card} key={ws.id} data-workspace-card={ws.id}>
            {confirming === ws.id ? (
              <div
                className={s.confirm}
                role="group"
                aria-label={`Delete ${ws.name}`}
                data-confirm={ws.id}
              >
                <p className={s.confirmTitle}>Delete “{ws.name}”?</p>
                <p className={s.confirmWhat}>
                  {contents(ws)} There is no undo.
                </p>
                <div className={s.actions}>
                  <Button size="sm" className={s.danger} onClick={() => remove(ws)}>
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={s.cardOpen}
                  onClick={() => navigate(routes.files(ws.id))}
                >
                  <span className={s.cardTop}>
                    <span className={s.cardName}>{ws.name}</span>
                  </span>
                  <span className={s.cardMeta}>
                    {plural(ws.counts.files, 'file')} · {plural(ws.counts.boards, 'board')} ·{' '}
                    {plural(ws.counts.processes, 'process', 'processes')}
                  </span>
                  <span className={s.cardFoot}>
                    {ws.scope === 'org'
                      ? `${ws.members} members · you are a member`
                      : 'only you'}
                  </span>
                </button>
                <IconButton
                  label={`Delete ${ws.name}`}
                  className={s.cardDelete}
                  onClick={() => setConfirming(ws.id)}
                >
                  <IconTrash size={13} />
                </IconButton>
              </>
            )}
          </div>
        ))}

        {formOpen ? (
          <form className={s.form} onSubmit={submit} data-workspace-form>
            <label className={s.formLabel} htmlFor="new-workspace-name">
              New workspace
            </label>
            <input
              id="new-workspace-name"
              ref={inputRef}
              className={s.formInput}
              value={name}
              maxLength={MAX_WORKSPACE_NAME}
              placeholder="Field notes"
              autoComplete="off"
              aria-describedby={error ? 'new-workspace-error' : undefined}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setName('');
                  setError(null);
                  setFormOpen(false);
                }
              }}
            />
            {error ? (
              <p className={s.formError} id="new-workspace-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className={s.actions}>
              <Button type="submit" size="sm">
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setName('');
                  setError(null);
                  setFormOpen(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className={s.newCard}
            onClick={() => setFormOpen(true)}
            data-workspace-new
          >
            <IconPlus size={13} />
            New workspace
          </button>
        )}
      </div>
    </>
  );
}
