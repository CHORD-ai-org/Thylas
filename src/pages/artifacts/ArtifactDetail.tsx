import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { KIND_LABEL } from '../../data/artifacts';
import { artifactById, removeArtifact, saveSection, setArtifactStatus, useArtifacts } from '../../state/artifacts';
import { activeConversation, addContextSource, newConversation, setDock, useChat } from '../../state/chat';
import { Button, EmptyState, IconButton } from '../../components/ui';
import { IconCheck, IconChat, IconCopy, IconPlus } from '../../components/icons';
import { PlainLayout } from '../../shell/layouts';
import s from './artifacts.module.css';

/**
 * Artifact detail: the shared frame, the kind's own sections, and the side
 * column (relations · versions · ownership). "Open Coworker interaction"
  opens the real chat dock with this artifact as declared context — no fake
 * AI panel.
 */

function when(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
}

export function ArtifactDetail() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  useArtifacts();
  const artifact = artifactById(artifactId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<'delete' | null>(null);
  const [copied, setCopied] = useState(false);

  const chat = useChat();
  const openCoworker = () => {
    const conversation = activeConversation(chat) ?? newConversation();
    addContextSource(conversation.id, {
      kind: 'note',
      name: artifact?.name ?? 'this artifact',
      detail: `artifact${artifact ? ` (${KIND_LABEL[artifact.kind]})` : ''} added from the detail page`,
    });
    setDock(true);
  };

  if (!artifact) {
    return (
      <PlainLayout size="console">
        <EmptyState
          title="No such artifact"
          hint="Deleted in this session."
          action={<Link to={routes.artifacts()} className={s.linkArrow}>Back to Artifacts</Link>}
        />
      </PlainLayout>
    );
  }

  const external = artifact.source !== 'native';
  const others = artifact.relations
    .map((r) => ({ relation: r, target: artifactById(r.targetId) }))
    .filter((x) => x.target);

  const startEdit = (sectionId: string, body: string) => {
    setEditing(sectionId);
    setDraft(body);
  };

  const saveEdit = (sectionId: string) => {
    saveSection(artifact.id, sectionId, draft, 'Ceaser');
    setEditing(null);
  };

  const copySummary = () => {
    void navigator.clipboard?.writeText(`${artifact.name} — ${artifact.summary}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <PlainLayout size="console">
      <header className={s.detailHead}>
        <div className={s.headText}>
          <p className={s.eyebrow}>
            <Link to={routes.artifacts()} className={s.backLink}>
              Artifacts
            </Link>
            {' / '}
            {KIND_LABEL[artifact.kind]}
          </p>
          <h1 className={s.title}>{artifact.name}</h1>
          <p className={s.sub}>
            <span className={s.statusChip} data-status={artifact.status}>
              {artifact.status}
            </span>
            <span className={s.headMeta}>
              {external
                ? `external · ${(artifact.source as { system: string }).system}`
                : `native · ${artifact.author}`}
              {' · '}
              updated {when(artifact.updatedAt)}
            </span>
          </p>
        </div>
        <div className={s.headActions}>
          <button type="button" className={s.coworkerBtn} onClick={openCoworker} data-open-coworker>
            <IconChat size={13} /> Coworker
          </button>
          {editing === null ? (
            <Button size="sm" variant="primary" onClick={() => startEdit(artifact.sections[0]!.id, artifact.sections[0]!.body)} data-edit-artifact>
              Edit
            </Button>
          ) : null}
        </div>
      </header>

      {external ? (
        <p className={s.externalBand}>
          External artifact — the source is its system of record; nothing syncs in this build.
          <a
            className={s.linkArrow}
            href={
              (artifact.source as { system: string; location: string }).system === 'github'
                ? `https://github.com/${(artifact.source as { location: string }).location}`
                : '#'
            }
            target="_blank"
            rel="noreferrer"
            style={{ marginLeft: 10 }}
          >
            Open source
          </a>
        </p>
      ) : null}

      <div className={s.detailGrid}>
        <div className={s.detailMain}>
          {editing !== null ? (
            <div className={s.editor} data-editing>
              <div className={s.editorHead}>
                <span className={s.editorTitle}>
                  Editing “{artifact.sections.find((sec) => sec.id === editing)?.title ?? ''}
                </span>
                <span className={s.editorHint}>saving creates a new version</span>
              </div>
              <textarea
                className={s.editorBody}
                aria-label="Section content"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={8}
              />
              <div className={s.editorActions}>
                <Button size="sm" variant="primary" onClick={() => saveEdit(editing)} data-save-section>
                  Save as new version
                </Button>
                <Button size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {artifact.sections.map((section) => (
            <section key={section.id} className={s.section} data-section={section.id}>
              <div className={s.sectionHead}>
                <h2 className={s.sectionTitle}>{section.title}</h2>
                <span className={s.sectionActions}>
                  <IconButton
                    label={`Edit ${section.title}`}
                    onClick={() => startEdit(section.id, section.body)}
                  >
                    <IconPlus size={11} />
                  </IconButton>
                  <IconButton label="Copy section" onClick={() => void navigator.clipboard?.writeText(section.body)}>
                    <IconCopy size={11} />
                  </IconButton>
                </span>
              </div>
              {editing === section.id ? (
                <p className={s.quiet} style={{ fontStyle: 'italic' }}>
                  Editing above.
                </p>
              ) : section.body.trim() === '' ? (
                <p className={s.quiet} style={{ fontStyle: 'italic' }}>
                  Empty — edit to fill this section.
                </p>
              ) : (
                <p className={s.sectionBody}>{section.body}</p>
              )}
            </section>
          ))}
        </div>

        <div className={s.detailSide}>
          <section className={s.sideSection}>
            <h2 className={s.sectionTitle}>Relations</h2>
            {others.length === 0 ? (
              <p className={s.quiet}>No relations yet. Related artifacts appear here.</p>
            ) : (
              <ul className={s.relationList}>
                {others.map(({ relation, target }) => (
                  <li key={relation.id}>
                    <Link className={s.relationRow} to={routes.artifact(target!.id)} data-relation-row={target!.id}>
                      <span className={s.relationLabel}>{relation.label}</span>
                      <span className={s.relationName}>{target!.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={s.sideSection}>
            <h2 className={s.sectionTitle}>Versions</h2>
            <div className={s.versionList}>
              {[...artifact.versions].reverse().map((v) => (
                <div key={`${v.v}-${v.at}`} className={s.versionRow}>
                  <span className={s.versionV}>v{v.v}</span>
                  <span className={s.versionNote}>{v.note}</span>
                  <span className={s.versionBy}>{v.by}</span>
                  <span className={s.versionWhen}>{when(v.at)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={s.sideSection}>
            <h2 className={s.sectionTitle}>Ownership</h2>
            <p className={s.quiet}>
              {external
                ? `Source of record: ${(artifact.source as { system: string }).system} — ${(artifact.source as { location: string }).location}`
                : `Author ${artifact.author} · this workspace`}
            </p>
            <p className={s.quiet}>
              Created {when(artifact.createdAt)} · {artifact.versions.length} version
              {artifact.versions.length === 1 ? '' : 's'}
            </p>
            <div className={s.sideActions}>
              <IconButton label={copied ? 'Copied' : 'Copy summary'} onClick={copySummary}>
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </IconButton>
              {artifact.status !== 'deprecated' ? (
                <Button size="sm" onClick={() => setArtifactStatus(artifact.id, 'deprecated')} data-deprecate>
                  Deprecate
                </Button>
              ) : (
                <Button size="sm" onClick={() => setArtifactStatus(artifact.id, 'accepted')} data-deprecate>
                  Restore
                </Button>
              )}
              {confirming === null ? (
                <Button size="sm" onClick={() => setConfirming('delete')} data-delete-artifact>
                  Delete
                </Button>
              ) : null}
            </div>
            {confirming === 'delete' ? (
              <div className={s.confirmInline} role="group" aria-label={`Delete ${artifact.name}`} data-delete-confirm>
                <span>Delete “{artifact.name}”? References to it will dangle.</span>
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <Button
                    size="sm"
                    className={s.danger}
                    onClick={() => {
                      removeArtifact(artifact.id);
                      navigate(routes.artifacts());
                    }}
                  >
                    Delete
                  </Button>
                  <Button size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </span>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </PlainLayout>
  );
}
