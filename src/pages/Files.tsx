import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { routes } from '../lib/routes';
import { filesInFolder, foldersIn, getFile, getWorkspace, filesIn } from '../data/selectors';
import type { FileItem } from '../data/types';
import { useApp, useRegisterTab } from '../state/app';
import { Button, EmptyState, Field, TypeGlyph, Badge } from '../components/ui';
import { IconChevron, IconFolder, IconUpload } from '../components/icons';
import { WorkspaceLayout } from '../shell/layouts';
import s from './files.module.css';

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
                <span className={s.refKind}>{ref.kind === 'board' ? '▦' : ref.kind === 'process' ? '▶' : 'N'}</span>
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

export function FilesPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const { panelOpen, togglePanel } = useApp();
  const ws = getWorkspace(wsId);
  const folders = foldersIn(wsId);
  const [folderId, setFolderId] = useState<string | null>(folders[0]?.id ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>(folders.map((f) => f.id));

  useEffect(() => {
    setFolderId(folders[0]?.id ?? null);
    setSelectedId(null);
    setExpanded(folders.map((f) => f.id));
    // folder set changes only when the workspace changes
  }, [wsId]);

  const rows = useMemo(() => filesInFolder(wsId, folderId), [wsId, folderId]);
  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  const open = (file: FileItem) => navigate(routes.file(wsId, file.id));

  const onKey = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const i = rows.findIndex((r) => r.id === selectedId);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = rows[Math.min(rows.length - 1, i + 1)] ?? rows[0];
      if (next) setSelectedId(next.id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = rows[Math.max(0, i - 1)] ?? rows[0];
      if (prev) setSelectedId(prev.id);
    } else if (e.key === 'Enter' && selected) {
      e.preventDefault();
      open(selected);
    }
  };

  if (!ws) return <EmptyState title="Workspace not found" hint="It may have been archived. Recently lists what you can still reach." />;

  return (
    <WorkspaceLayout
      wsId={wsId}
      panelTitle="Details"
      panelMeta={`${rows.length} items`}
      panel={selected ? <FilePanel file={selected} onOpen={() => open(selected)} /> : undefined}
    >
      <div className={s.crumbs}>
        <span className={s.crumbRoot}>{ws.name}</span>
        <IconChevron size={11} />
        <span>{folders.find((f) => f.id === folderId)?.name ?? 'All files'}</span>
        <span className={s.crumbTail}>· {rows.length} items</span>
        <div className={s.crumbsActions}>
          <Button
            size="sm"
            icon={<IconUpload size={13} />}
            onClick={() => setNotice('Upload needs the files service, which is not connected in this build. No file was sent.')}
          >
            Upload
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setNotice('Folder creation needs the files service, which is not connected in this build.')}
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

      {notice ? (
        <div className={s.notice} role="status">
          {notice}
          <button type="button" className={s.noticeClose} onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <div className={s.body}>
        <nav className={s.tree} aria-label="Folders" data-scroll-region="files-tree">
          {folders.map((folder) => {
            const count = filesInFolder(wsId, folder.id).length;
            const isOpen = expanded.includes(folder.id);
            const active = folder.id === folderId;
            return (
              <div key={folder.id}>
                <button
                  type="button"
                  className={[s.treeRow, active ? s.treeActive : ''].join(' ')}
                  onClick={() => {
                    setFolderId(folder.id);
                    setSelectedId(null);
                    setExpanded((v) => (v.includes(folder.id) ? v : [...v, folder.id]));
                  }}
                  aria-expanded={isOpen}
                  aria-current={active ? 'true' : undefined}
                >
                  <span
                    className={s.treeChevron}
                    data-open={isOpen || undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((v) => (v.includes(folder.id) ? v.filter((x) => x !== folder.id) : [...v, folder.id]));
                    }}
                  >
                    <IconChevron size={11} />
                  </span>
                  <IconFolder size={13} />
                  <span className={s.treeName}>{folder.name}</span>
                  <span className={s.treeCount}>{count}</span>
                </button>
                {isOpen ? (
                  <div className={s.treeChildren}>
                    {filesInFolder(wsId, folder.id)
                      .slice(0, 4)
                      .map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className={[s.treeChild, file.id === selectedId ? s.treeChildActive : ''].join(' ')}
                          onClick={() => {
                            setFolderId(folder.id);
                            setSelectedId(file.id);
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
            <span className={s.colName} role="columnheader">
              Name
            </span>
            <span className={s.colSize} role="columnheader">
              Size
            </span>
            <span className={s.colUpdated} role="columnheader">
              Updated
            </span>
            <span className={s.colSource} role="columnheader">
              Source
            </span>
            <span className={s.colUsed} role="columnheader">
              Used by
            </span>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="This folder is empty"
              hint="Files arrive here by upload, by import, or as the output of a process."
            />
          ) : (
            <div className={s.tbody} role="rowgroup">
              {rows.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  role="row"
                  aria-selected={file.id === selectedId}
                  className={[s.trow, file.id === selectedId ? s.trowActive : ''].join(' ')}
                  onClick={() => setSelectedId(file.id)}
                  onDoubleClick={() => open(file)}
                >
                  <span className={s.colName} role="gridcell">
                    <TypeGlyph kind={file.kind} />
                    <span className={s.fileName}>{file.name}</span>
                    {file.source.kind === 'produced' ? <Badge>{file.source.runLabel}</Badge> : null}
                  </span>
                  <span className={[s.colSize, s.mono].join(' ')} role="gridcell">
                    {file.size}
                  </span>
                  <span className={[s.colUpdated, s.mono].join(' ')} role="gridcell">
                    {file.updated}
                  </span>
                  <span className={[s.colSource, s.monoDim].join(' ')} role="gridcell">
                    {sourceLabel(file)}
                  </span>
                  <span className={[s.colUsed, s.mono].join(' ')} role="gridcell">
                    {file.usedBy.length}
                  </span>
                </button>
              ))}
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
