import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  SOURCE_TYPES,
  type ProfileCandidate,
  type ProfileSourceType,
  type ProfileState,
} from '../../lib/profile';
import { profileRequest } from '../../services/profile/client';
import { Button, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import a from '../artifacts/artifacts.module.css';
import p from './profile.module.css';

/**
 * Profile Initialization — five steps, entered from the User page. Every state
 * shown here comes from the server; there is no fake progress and no local
 * "pretend" pipeline. Discovery is a single request whose answer reports each
 * source's real outcome.
 */
type Step = 'intro' | 'sources' | 'discovering' | 'review' | 'complete';

const TYPE_LABEL: Record<ProfileSourceType, string> = {
  website: 'Personal website',
  github: 'GitHub profile',
  linkedin: 'LinkedIn profile',
  portfolio: 'Public portfolio',
  article: 'Public article',
  custom: 'Custom URL',
};

const CATEGORY_LABEL: Record<string, string> = {
  basic: 'Basic information',
  interests: 'Interests',
  goals: 'Goals',
  expertise: 'Knowledge & expertise',
  preferences: 'Working preferences',
  activities: 'Ongoing activities',
};

export function ProfileInit() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [state, setState] = useState<ProfileState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ProfileSourceType>('website');
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const call = async (
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    payload?: unknown,
  ): Promise<ProfileState | null> => {
    setBusy(true);
    setError(null);
    const reply = await profileRequest(path, method, payload);
    setBusy(false);
    if (!reply.ok) {
      setError(reply.error.message);
      return null;
    }
    setState(reply.state);
    return reply.state;
  };

  useEffect(() => {
    void profileRequest('/state').then((reply) => {
      if (reply.ok) setState(reply.state);
      else setError(reply.error.message);
    });
  }, []);

  const addSource = async () => {
    const next = await call('/sources', 'POST', { type, url: url.trim() });
    if (next) setUrl('');
  };

  const discover = async () => {
    setStep('discovering');
    const next = await call('/discover', 'POST', {});
    setStep(next ? 'review' : 'sources');
  };

  const review = async (id: string, action: 'accept' | 'reject' | 'edit', content?: string) => {
    await call(`/candidates/${id}`, 'PATCH', { action, ...(content === undefined ? {} : { content }) });
    setEditing(null);
  };

  const confirmSelected = async () => {
    for (const id of selected) {
      await call(`/candidates/${id}`, 'PATCH', { action: 'accept' });
    }
    setSelected([]);
  };

  const commit = async () => {
    const next = await call('/commit', 'POST', {});
    if (next) setStep('complete');
  };

  const cancel = async () => {
    await call('/reset', 'POST', {});
    navigate(routes.user());
  };

  const pending = state?.candidates.filter((c) => c.status === 'pending') ?? [];

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>
            <Link to={routes.user()} className={a.backLink}>User</Link> / Profile initialization
          </p>
          <h1 className={a.title}>Set up your profile</h1>
          <p className={a.sub}>Only confirmed items become your profile.</p>
        </div>
        <div className={a.headActions}>
          <Button size="sm" onClick={cancel} disabled={busy}>Skip for now</Button>
        </div>
      </header>

      <ol className={p.steps} aria-label="Progress">
        {(['intro', 'sources', 'discovering', 'review', 'complete'] as Step[]).map((s, i) => (
          <li key={s} className={[p.step, step === s ? p.stepOn : ''].join(' ')} aria-current={step === s ? 'step' : undefined}>
            {i + 1}. {s[0]!.toUpperCase() + s.slice(1)}
          </li>
        ))}
      </ol>

      {error ? <p className={p.error} role="alert">{error}</p> : null}

      {step === 'intro' ? (
        <section className={a.section} data-profile-step="intro">
          <h2 className={a.sectionTitle}>A profile built from sources you choose</h2>
          <p className={a.quiet}>Public pages only; nothing is searched by name.</p>
          <p className={a.quiet} style={{ marginTop: 8 }}>
            LinkedIn and other login-walled pages cannot be retrieved here. Model-extracted items
            are labelled Explicit or Inferred; inferred items are never accepted automatically.
          </p>
          <div className={a.sideActions}>
            <Button size="sm" variant="primary" onClick={() => setStep('sources')}>Add information sources</Button>
            <Link className={a.linkArrow} to={routes.user()}>Back to User</Link>
          </div>
          {state && state.records.length > 0 ? (
            <p className={a.quiet} style={{ marginTop: 12 }}>
              {state.records.length} confirmed profile item{state.records.length === 1 ? '' : 's'} from an earlier run are kept.
            </p>
          ) : null}
        </section>
      ) : null}

      {step === 'sources' ? (
        <section className={a.section} data-profile-step="sources">
          <h2 className={a.sectionTitle}>Information sources</h2>
          <div className={p.addRow}>
            <select className={a.select} aria-label="Source type" value={type} onChange={(e) => setType(e.target.value as ProfileSourceType)}>
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <input
              className={a.input}
              aria-label="Source URL"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addSource(); }}
            />
            <Button size="sm" onClick={() => void addSource()} disabled={busy || url.trim() === ''}>Add source</Button>
          </div>
          {state && state.sources.length > 0 ? (
            <ul className={a.rows}>
              {state.sources.map((source) => (
                <li key={source.id} className={p.sourceRow}>
                  <span className={a.rowMain}>
                    <span className={a.rowTitle}>{TYPE_LABEL[source.type]} · {source.url}</span>
                    <span className={a.rowMeta}>
                      {source.status}
                      {source.retrievedAt ? ` · retrieved ${new Date(source.retrievedAt).toLocaleString()}` : ''}
                      {source.error ? ` · ${source.error}` : ''}
                    </span>
                  </span>
                  {source.status !== 'ok' ? (
                    <Button size="sm" onClick={() => void call(`/sources/${source.id}`, 'DELETE')} disabled={busy}>Remove</Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={a.quiet} style={{ marginTop: 12 }}>No sources yet. Add at least one public URL.</p>
          )}
          <div className={a.sideActions}>
            <Button size="sm" variant="primary" onClick={() => void discover()} disabled={busy || !state?.sources.length}>
              {busy ? 'Working…' : 'Discover information'}
            </Button>
            <Button size="sm" onClick={() => setStep('intro')}>Back</Button>
          </div>
        </section>
      ) : null}

      {step === 'discovering' ? (
        <section className={a.section} data-profile-step="discovering">
          <h2 className={a.sectionTitle}>Retrieving sources</h2>
          <p className={a.quiet}>Each source reports a real result.</p>
          <ul className={a.rows}>
            {state?.sources.map((source) => (
              <li key={source.id} className={p.sourceRow}>
                <span className={a.rowTitle}>{source.url}</span>
                <span className={p.statusWord} data-status={source.status}>{source.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 'review' ? (
        <section className={a.section} data-profile-step="review">
          <h2 className={a.sectionTitle}>Candidate profile</h2>
          <p className={a.quiet}>Confidence is a model self-report.</p>
          {pending.length === 0 ? (
            <EmptyState title="No candidates to review" hint="Check the sources, or finish with what you have." />
          ) : (
            <>
              <div className={p.batchBar}>
                <label className={p.checkLabel}>
                  <input type="checkbox" checked={selected.length === pending.length && pending.length > 0} onChange={(e) => setSelected(e.target.checked ? pending.map((c) => c.id) : [])} />
                  Select all pending
                </label>
                <Button size="sm" onClick={() => void confirmSelected()} disabled={busy || selected.length === 0}>Confirm selected</Button>
              </div>
              <ul className={p.candidates}>
                {pending.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    selected={selected.includes(candidate.id)}
                    onSelect={(checked) => setSelected((prev) => checked ? [...prev, candidate.id] : prev.filter((x) => x !== candidate.id))}
                    editing={editing === candidate.id}
                    draft={draft}
                    setDraft={setDraft}
                    onEdit={() => { setEditing(candidate.id); setDraft(candidate.content); }}
                    onCancelEdit={() => setEditing(null)}
                    onSave={(content) => void review(candidate.id, 'edit', content)}
                    onAccept={() => void review(candidate.id, 'accept')}
                    onReject={() => void review(candidate.id, 'reject')}
                    busy={busy}
                  />
                ))}
              </ul>
            </>
          )}
          <div className={a.sideActions}>
            <Button size="sm" variant="primary" onClick={() => void commit()} disabled={busy}>Initialize profile</Button>
            <Button size="sm" onClick={() => setStep('sources')}>Add more sources</Button>
          </div>
        </section>
      ) : null}

      {step === 'complete' ? (
        <section className={a.section} data-profile-step="complete">
          <h2 className={a.sectionTitle}>Profile initialized</h2>
          <p className={a.quiet}>Confirmed information only:</p>
          {state?.overview ? <pre className={p.overview}>{state.overview}</pre> : <p className={a.quiet}>No items were confirmed.</p>}
          <ul className={a.rows}>
            {state?.records.map((record) => (
              <li key={record.id} className={p.recordRow}>
                <span className={a.rowMain}>
                  <span className={a.rowTitle}>{record.content}</span>
                  <span className={a.rowMeta}>
                    {CATEGORY_LABEL[record.category] ?? record.category} · {record.sourceUrl} ·
                    discovered {new Date(record.discoveredAt).toLocaleString()} · confirmed {new Date(record.confirmedAt).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className={a.sideActions}>
            <Button size="sm" variant="primary" onClick={() => { setStep('sources'); setSelected([]); }}>Run discovery again</Button>
            <Link className={a.linkArrow} to={routes.user()}>Back to User</Link>
          </div>
        </section>
      ) : null}
    </PlainLayout>
  );
}

function CandidateCard({
  candidate, selected, onSelect, editing, draft, setDraft, onEdit, onCancelEdit, onSave, onAccept, onReject, busy,
}: {
  candidate: ProfileCandidate;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
  onAccept: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <li className={p.candidate} data-candidate={candidate.id}>
      <div className={p.candidateTop}>
        <label className={p.checkLabel}>
          <input type="checkbox" aria-label={`Select ${candidate.content}`} checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        </label>
        <span className={p.category}>{CATEGORY_LABEL[candidate.category] ?? candidate.category}</span>
        <span className={p.typeWord} data-type={candidate.informationType}>{candidate.informationType}</span>
        <span className={p.confidence}>model self-report {Math.round(candidate.confidence * 100)}%</span>
        <span className={p.time}>{new Date(candidate.discoveredAt).toLocaleString()}</span>
      </div>
      {editing ? (
        <div className={p.editBox}>
          <textarea className={p.editArea} aria-label="Edit candidate" value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} />
          <div className={p.actions}>
            <Button size="sm" variant="primary" onClick={() => onSave(draft)} disabled={busy || draft.trim() === ''}>Save as confirmed</Button>
            <Button size="sm" onClick={onCancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <p className={p.content}>{candidate.editedContent ?? candidate.content}</p>
          <p className={p.evidence}>Evidence: “{candidate.evidence}”</p>
          <p className={p.source}><a href={candidate.sourceUrl} target="_blank" rel="noreferrer">{candidate.sourceUrl}</a></p>
          <div className={p.actions}>
            <Button size="sm" variant="primary" onClick={onAccept} disabled={busy}>Confirm</Button>
            <Button size="sm" onClick={onEdit} disabled={busy}>Edit</Button>
            <Button size="sm" onClick={onReject} disabled={busy}>Reject</Button>
          </div>
        </>
      )}
    </li>
  );
}
