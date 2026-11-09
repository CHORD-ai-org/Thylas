import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import type { Tab } from '../lib/tabs';
import { filesInFolder, foldersIn, getFile, getWorkspace, filesIn } from '../data/selectors';
import type { FileItem } from '../data/types';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field, TypeGlyph, Badge } from '../components/ui';
import { IconBoards, IconChevron, IconDisclosure, IconFolder, IconNote, IconUpload } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import g from '../styles/grammar.module.css';
import s from './files.module.css';

type RowItem =
  | { key: string; kind: 'file'; file: FileItem }
  | { key: string; kind: 'tombstone'; tab: Tab };

function sourceLabel(file: FileItem): string {
  if (file.source.kind === 'produced') return `produced · ${file.source.runLabel}`;
  return file.source.kind;
}

function FilePanel({ file, onOpen }: { file: FileItem; onOpen: () => void }) {
  return (
    <div className={s.panelInner}>
      <div className={s.panelTitleRow}>
        <TypeGlyph kind={file.kind} />
        <h3 className={s.panelName}>{file.name}</h3>
      </div>
      <div className={s.panelFields}>
        <Field label="Size">{file.size}</Field>
        <Field label="Updated">{file.updated}</Field>
        <Field label="Source">{sourceLabel(file)}</Field>
        <Field label="Folder">{foldersIn(file.wsId).find((f) => f.id === file.folderId)?.name ?? '—'}</Field>
      </div>
      <div className={s.panelActions}>
        <Button size="sm" onClick={onOpen}>
          Open
        </Button>
      </div>

      <div className={s.panelSection}>
        <div className={s.panelSectionHead}>
          <span>Used by</span>
          <span className={s.panelCount}>{file.usedBy.length}</span>
        </div>
        {file.usedBy.length === 0 ? (
          <p className={s.panelQuiet}>Nothing references this file yet.</p>
        ) : (
          <ul className={s.refList}>
            {file.usedBy.map((ref) => (
              <li key={`${ref.kind}-${ref.id}`} className={s.refRow}>
                <span className={s.refKind}>
                  {ref.kind === 'board' ? (
                    <IconBoards size={11} />
                  ) : ref.kind === 'process' ? (
                    <IconDisclosure size={11} />
                  ) : (
                    <IconNote size={11} />
                  )}
                </span>
                <span className={s.refLabel}>{ref.label}</span>
                <span className={s.refMeta}>{ref.meta}</span>
              </li>
            ))}
          </ul>
        )}
        <p className={s.panelQuiet}>
          References, not copies. Removing this file breaks these {file.usedBy.length}.
        </p>
      </div>
    </div>
  );
}

/** One owner for a deleted object: closing its tab removes both the tab and the
    row. There is no second dismissal state that could leave an orphan. */
