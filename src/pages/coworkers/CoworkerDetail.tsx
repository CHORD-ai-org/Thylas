import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { getWorkspace } from '../../data/selectors';
import { addContextSource, newConversation } from '../../state/chat';
import { activeConversation, useChat } from '../../state/chat';
import { artifactById } from '../../state/artifacts';
import { coworkersLog, coworkerById, removeCoworker, setCoworkerStatus, useCoworkers } from '../../state/coworkers';
import { Button, EmptyState } from '../../components/ui';
import { ChatCore } from '../chat/ChatCore';
import { PlainLayout } from '../../shell/layouts';
import a from '../artifacts/artifacts.module.css';
import c from './coworker.module.css';

/**
 * The working interface: conversation first (the real ChatCore), the entity's
 * identity strip above it, and a side column for Current Work, Artifacts and
 * Activity. Honest by construction: no runtime status, no invented work items.
 */
export function CoworkerDetail() {
  const { coworkerId } = useParams();
  useCoworkers();
  const chat = useChat();
  const coworker = coworkerById(coworkerId);
  const log = coworkersLog().slice(0, 6);

  /* Entering the working surface declares the Coworker as conversation context
     once — the same pattern the artifact detail page ships. */
  useEffect(() => {
    if (!coworker) return;
    const conversation = activeConversation(chat) ?? newConversation();
    addContextSource(conversation.id, {
      kind: 'note',
      name: coworker.name,
      detail: 'coworker — declared as context from its working page',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coworker?.id]);

  if (!coworker) {
    return (
      <PlainLayout size="console">
        <EmptyState
          title="No such coworker"
          hint="Deleted in this session."
          action={<Link to={routes.coworkers()} className={a.linkArrow}>Back to Coworkers</Link>}
        />
      </PlainLayout>
    );
  }

  const pinned = coworker.pinnedArtifactIds.map((id) => artifactById(id)).filter(Boolean);
  const otherWorkspaceName = (wsId: string) => getWorkspace(wsId)?.name ?? wsId;

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>
            <Link to={routes.coworkers()} className={a.backLink}>
              Coworkers
            </Link>
          </p>
          <h1 className={a.title}>{coworker.name}</h1>
          <p className={a.sub}>
            <span className={c.statusChip} data-status={coworker.status}>
              {coworker.status}
            </span>
            <span style={{ marginLeft: 8 }}>{coworker.description}</span>
          </p>
        </div>
        <div className={a.headActions}>
          {coworker.status === 'active' ? (
            <Button size="sm" onClick={() => setCoworkerStatus(coworker.id, 'paused')} data-coworker-pause>
              Pause
            </Button>
          ) : coworker.status === 'paused' ? (
            <Button size="sm" onClick={() => setCoworkerStatus(coworker.id, 'active')} data-coworker-pause>
              Resume
            </Button>
          ) : null}
          <Link to={`${routes.coworker(coworker.id)}/config`} className={a.linkArrow} data-coworker-config>
            Configure
          </Link>
        </div>
      </header>

      <div className={a.detailGrid}>
        <div className={a.detailMain}>
          <div className={c.convWrap} data-coworker-conversation>
            <p className={c.convNote}>Conversation — replies come from the model endpoint.</p>
            <ChatCore embedded />
          </div>
        </div>

        <div className={a.detailSide}>
          <section className={a.sideSection}>
            <h2 className={a.sectionTitle}>Current work</h2>
            <p className={a.quiet}>No work items yet.</p>
          </section>

          <section className={a.sideSection}>
            <h2 className={a.sectionTitle}>Artifacts</h2>
            <p className={a.quiet}>Pinned:</p>
            <ul className={a.relationList}>
              {pinned.map((artifact) => (
                <li key={artifact!.id}>
                  <Link className={a.relationRow} to={routes.artifact(artifact!.id)} data-pinned-artifact={artifact!.id}>
                    <span className={a.relationLabel}>{artifact!.kind}</span>
                    <span className={a.relationName}>{artifact!.name}</span>
                  </Link>
                </li>
              ))}
              {pinned.length === 0 ? <li className={a.quiet}>None pinned.</li> : null}
            </ul>
            <p className={a.quiet} style={{ marginTop: 8 }}>
              Artifacts this Coworker produces will appear attributed to it, as drafts or
              proposals — never as overwrites of accepted work.
            </p>
          </section>

          <section className={a.sideSection}>
            <h2 className={a.sectionTitle}>Workspaces</h2>
            <div className={c.briefBlock}>
              {coworker.memberships.length === 0 ? (
                <p className={a.quiet}>No memberships — configure them on the config page.</p>
              ) : (
                coworker.memberships.map((m) => (
                  <div key={m.wsId} className={c.membershipRow}>
                    <span className={c.membershipName}>{otherWorkspaceName(m.wsId)}</span>
                    <span className={c.membershipRole}>{m.role}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={a.sideSection}>
            <h2 className={a.sectionTitle}>Activity</h2>
            {log.length === 0 ? (
              <p className={a.quiet}>No activity yet.</p>
            ) : (
              <div className={a.log}>
                {log.map((d) => (
                  <div key={d.id} className={a.logItem}>
                    <span className={a.logWhen}>{new Date(d.at).toTimeString().slice(0, 5)}</span>
                    <span>{d.text}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </PlainLayout>
  );
}

export function CoworkerDetailDeleteButton({ id }: { id: string }) {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      onClick={() => {
        removeCoworker(id);
        navigate(routes.coworkers());
      }}
    >
      Delete
    </Button>
  );
}
