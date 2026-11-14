import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { defaultMindFramework, mindFrameworkRows } from '../../lib/coworkers';
import { getWorkspace, workspaces } from '../../data/selectors';
import {
  addMembership,
  coworkerById,
  removeCoworker,
  removeMembership,
  saveResponsibilities,
  setCoworkerStatus,
  useCoworkers,
} from '../../state/coworkers';
import { Button, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import a from '../artifacts/artifacts.module.css';
import c from './coworker.module.css';

/**
 * Configuration: identity (read here), responsibilities (editable), workspace
 * access (add/remove), and the declared context. Toolsets and behaviour are
 * honest placeholders — no runtime exists behind them.
 */
export function CoworkerConfig() {
  const { coworkerId } = useParams();
  const navigate = useNavigate();
  useCoworkers();
  const coworker = coworkerById(coworkerId);
  const [forWork, setForWork] = useState<string | null>(null);
  const [notFor, setNotFor] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [addWs, setAddWs] = useState('none');
  const [addRole, setAddRole] = useState('');
  const [confirming, setConfirming] = useState(false);

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

  const resp = coworker.responsibilities;
  const dirty = forWork !== null || notFor !== null || output !== null;
  const joinable = workspaces().filter((w) => !coworker.memberships.some((m) => m.wsId === w.id));

  const save = () => {
    saveResponsibilities(coworker.id, {
      forWork: forWork ?? resp.forWork,
      notFor: notFor ?? resp.notFor,
      output: output ?? resp.output,
    });
    setForWork(null);
    setNotFor(null);
    setOutput(null);
  };

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>
            <Link to={routes.coworker(coworker.id)} className={a.backLink}>
              {coworker.name}
            </Link>
            {' / '}Configuration
          </p>
          <h1 className={a.title}>Configure {coworker.name}</h1>
          <p className={a.sub}>
            {coworker.description || 'No description yet.'}
          </p>
        </div>
        <div className={a.headActions}>
          <Link to={routes.coworker(coworker.id)} className={a.linkArrow}>
            Back to working page
          </Link>
        </div>
      </header>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Responsibilities</h2>
          {dirty ? (
            <Button size="sm" variant="primary" onClick={save} data-save-responsibilities>
              Save changes
            </Button>
          ) : null}
        </div>
        <div className={c.briefBlock}>
          <span className={c.briefLabel}>Responsible for</span>
          <textarea
            className={c.briefInput}
            aria-label="Responsible for"
            rows={2}
            value={forWork ?? resp.forWork}
            onChange={(e) => setForWork(e.target.value)}
          />
        </div>
        <div className={c.briefBlock}>
          <span className={c.briefLabel}>Not responsible for</span>
          <textarea
            className={c.briefInput}
            aria-label="Not responsible for"
            rows={2}
            value={notFor ?? resp.notFor}
            onChange={(e) => setNotFor(e.target.value)}
          />
        </div>
        <div className={c.briefBlock} style={{ borderBottom: 0 }}>
          <span className={c.briefLabel}>What good output looks like</span>
          <textarea
            className={c.briefInput}
            aria-label="What good output looks like"
            rows={2}
            value={output ?? resp.output}
            onChange={(e) => setOutput(e.target.value)}
          />
        </div>
      </section>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Workspace access</h2>
          <span className={a.resultNote}>membership grants access — removal never rewrites the work record</span>
        </div>
        {coworker.memberships.length === 0 ? (
          <p className={a.quiet}>No memberships — this coworker works nowhere yet.</p>
        ) : (
          <div>
            {coworker.memberships.map((m) => (
              <div key={m.wsId} className={c.membershipRow}>
                <span className={c.membershipName}>{getWorkspace(m.wsId)?.name ?? m.wsId}</span>
                <span className={c.membershipRole}>{m.role}</span>
                <Button size="sm" onClick={() => removeMembership(coworker.id, m.wsId)} data-remove-membership={m.wsId}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
        {joinable.length > 0 ? (
          <div className={a.formRow} style={{ marginTop: 10 }}>
            <div className={a.filterRow}>
              <select
                className={a.select}
                aria-label="Workspace to join"
                value={addWs}
                onChange={(e) => setAddWs(e.target.value)}
              >
                <option value="none">Choose a workspace…</option>
                {joinable.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <input
                className={a.input}
                style={{ width: 200 }}
                aria-label="Role in this workspace"
                placeholder="What it does here"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
              />
              <Button
                size="sm"
                disabled={addWs === 'none'}
                onClick={() => {
                  addMembership(coworker.id, addWs, addRole);
                  setAddWs('none');
                  setAddRole('');
                }}
                data-add-membership
              >
                Add
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Context and artifacts</h2>
        </div>
        <p className={a.quiet} style={{ marginTop: 6 }}>
          {coworker.pinnedArtifactIds.length} pinned · access follows the workspace's
          grants — nothing is implied by config alone.
        </p>
      </section>

      <section className={a.section} data-mind-framework>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Mind framework</h2>
        </div>
        <p className={a.quiet}>
          Version {coworker.mindFramework?.version ?? 1} · declared configuration, shown
          read-only. Thylas records and displays it; the runtime that would apply it is
          not connected. Nothing on this page changes how a Coworker reasons yet.
        </p>
        <div style={{ marginTop: 10 }}>
          {mindFrameworkRows(coworker.mindFramework ?? defaultMindFramework()).map((row) => (
            <div className={c.briefBlock} key={row.label}>
              <span className={c.briefLabel}>{row.label}</span>
              <p className={c.briefBody}>{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Toolsets</h2>
        </div>
        <p className={a.quiet}>Runtime not connected in this build.</p>
      </section>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Behaviour and preferences</h2>
        </div>
      </section>

      <section className={a.section}>
        <div className={a.sectionHead}>
          <h2 className={a.sectionTitle}>Status and availability</h2>
        </div>
        <p className={a.quiet}>
          Currently <strong>{coworker.status}</strong>. {coworker.status === 'paused' ? 'Paused: new conversations and runs are blocked; the record and memberships stay.' : 'Active: the coworker can be engaged in its memberships.'}
        </p>
        <div className={a.sideActions}>
          <Button size="sm" onClick={() => setCoworkerStatus(coworker.id, coworker.status === 'paused' ? 'active' : 'paused')} data-config-status>
            {coworker.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          {confirming ? null : (
            <Button size="sm" onClick={() => setConfirming(true)} data-coworker-delete>
              Delete
            </Button>
          )}
        </div>
        {confirming ? (
          <div className={a.confirmInline} role="group" aria-label={`Delete ${coworker.name}`}>
            <span>
              Delete “{coworker.name}”? Artifacts it produced keep their attribution; its
              memberships end.
            </span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <Button
                size="sm"
                className={a.danger}
                onClick={() => {
                  removeCoworker(coworker.id);
                  navigate(routes.coworkers());
                }}
              >
                Delete
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </span>
          </div>
        ) : null}
      </section>
    </PlainLayout>
  );
}