function TombstonePanel({ tab, onDismiss }: { tab: Tab; onDismiss: () => void }) {
  return (
    <div className={s.panelInner}>
      <h3 className={s.panelName}>{tab.label}</h3>
      <p className={s.panelQuiet}>
        This file was deleted. Its tab stayed open so you can see where it was.
      </p>
      <div className={s.panelActions}>
        <Button size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function FilesPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const { panelOpen, togglePanel, tabs, closeObjectTab } = useApp();
  const ws = getWorkspace(wsId);
  const folders = foldersIn(wsId);
  const [folderId, setFolderId] = useState<string | null>(folders[0]?.id ?? null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>(folders.map((f) => f.id));

  const rows = useMemo(() => filesInFolder(wsId, folderId), [wsId, folderId]);
  const tombstones = useMemo(
    () =>
      (tabs[`ws:${wsId}`] ?? []).filter(
        (t) => t.type === 'file' && t.missing && t.path.startsWith(`/w/${wsId}/files/`),
      ),
    [tabs, wsId],
  );
  const items = useMemo<RowItem[]>(
    () => [
      ...rows.map((file) => ({ key: file.id, kind: 'file' as const, file })),
      ...tombstones.map((tab) => ({ key: tab.id, kind: 'tombstone' as const, tab })),
    ],
    [rows, tombstones],
  );

  useEffect(() => {
    setFolderId(folders[0]?.id ?? null);
    setExpanded(folders.map((f) => f.id));
    // folder set changes only when the workspace changes
  }, [wsId]);

  useEffect(() => {
    setSelectedKey(rows[0]?.id ?? null);
  }, [rows]);

  const selected = items.find((it) => it.key === selectedKey) ?? null;
  const open = (file: FileItem) => navigate(routes.file(wsId, file.id));

  const onKey = (e: React.KeyboardEvent) => {
    if (!items.length) return;
    const i = Math.max(0, items.findIndex((it) => it.key === selectedKey));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedKey(items[Math.min(items.length - 1, i + 1)]?.key ?? null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedKey(items[Math.max(0, i - 1)]?.key ?? null);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedKey(items[0]?.key ?? null);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedKey(items[items.length - 1]?.key ?? null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedKey(null);
    } else if (e.key === 'Enter' && selected?.kind === 'file') {
      e.preventDefault();
      open(selected.file);
    }
  };

  if (!ws) return <EmptyState title="Workspace not found" hint="It may have been archived. Recently lists what you can still reach." />;

  const ctx = `ws:${wsId}`;
  const panel = !selected ? (
    <EmptyState title="Nothing selected" hint="Choose a file in the list to see its details." />
  ) : selected.kind === 'file' ? (
    <FilePanel file={selected.file} onOpen={() => open(selected.file)} />
  ) : (
    <TombstonePanel tab={selected.tab} onDismiss={() => closeObjectTab(ctx, selected.tab.id)} />
  );

  return (
    <WorkspaceLayout
      wsId={wsId}
      panelTitle="Details"
      panelMeta={`${items.length} items`}
      panel={panel}
    >
      <div className={s.crumbs}>
        <span className={s.crumbRoot}>{ws.name}</span>
        <IconChevron size={11} />
        <span>{folders.find((f) => f.id === folderId)?.name ?? 'All files'}</span>
        <span className={s.crumbTail}>· {items.length} items</span>
        <div className={s.crumbsActions}>
          <Button
            size="sm"
            icon={<IconUpload size={13} />}
            disabled
            title="Needs the files service — not connected in this build"
            aria-describedby="files-limit"
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled
            title="Needs the files service — not connected in this build"
            aria-describedby="files-limit"
          >
            New folder
          </Button>
          {!panelOpen ? (
            <Button size="sm" variant="ghost" onClick={togglePanel}>
              Show details
            </Button>
          ) : null}
        </div>
      </div>

      <p className={g.limit} id="files-limit">
        Uploading and creating folders need the files service — not connected in this build.
      </p>

      <div className={s.body}>
        <nav className={s.tree} aria-label="Folders" data-scroll-region="files-tree">
          {folders.map((folder) => {
            const count = filesInFolder(wsId, folder.id).length;
            const isOpen = expanded.includes(folder.id);
            const active = folder.id === folderId;
            return (
              <div key={folder.id}>
                <div className={[s.treeRow, active ? s.treeActive : ''].join(' ')}>
                  <button
                    type="button"
                    className={s.treeToggle}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.name}`}
                    onClick={() =>
                      setExpanded((v) =>
                        v.includes(folder.id) ? v.filter((x) => x !== folder.id) : [...v, folder.id],
                      )
                    }
                  >
                    <span className={s.treeChevron} data-open={isOpen || undefined}>
                      <IconChevron size={11} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className={s.treeSelect}
                    onClick={() => {
                      setFolderId(folder.id);
                      setExpanded((v) => (v.includes(folder.id) ? v : [...v, folder.id]));
                    }}
                    aria-current={active ? 'true' : undefined}
                  >
                    <IconFolder size={13} />
                    <span className={s.treeName}>{folder.name}</span>
                    <span className={s.treeCount}>{count}</span>
                  </button>
                </div>
                {isOpen ? (
                  <div className={s.treeChildren}>
                    {filesInFolder(wsId, folder.id)
                      .slice(0, 4)
                      .map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className={[s.treeChild, file.id === selectedKey ? s.treeChildActive : ''].join(' ')}
                          onClick={() => {
                            setFolderId(folder.id);
                            setSelectedKey(file.id);
                          }}
                          onDoubleClick={() => open(file)}
                        >
                          <span className={s.treeChildDot} />
                          <span className={s.treeChildName}>{file.name}</span>
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <p className={s.treeFoot}>
            {filesIn(wsId).length} files · {folders.length} folders
          </p>
        </nav>

        <div
          className={s.tableWrap}
          tabIndex={0}
          onKeyDown={onKey}
          role="grid"
          aria-label="Files"
          data-scroll-region="files-table"
        >
          <div className={s.thead} role="row">
            <span className={s.colName} role="columnheader">Name</span>
            <span className={s.colSize} role="columnheader">Size</span>
            <span className={s.colUpdated} role="columnheader">Updated</span>
            <span className={s.colSource} role="columnheader">Source</span>
            <span className={s.colUsed} role="columnheader">Used by</span>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="This folder is empty"
              hint="Files arrive here by upload, by import, or as the output of a process."
            />
          ) : (
            <div className={s.tbody} role="rowgroup">
              {items.map((item) =>
                item.kind === 'file' ? (
                  <button
                    key={item.key}
                    type="button"
                    role="row"
                    aria-selected={item.key === selectedKey}
                    className={[s.trow, item.key === selectedKey ? s.trowActive : ''].join(' ')}
                    onClick={() => setSelectedKey(item.key)}
                    onDoubleClick={() => open(item.file)}
                  >
                    <span className={s.colName} role="gridcell">
                      <TypeGlyph kind={item.file.kind} />
                      <span className={s.fileName}>{item.file.name}</span>
                      {item.file.source.kind === 'produced' ? <Badge>{item.file.source.runLabel}</Badge> : null}
                    </span>
                    <span className={[s.colSize, s.mono].join(' ')} role="gridcell">
                      {item.file.size}
                    </span>
                    <span className={[s.colUpdated, s.mono].join(' ')} role="gridcell">
                      {item.file.updated}
                    </span>
                    <span className={[s.colSource, s.monoDim].join(' ')} role="gridcell">
                      {sourceLabel(item.file)}
                    </span>
                    <span className={[s.colUsed, s.mono].join(' ')} role="gridcell">
                      {item.file.usedBy.length}
                    </span>
                  </button>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    role="row"
                    aria-selected={item.key === selectedKey}
                    data-tombstone="true"
                    className={[s.trow, s.trowTombstone, item.key === selectedKey ? s.trowActive : ''].join(' ')}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <span className={s.colName} role="gridcell">
                      <TypeGlyph kind="txt" />
                      <span className={s.fileName}>{item.tab.label}</span>
                    </span>
                    <span className={[s.colSize, s.mono].join(' ')} role="gridcell">—</span>
                    <span className={[s.colUpdated, s.mono].join(' ')} role="gridcell">—</span>
                    <span className={[s.colSource, s.monoDim].join(' ')} role="gridcell">—</span>
                    <span className={[s.colUsed, s.mono].join(' ')} role="gridcell">deleted</span>
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}

export function FileDetailPage() {
  const { wsId = '', fileId = '' } = useParams();
  const navigate = useNavigate();
  const file = getFile(fileId);
  const ws = getWorkspace(wsId);

  useRegisterTab(
    `ws:${wsId}`,
    file ? { type: 'file', label: file.name, path: routes.file(wsId, fileId) } : null,
  );

  if (!file || !ws) {
    return <EmptyState title="File not found" hint="It may have been deleted. The tab stays open so you can see where it was." />;
  }

  return (
    <WorkspaceLayout wsId={wsId} panelTitle="Details" panel={<FilePanel file={file} onOpen={() => undefined} />}>
      <div className={s.previewHead}>
        <div className={s.crumbs}>
          <button type="button" className={s.crumbLink} onClick={() => navigate(routes.files(wsId))}>
            {ws.name}
          </button>
          <IconChevron size={11} />
          <span>{foldersIn(wsId).find((f) => f.id === file.folderId)?.name}</span>
          <IconChevron size={11} />
          <span>{file.name}</span>
        </div>
        <h1 className={s.previewTitle}>{file.name}</h1>
        <p className={s.previewMeta}>
          {file.kind.toUpperCase()} · {file.size} · {file.updated} · {sourceLabel(file)}
        </p>
      </div>

      <div className={s.sheetWrap}>
        <div className={s.sheet}>
          <p className={s.sheetLine}>No file bytes are stored in this build.</p>
          <p className={s.sheetHint}>
            A preview would render here from the storage service. Until then this surface shows the
            file's identity, not its content — a broken viewer would be a worse lie.
          </p>
          <div className={s.sheetRule} />
          <div className={s.sheetFields}>
            <Field label="Kind">{file.kind.toUpperCase()}</Field>
            <Field label="Size">{file.size}</Field>
            <Field label="Produced by">{file.source.kind === 'produced' ? file.source.runLabel : '—'}</Field>
            <Field label="References">{file.usedBy.length}</Field>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
