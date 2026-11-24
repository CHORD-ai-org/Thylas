import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlainLayout } from '../shell/layouts';
import { Button, EmptyState, SectionLabel } from '../components/ui';
import { IconLink, IconSearch } from '../components/icons';
import { getWorkspace } from '../data/selectors';
import { routes } from '../lib/routes';
import type { FolderEntry, ProjectConnectionDto, ProjectDto } from '../lib/projects';
import { createProjectsClient, type ProjectsClient } from '../services/projects/client';
import {
  addUserMessage,
  appendDelta,
  beginAssistantMessage,
  finishAssistantMessage,
  newConversation,
  openConversation,
  setDock,
  useChat,
} from '../state/chat';
import { useAiSelection } from '../state/ai';
import { streamChat } from '../services/ai/stream';
import { ConnectionDrawer } from './Projects';
import s from './projectDetail.module.css';

/**
 * Project detail (08 P0-1..P0-4): identity head + brief + next-step desk +
 * custom-block area + a collapsible worktree rail (default collapsed, Q5).
 * Everything visible is real — the toolbar marks what is not wired yet with a
 * stated reason instead of faking it (interaction contract).
 */
export function ProjectDetailPage() {
  const { wsId = '', projectId = '' } = useParams();
  const navigate = useNavigate();
  const [client] = useState<ProjectsClient>(() => createProjectsClient());
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [connections, setConnections] = useState<ProjectConnectionDto[]>([]);
  const [loadError, setLoadError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [ask, setAsk] = useState('');
  const chat = useChat();
  const selection = useAiSelection();

  const refreshConnections = useCallback(
    async (id: string) => {
      const body = await client.listConnections(id);
      if (body.ok && 'items' in body) setConnections(body.items);
    },
    [client],
  );

  useEffect(() => {
    let alive = true;
    void client.get(projectId).then((body) => {
      if (!alive) return;
      if (body.ok && 'item' in body) {
        setProject(body.item);
        void refreshConnections(projectId);
      } else {
        setLoadError('ok' in body ? body.message : 'The project could not be loaded.');
      }
    });
    return () => {
      alive = false;
    };
  }, [client, projectId, refreshConnections]);

  /* ⌘J: the conversation drawer is the phone beside the desk. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setDock(!chat.dock.open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chat.dock.open]);

  const submitAsk = async () => {
    const text = ask.trim();
    if (!text) return;
    setAsk('');
    const created = newConversation();
    openConversation(created.id);
    addUserMessage(created.id, text);
    const assistant = beginAssistantMessage(created.id);
    setDock(true);
    const controller = new AbortController();
    const result = await streamChat(
      text,
      [],
      controller.signal,
      (chunk) => appendDelta(created.id, assistant.id, chunk),
      selection,
    );
    if (result.ok) {
      finishAssistantMessage(
        created.id,
        assistant.id,
        result.stopped ? { stopped: true } : { model: result.model || 'model unknown', ms: result.ms },
      );
    } else {
      finishAssistantMessage(created.id, assistant.id, { error: result.error });
    }
  };

  const ws = getWorkspace(wsId);
  if (!ws) {
    return (
      <PlainLayout>
        <EmptyState title="Workspace not found" hint="It may have been archived." />
      </PlainLayout>
    );
  }
  if (loadError) {
    return (
      <PlainLayout>
        <EmptyState title="Project not found" hint={loadError} />
      </PlainLayout>
    );
  }
  if (!project) {
    return (
      <PlainLayout>
        <EmptyState title="Loading" hint="Opening the project…" />
      </PlainLayout>
    );
  }

  return (
    <PlainLayout wide>
      <div className={s.page} data-project-detail>
        <header className={s.topbar}>
          <button type="button" className={s.thumb} aria-label="返回项目地图" title="返回项目地图" onClick={() => navigate(routes.projects(wsId))}>
            {project.name.slice(0, 1)}
          </button>
          <div className={s.identity}>
            <h1 className={s.name} data-project-title>
              {project.name}
            </h1>
            <div className={s.quickLinks} data-project-links>
              {connections.length === 0 ? (
                <span className={s.quiet}>无连接</span>
              ) : (
                connections.map((c) =>
                  c.kind === 'github-repo' && /^[^/\s]+\/[^/\s]+$/.test(c.locator) ? (
                    <a
                      key={c.id}
                      className={s.quickLink}
                      href={`https://github.com/${c.locator}`}
                      target="_blank"
                      rel="noreferrer"
                      title={c.locator}
                    >
                      {c.label || c.locator}
                    </a>
                  ) : (
                    <span key={c.id} className={s.quickLink} title={c.locator}>
                      {c.label || c.locator}
                    </span>
                  ),
                )
              )}
            </div>
          </div>
          <div className={s.toolbar} role="toolbar" aria-label="项目工具">
            <button
              type="button"
              className={s.tool}
              disabled
              title="项目内搜索 — P1-5 接入"
              aria-label="搜索"
            >
              <IconSearch size={14} />
            </button>
            <button
              type="button"
              className={s.tool}
              disabled
              title="项目文档 — 组块 v1（P1-3）接入"
              aria-label="文档"
            >
              📄
            </button>
            <button
              type="button"
              className={s.tool}
              aria-pressed={drawerOpen}
              aria-label="连接"
              title="管理连接（github、本地文件夹…）"
              onClick={() => setDrawerOpen((v) => !v)}
              data-project-connections
            >
              <IconLink size={14} />
            </button>
            <button
              type="button"
              className={s.tool}
              aria-pressed={railOpen}
              aria-label="Worktree"
              title="Files / Changes"
              onClick={() => setRailOpen((v) => !v)}
              data-project-rail
            >
              ☰
            </button>
          </div>
        </header>

        {drawerOpen ? (
          <div className={s.drawer} data-project-drawer>
            <ConnectionDrawer
              connections={connections}
              onAdd={async (kind, locator) => {
                await client.createConnection(projectId, { kind, locator });
                await refreshConnections(projectId);
              }}
              onCheck={async (connectionId) => {
                await client.checkConnection(projectId, connectionId);
                await refreshConnections(projectId);
              }}
              onRemove={async (connectionId) => {
                await client.removeConnection(projectId, connectionId);
                await refreshConnections(projectId);
              }}
            />
          </div>
        ) : null}

        <section className={s.brief} data-project-brief>
          <SectionLabel>Brief Info</SectionLabel>
          <p className={s.briefText}>{project.summary || '—'}</p>
        </section>

        <div className={s.body}>
          <div className={s.main}>
            <section className={s.desk} data-project-ask>
              <SectionLabel>下一步我们干些什么？</SectionLabel>
              <form
                className={s.askRow}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitAsk();
                }}
              >
                <input
                  className={s.askInput}
                  placeholder="Ask anything"
                  aria-label="Ask anything"
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  data-project-ask-input
                />
                <Button size="sm" variant="primary" onClick={submitAsk} data-project-ask-send>
                  发送
                </Button>
              </form>
              <p className={s.quiet}>对话抽屉：⌘J</p>
            </section>

            <section className={s.blocks} data-project-blocks>
              <SectionLabel>自定义组块</SectionLabel>
              <EmptyState title="组块区" hint="文本 / 链接 / 材料块 — P1-3 接入。" />
            </section>
          </div>

          {railOpen ? (
            <aside className={s.rail} aria-label="Worktree" data-project-worktree>
              <WorktreeRail projectId={projectId} connections={connections} />
            </aside>
          ) : null}
        </div>
      </div>
    </PlainLayout>
  );
}

/* ---- worktree rail: Files | Changes ------------------------------------- */

function WorktreeRail({ projectId, connections }: { projectId: string; connections: ProjectConnectionDto[] }) {
  const [tab, setTab] = useState<'files' | 'changes'>('files');
  return (
    <div className={s.railInner}>
      <div className={s.railTabs} role="tablist" aria-label="Worktree">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'files'}
          className={[s.railTab, tab === 'files' ? s.railTabOn : ''].join(' ')}
          onClick={() => setTab('files')}
          data-worktree-tab="files"
        >
          Files
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'changes'}
          className={[s.railTab, tab === 'changes' ? s.railTabOn : ''].join(' ')}
          onClick={() => setTab('changes')}
          data-worktree-tab="changes"
        >
          Changes
        </button>
      </div>
      {tab === 'files' ? (
        <FileTree projectId={projectId} connections={connections} />
      ) : (
        /* Honest placeholder: semantic summaries need the real diff pipeline (P1-4). */
        <EmptyState title="Changes" hint="语义总结 — P1-4 接入（不是 git 记录）。" />
      )}
    </div>
  );
}

