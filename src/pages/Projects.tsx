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
  type CollaborationSessionDto,
  type HandoffDto,
  type ProjectCandidateDto,
  type ProjectConnectionDto,
  type ProjectDto,
  type ProjectMemberDto,
} from '../lib/projects';
import { coworkersView } from '../state/coworkers';
import { displayNameOf, useUser } from '../state/user';
import { runGenerationLoop } from '../services/generation/loop';
import { runCollaborationSession } from '../services/collaboration/session';
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
                  <>
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
                    <ParticipationPanel projectId={project.id} />
                  </>
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

/**
 * C2 参工与署名落回 (Coworker plan §27): the project's participants and the
 * signed outputs that landed back. Signature format follows 01 §5.3 —
 * "由 Mira 提出 · Ceaser 确认", display names, never technical actors.
 */
function ParticipationPanel({ projectId }: { projectId: string }) {
  const [client] = useState<ProjectsClient>(() => createProjectsClient());
  const [members, setMembers] = useState<ProjectMemberDto[]>([]);
  const [candidates, setCandidates] = useState<ProjectCandidateDto[]>([]);
  const [actorId, setActorId] = useState('');
  const [role, setRole] = useState('');
  const [genTask, setGenTask] = useState('');
  const [genRubric, setGenRubric] = useState('');
  const [genBusy, setGenBusy] = useState(false);
  const [genNotice, setGenNotice] = useState('');
  const [handoffs, setHandoffs] = useState<HandoffDto[]>([]);
  const [handFrom, setHandFrom] = useState('');
  const [handTo, setHandTo] = useState('');
  const [handTask, setHandTask] = useState('');
  const [sessions, setSessions] = useState<CollaborationSessionDto[]>([]);
  const [sessTask, setSessTask] = useState('');
  const [sessBusy, setSessBusy] = useState(false);
  const [sessNotice, setSessNotice] = useState('');
  const user = useUser();
  const coworkers = useMemo(() => coworkersView(), []);

  const refresh = useCallback(async () => {
    const memberBody = await client.listMembers(projectId);
    if (memberBody.ok && 'items' in memberBody) setMembers(memberBody.items);
    const candidateBody = await client.listCandidates(projectId);
    if (candidateBody.ok && 'items' in candidateBody) setCandidates(candidateBody.items);
    const handoffBody = await client.listHandoffs(projectId);
    if (handoffBody.ok && 'items' in handoffBody) setHandoffs(handoffBody.items);
    const sessionBody = await client.listSessions(projectId);
    if (sessionBody.ok && 'items' in sessionBody) setSessions(sessionBody.items);
  }, [client, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dispatch = async () => {
    const chosen = actorId || coworkers[0]?.id;
    if (!chosen) return;
    await client.upsertMember(projectId, chosen, { role, actorKind: 'coworker' });
    setActorId('');
    setRole('');
    await refresh();
  };

  return (
    <div className={s.drawer} data-participation-panel>
      <SectionLabel>参与者</SectionLabel>
      {members.length === 0 ? (
        <p className={s.drawerEmpty}>还没有派工</p>
      ) : (
        <ul className={s.connections}>
          {members.map((member) => (
            <li key={member.actorId} className={s.connection} data-member={member.actorId}>
              <span className={s.connectionKind}>{member.actorId}</span>
              <span className={s.connectionLocator}>{member.role}</span>
              <Button size="sm" onClick={async () => {
                await client.removeMember(projectId, member.actorId);
                await refresh();
              }}>
                移除
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.addLine}>
        <select
          className={s.select}
          aria-label="派给"
          value={actorId || coworkers[0]?.id || ''}
          onChange={(e) => setActorId(e.target.value)}
          data-member-actor
        >
          {coworkers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className={s.input}
          placeholder="角色（可空）"
          aria-label="角色"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <Button size="sm" onClick={dispatch} data-member-add>
          派工
        </Button>
      </div>

      <SectionLabel>产出</SectionLabel>
      <div className={s.addLine}>
        <input
          className={s.input}
          placeholder="任务（一行）"
          aria-label="生成任务"
          value={genTask}
          onChange={(e) => setGenTask(e.target.value)}
          data-gen-task
        />
        <input
          className={s.input}
          placeholder="检查清单，一行一条"
          aria-label="检查清单"
          value={genRubric}
          onChange={(e) => setGenRubric(e.target.value)}
          data-gen-rubric
        />
        <Button
          size="sm"
          disabled={genBusy || genTask.trim() === ''}
          data-gen-run
          onClick={async () => {
            const chosen = coworkers.find((c) => c.id === actorId) ?? coworkers[0];
            if (!chosen) return;
            setGenBusy(true);
            setGenNotice('生成中…第 1 轮');
            const result = await runGenerationLoop({
              coworkerId: chosen.id,
              coworkerName: chosen.name,
              projectId,
              task: genTask.trim(),
              rubric: genRubric.split('\n').map((line) => line.trim()).filter(Boolean),
            });
            setGenBusy(false);
            setGenNotice(
              result.rounds.length === 0
                ? '生成未完成——检查 AI 是否已配置'
                : result.capped
                  ? `已到轮次上限（${result.rounds.length} 轮）——产出已落回，待你确认`
                  : `第 ${result.rounds.length} 轮通过——产出已落回，待你确认`,
            );
            await refresh();
          }}
        >
          {genBusy ? '生成中…' : '生成产出'}
        </Button>
      </div>
      {genNotice === '' ? null : <p className={s.drawerEmpty} data-gen-notice>{genNotice}</p>}
      {candidates.length === 0 ? (
        <p className={s.drawerEmpty}>还没有产出</p>
      ) : (
        <ul className={s.connections}>
          {candidates.map((candidate) => (
            <li key={candidate.id} className={s.connection} data-candidate={candidate.id}>
              <span className={s.connectionLocator}>{candidate.title}</span>
              <span className={s.connectionKind}>
                由 {candidate.proposedByName} 提出
                {candidate.status === 'accepted'
                  ? ` · ${displayNameOf(user, candidate.confirmedBy ?? '')} 确认`
                  : candidate.status === 'rejected'
                    ? ' · 已驳回'
                    : ' · 待确认'}
              </span>
              {candidate.status === 'proposed' ? (
                <>
                  <Button size="sm" onClick={async () => {
                    await client.setCandidateStatus(projectId, candidate.id, true);
                    await refresh();
                  }} data-candidate-confirm>
                    确认
                  </Button>
                  <Button size="sm" onClick={async () => {
                    await client.setCandidateStatus(projectId, candidate.id, false);
                    await refresh();
                  }}>
                    驳回
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <SectionLabel>交接</SectionLabel>
      {handoffs.length === 0 ? (
        <p className={s.drawerEmpty}>还没有交接</p>
      ) : (
        <ul className={s.connections}>
          {handoffs.map((handoff) => (
            <li key={handoff.id} className={s.connection} data-handoff={handoff.id}>
              <span className={s.connectionLocator}>
                {handoff.fromName} → {handoff.toName}：{handoff.task}
              </span>
              <span className={handoff.status === 'needs_human' ? s['health-broken'] : s.connectionKind}>
                {handoff.status === 'needs_human' ? `需要你 · ${handoff.stuckNote}` : '进行中'}
              </span>
              {handoff.status === 'needs_human' ? (
                <Button size="sm" onClick={async () => {
                  await client.resumeHandoff(projectId, handoff.id);
                  await refresh();
                }} data-handoff-resume>
                  继续
                </Button>
              ) : (
                <Button size="sm" onClick={async () => {
                  await client.setHandoffStuck(projectId, handoff.id);
                  await refresh();
                }} data-handoff-stuck>
                  卡住了
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={s.addLine}>
        <select
          className={s.select}
          aria-label="交出方"
          value={handFrom || coworkers[0]?.id || ''}
          onChange={(e) => setHandFrom(e.target.value)}
        >
          {coworkers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={s.select}
          aria-label="接手方"
          value={handTo || coworkers[1]?.id || ''}
          onChange={(e) => setHandTo(e.target.value)}
        >
          {coworkers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          className={s.input}
          placeholder="交接的任务（一行）"
          aria-label="交接任务"
          value={handTask}
          onChange={(e) => setHandTask(e.target.value)}
          data-handoff-task
        />
        <Button
          size="sm"
          data-handoff-add
          onClick={async () => {
            const from = coworkers.find((c) => c.id === handFrom) ?? coworkers[0];
            const to = coworkers.find((c) => c.id === handTo) ?? coworkers[1];
            if (!from || !to || from.id === to.id || handTask.trim() === '') return;
            await client.createHandoff(projectId, {
              fromCoworkerId: from.id,
              fromName: from.name,
              toCoworkerId: to.id,
              toName: to.name,
              task: handTask.trim(),
            });
            setHandTask('');
            await refresh();
          }}
        >
          交接
        </Button>
      </div>

      <SectionLabel>协作</SectionLabel>
      {sessions.length === 0 ? (
        <p className={s.drawerEmpty}>还没有协作场次</p>
      ) : (
        <ul className={s.connections}>
          {sessions.map((sess) => (
            <li key={sess.id} className={s.connection} data-session={sess.id}>
              <span className={s.connectionLocator}>
                {sess.participants.a.name}
                {sess.participants.b ? ` × ${sess.participants.b.name}` : ''} · {sess.summary || '协作一场'}
              </span>
              <span
                className={
                  sess.state === 'needs_human' ? s['health-broken'] : s.connectionKind
                }
              >
                {sess.state === 'needs_human'
                  ? '需要你'
                  : `${sess.state} · 第 ${sess.currentStep} 步`}
              </span>
              {sess.state === 'needs_human' ? (
                <>
                  <Button size="sm" onClick={async () => {
                    await client.transitionSession(projectId, sess.id, { verb: 'approve' });
                    await refresh();
                  }} data-session-approve>
                    确认继续
                  </Button>
                  <Button size="sm" onClick={async () => {
                    await client.transitionSession(projectId, sess.id, { verb: 'reject' });
                    await refresh();
                  }}>
                    驳回
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {sessNotice === '' ? null : <p className={s.drawerEmpty} data-sess-notice>{sessNotice}</p>}
      <div className={s.addLine}>
        <input
          className={s.input}
          placeholder="协作任务（一行）"
          aria-label="协作任务"
          value={sessTask}
          onChange={(e) => setSessTask(e.target.value)}
          data-sess-task
        />
        <Button
          size="sm"
          disabled={sessBusy || sessTask.trim() === ''}
          data-sess-run
          onClick={async () => {
            const a = coworkers.find((c) => c.id === handFrom) ?? coworkers[0];
            const b = coworkers.find((c) => c.id === handTo) ?? coworkers[1] ?? coworkers[0];
            if (!a || !b || a.id === b.id) {
              setSessNotice('协作需要两名不同的同事');
              return;
            }
            setSessBusy(true);
            setSessNotice('协作进行中…');
            const created = await client.createSession(projectId, {
              participants: {
                a: { coworkerId: a.id, name: a.name },
                b: { coworkerId: b.id, name: b.name },
              },
              summary: sessTask.trim().slice(0, 60),
            });
            if (!created.ok) {
              setSessBusy(false);
              setSessNotice('场次没建成——检查参与者是否还在');
              return;
            }
            const result = await runCollaborationSession({
              projectId,
              sessionId: created.item.id,
              task: sessTask.trim(),
              rubric: ['产出有来源', '结论一句话'],
            });
            setSessBusy(false);
            setSessNotice(
              result.state === 'completed'
                ? `协作完成（${result.usedSteps} 步）——产出已署名落回`
                : `${result.stoppedReason ?? '协作暂停'}——在场次里点“确认继续”`,
            );
            setSessTask('');
            await refresh();
          }}
        >
          {sessBusy ? '协作中…' : '发起协作'}
        </Button>
      </div>
    </div>
  );
}
