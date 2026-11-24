import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { routes } from '../lib/routes';
import { PlainLayout } from '../shell/layouts';
import { Button, EmptyState, SectionLabel } from '../components/ui';
import { IconLink, IconPlus, IconTrash } from '../components/icons';
import { relativeTime } from '../lib/relative';
import { createProjectsClient, type ProjectsClient } from '../services/projects/client';
import {
  CONNECTION_KINDS,
  type ConnectionHealth,
  type ConnectionKind,
  type ProjectConnectionDto,
  type ProjectDto,
} from '../lib/projects';
import s from './projects.module.css';

/**
 * Project map (P1, list-first): the workspace's project cards with the
 * connection drawer behind each card. The desk (P2) is where a card opens;
 * here a card proves its identity survives anything its resources do (H1).
 */

const HEALTH_LABEL: Record<ConnectionHealth, string> = {
  ok: '正常',
  broken: '路径失效',
  unknown: '未验证',
};

const KIND_LABEL: Record<ConnectionKind, string> = {
  'local-folder': '本地文件夹',
  'github-repo': 'GitHub',
  file: '文件',
  note: '笔记',
  artifact: 'Artifact',
  'gsc-context': 'Context',
};

export function ProjectsPage() {
  const { wsId = '' } = useParams();
  const navigate = useNavigate();
  const [client] = useState<ProjectsClient>(() => createProjectsClient());
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [notice, setNotice] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [openId, setOpenId] = useState('');
  const [connections, setConnections] = useState<ProjectConnectionDto[]>([]);

  const refresh = useCallback(async () => {
    const body = await client.list(wsId);
    if (!body.ok) {
      setNotice(body.kind === 'not_configured' ? '服务未配置' : body.message);
      return;
    }
    setNotice('');
    setProjects(body.items);
  }, [client, wsId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (openId === '') {
      setConnections([]);
      return;
    }
    void client.listConnections(openId).then((body) => {
      if (body.ok && 'items' in body) setConnections(body.items);
    });
  }, [client, openId, projects]);

  const visible = useMemo(
    () => projects.filter((p) => (showArchived ? p.state === 'archived' : p.state === 'active')),
    [projects, showArchived],
  );

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const body = await client.create({ workspaceId: wsId, name: trimmed, summary: summary.trim() });
    if (!body.ok) {
      setNotice(body.message);
      return;
    }
    setName('');
    setSummary('');
    setAdding(false);
    await refresh();
  };

  const archive = async (project: ProjectDto) => {
    await client.patch(project.id, { state: project.state === 'archived' ? 'active' : 'archived' });
    await refresh();
  };

  const remove = async (project: ProjectDto) => {
    await client.remove(project.id);
    if (openId === project.id) setOpenId('');
    await refresh();
  };

  const addConnection = async (kind: ConnectionKind, locator: string) => {
    const trimmed = locator.trim();
    if (trimmed === '') return;
    const body = await client.createConnection(openId, { kind, locator: trimmed });
    if (!body.ok) setNotice(body.message);
    const list = await client.listConnections(openId);
    if (list.ok && 'items' in list) setConnections(list.items);
  };

  return (
    <PlainLayout wide>
      <div className={s.page} data-projects-page>
        <header className={s.head}>
          <h1 className={s.title}>项目地图</h1>
          <div className={s.filters}>
            <button
              type="button"
              className={showArchived ? s.filter : s.filterOn}
              onClick={() => setShowArchived(false)}
            >
              活跃
            </button>
            <button
              type="button"
              className={showArchived ? s.filterOn : s.filter}
              onClick={() => setShowArchived(true)}
            >
              归档
            </button>
          </div>
          <Button size="sm" onClick={() => setAdding((v) => !v)} data-add-project>
            <IconPlus size={12} /> 新建项目
          </Button>
        </header>

        {notice === '' ? null : <p className={s.notice} data-projects-notice>{notice}</p>}

        {adding ? (
          <div className={s.form}>
            <input
              className={s.input}
              placeholder="项目名"
              aria-label="项目名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-project-name
            />
            <input
              className={s.input}
              placeholder="一句话摘要（可空）"
              aria-label="摘要"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              data-project-summary
            />
            <Button size="sm" onClick={submit} data-project-create>
              创建
            </Button>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            title={showArchived ? '没有归档的项目' : '把工作聚成项目'}
            hint={showArchived ? '归档后在这里找回' : '新建项目，把材料连进来'}
          />
        ) : (
          <ul className={s.cards} data-project-cards>
            {visible.map((project) => (
              <li key={project.id} className={s.card} data-project-card={project.id}>
                <button
                  type="button"
                  className={s.cardMain}
                  onClick={() => setOpenId((id) => (id === project.id ? '' : project.id))}
                  aria-expanded={openId === project.id}
                >
                  <span className={s.cardName}>{project.name}</span>
                  <span className={s.cardSummary}>{project.summary}</span>
                  <span className={s.cardMeta}>活跃于 {relativeTime(Date.parse(project.updatedAt))}</span>
                </button>
                <div className={s.cardActions}>
                  <Button size="sm" variant="primary" onClick={() => navigate(routes.projectDetail(wsId, project.id))} data-project-open>
                    打开
                  </Button>
                  <Button size="sm" onClick={() => archive(project)} data-project-archive>
                    {project.state === 'archived' ? '恢复' : '归档'}
                  </Button>
                  <button
                    type="button"
                    className={s.iconAction}
                    aria-label="删除"
                    title="删除"
                    onClick={() => remove(project)}
                    data-project-delete
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
                {openId === project.id ? (
                  <ConnectionDrawer
                    connections={connections}
                    onAdd={addConnection}
                    onCheck={async (connectionId) => {
                      await client.checkConnection(project.id, connectionId);
                      const list = await client.listConnections(project.id);
                      if (list.ok && 'items' in list) setConnections(list.items);
                    }}
                    onRemove={async (connectionId) => {
                      await client.removeConnection(project.id, connectionId);
                      const list = await client.listConnections(project.id);
                      if (list.ok && 'items' in list) setConnections(list.items);
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PlainLayout>
  );
}

export function ConnectionDrawer({
  connections,
  onAdd,
  onCheck,
  onRemove,
}: {
  connections: ProjectConnectionDto[];
  onAdd: (kind: ConnectionKind, locator: string) => Promise<void>;
  onCheck: (connectionId: string) => Promise<void>;
  onRemove: (connectionId: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<ConnectionKind>('local-folder');
  const [locator, setLocator] = useState('');

  return (
    <div className={s.drawer} data-connection-drawer>
      <SectionLabel>连接</SectionLabel>
      {connections.length === 0 ? (
        <p className={s.drawerEmpty}>还没有连接</p>
      ) : (
        <ul className={s.connections}>
          {connections.map((connection) => (
            <li key={connection.id} className={s.connection} data-connection={connection.id}>
              <IconLink size={12} />
              <span className={s.connectionKind}>{KIND_LABEL[connection.kind]}</span>
              <span className={s.connectionLocator} title={connection.locator}>
                {connection.locator}
              </span>
              <span className={s[`health-${connection.health}`]}>{HEALTH_LABEL[connection.health]}</span>
              <Button size="sm" onClick={() => onCheck(connection.id)}>
                检查
              </Button>
              <Button size="sm" onClick={() => onRemove(connection.id)}>
                移除
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.addLine}>
        <select
          className={s.select}
          aria-label="连接类型"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConnectionKind)}
        >
          {CONNECTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
          {/* Honest limiter: named in the design, not wired — disabled with the
              reason visible before any click. */}
          <option value="cloudflare" disabled>
            cloudflare — 连接器未接入
          </option>
        </select>
        <input
          className={s.input}
          placeholder={kind === 'local-folder' ? '文件夹绝对路径' : 'owner/repo'}
          aria-label="资源地址"
          value={locator}
          onChange={(e) => setLocator(e.target.value)}
          data-connection-locator
        />
        <Button size="sm" onClick={() => onAdd(kind, locator)} data-connection-add>
          连接
        </Button>
      </div>
    </div>
  );
}