function FileTree({ projectId, connections }: { projectId: string; connections: ProjectConnectionDto[] }) {
  const [client] = useState<ProjectsClient>(() => createProjectsClient());
  /* key = `connectionId:path` → the level's entries. */
  const [levels, setLevels] = useState<Record<string, FolderEntry[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const toggle = (connection: ProjectConnectionDto, path: string) => {
    const key = `${connection.id}:${path}`;
    if (levels[key]) {
      setLevels((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    void client.listEntries(projectId, connection.id, path).then((body) => {
      if (body.ok && 'entries' in body) {
        setLevels((prev) => ({ ...prev, [key]: body.entries }));
      } else {
        setNotes((prev) => ({ ...prev, [key]: 'ok' in body ? body.message : 'Not available.' }));
      }
    });
  };

  if (connections.length === 0) {
    return <EmptyState title="无连接" hint="用 🔗 把文件夹或仓库接进来。" />;
  }

  return (
    <ul className={s.tree} data-worktree-tree>
      {connections.map((connection) => (
        <ConnectionNode
          key={connection.id}
          connection={connection}
          path=""
          depth={0}
          entries={levels}
          notes={notes}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

function ConnectionNode({
  connection,
  path,
  depth,
  entries,
  notes,
  onToggle,
}: {
  connection: ProjectConnectionDto;
  path: string;
  depth: number;
  entries: Record<string, FolderEntry[]>;
  notes: Record<string, string>;
  onToggle: (connection: ProjectConnectionDto, path: string) => void;
}) {
  const key = `${connection.id}:${path}`;
  const level = entries[key];
  const note = notes[key];
  return (
    <>
      <li className={s.treeRow} style={{ paddingLeft: depth * 14 }}>
        <button
          type="button"
          className={s.treeToggle}
          aria-expanded={level !== undefined}
          onClick={() => onToggle(connection, path)}
          data-worktree-node={path === '' ? connection.id : path}
        >
          {path === '' ? (
            <span className={s.treeRoot}>
              {connection.kind === 'local-folder' ? '📁' : 'repo'} {connection.label || connection.locator}
              <span className={s.treeHealth} data-health={connection.health}>
                {connection.health}
              </span>
            </span>
          ) : (
            path.split('/').pop()
          )}
        </button>
      </li>
      {note ? (
        <li className={s.treeNote} style={{ paddingLeft: (depth + 1) * 14 }}>
          {note}
        </li>
      ) : null}
      {level?.map((entry) =>
        entry.kind === 'dir' ? (
          <ConnectionNode
            key={`${path}/${entry.name}`}
            connection={connection}
            path={path === '' ? entry.name : `${path}/${entry.name}`}
            depth={depth + 1}
            entries={entries}
            notes={notes}
            onToggle={onToggle}
          />
        ) : (
          <li key={`${path}/${entry.name}`} className={s.treeFile} style={{ paddingLeft: (depth + 1) * 14 }}>
            {entry.name}
          </li>
        ),
      )}
    </>
  );
}
