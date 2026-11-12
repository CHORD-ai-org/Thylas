import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { KIND_LABEL, type ArtifactKind } from '../../data/artifacts';
import { createArtifact, createExternalReference, type ExternalSystem } from '../../state/artifacts';
import { Button } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import s from './artifacts.module.css';

/**
 * Creation: five paths, progressive disclosure. Ask for a name and the first
 * thought; every other field can wait. Paths are entry points, not categories.
 */

type PathId = 'idea' | 'methodology' | 'tool' | 'coworker' | 'external';

const PATHS: { id: PathId; label: string; hint: string; kind?: ArtifactKind }[] = [
  { id: 'idea', label: 'Start with an idea', hint: 'A concept, principle, or definition. Details take shape as you write.', kind: 'concept' },
  { id: 'methodology', label: 'Create a methodology', hint: 'A repeatable procedure with preconditions and decision rules.', kind: 'methodology' },
  { id: 'tool', label: 'Create a tool or asset', hint: 'Code, a script, a prototype, or a structured plan.', kind: 'executable' },
  { id: 'coworker', label: 'Create with a Coworker', hint: 'Draft together in a conversation; the result lands here as a draft.' },
  { id: 'external', label: 'Reference an external artifact', hint: 'Notion, Obsidian, GitHub — referenced, never imported by default.', kind: 'external' },
];

const SYSTEMS: ExternalSystem[] = ['notion', 'obsidian', 'github'];

export function ArtifactNew() {
  const navigate = useNavigate();
  const [path, setPath] = useState<PathId | null>(null);

  const chosen = PATHS.find((p) => p.id === path);

  return (
    <PlainLayout size="console">
      <header className={s.head}>
        <div className={s.headText}>
          <p className={s.eyebrow}>
            <Link to={routes.artifacts()} className={s.backLink}>
              Artifacts
            </Link>
            {' / '}New
          </p>
          <h1 className={s.title}>{chosen ? chosen.label : 'Create an artifact'}</h1>
          <p className={s.sub}>
            {chosen
              ? chosen.hint
              : 'Pick how you want to begin. A name and a first thought are enough — type, status and structure come later.'}
          </p>
        </div>
      </header>

      {!chosen ? (
        <div className={s.pathGrid}>
          {PATHS.map((p) => (
            <button key={p.id} type="button" className={s.pathCard} onClick={() => setPath(p.id)} data-path={p.id}>
              <span className={s.pathLabel}>{p.label}</span>
              <span className={s.pathHint}>{p.hint}</span>
            </button>
          ))}
        </div>
      ) : path === 'coworker' ? (
        /* The honest prototype: no agent runtime exists behind this path. */
        <div className={s.form} data-coworker-prototype>
          <p className={s.hint}>
            Creating with a Coworker needs the agent runtime — it is not connected in this
            build. Nothing here can start a conversation yet, so no fake chat is offered.
            Start with an idea instead; a Coworker can pick it up later from the detail
            page's Coworker action.
          </p>
          <div className={s.formActions}>
            <Button size="sm" onClick={() => setPath(null)}>
              Choose another path
            </Button>
            <Button size="sm" variant="primary" onClick={() => setPath('idea')}>
              Start with an idea
            </Button>
          </div>
        </div>
      ) : path === 'external' ? (
        <ExternalForm onDone={(id) => navigate(routes.artifact(id))} />
      ) : (
        <NativeForm
          kind={chosen.kind ?? 'concept'}
          onDone={(id) => navigate(routes.artifact(id))}
        />
      )}
    </PlainLayout>
  );
}

function NativeForm({
  kind,
  onDone,
}: {
  kind: ArtifactKind;
  onDone: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [firstBody, setFirstBody] = useState('');
  const ready = name.trim() !== '';

  return (
    <form
      className={s.form}
      data-create-form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const created = createArtifact({
          kind,
          name,
          summary,
          firstTitle: KIND_SECTIONS_FIRST(kind),
          firstBody,
          author: 'Ceaser',
        });
        onDone(created.id);
      }}
    >
      <div className={s.formRow}>
        <span className={s.formLabel}>Name</span>
        <input
          className={s.input}
          aria-label="Artifact name"
          value={name}
          placeholder={kind === 'concept' ? 'Boundary model' : 'Untitled'}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className={s.formRow}>
        <span className={s.formLabel}>
          Summary<span className={s.optional}> · optional</span>
        </span>
        <input
          className={s.input}
          aria-label="Summary"
          value={summary}
          placeholder="One line someone else can understand"
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>
      <div className={s.formRow}>
        <span className={s.formLabel}>
          First thought<span className={s.optional}> · optional</span>
        </span>
        <textarea
          className={s.editorBody}
          aria-label="First thought"
          value={firstBody}
          placeholder={`Start writing — the rest of the ${KIND_LABEL[kind].toLowerCase()} sections are created empty and can be filled anytime.`}
          onChange={(e) => setFirstBody(e.target.value)}
          rows={6}
        />
      </div>
      <div className={s.formActions}>
        <Button size="sm" variant="primary" type="submit" disabled={!ready}>
          Create {KIND_LABEL[kind].toLowerCase()}
        </Button>
        <span className={s.formAside}>created as a draft in this browser</span>
      </div>
    </form>
  );
}

function ExternalForm({ onDone }: { onDone: (id: string) => void }) {
  const [system, setSystem] = useState<ExternalSystem>('notion');
  const [location, setLocation] = useState('');
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const ready = name.trim() !== '' && location.trim() !== '';

  return (
    <form
      className={s.form}
      data-external-form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const created = createExternalReference({
          system,
          location,
          name,
          summary,
          author: 'Ceaser',
        });
        onDone(created.id);
      }}
    >
      <div className={s.formRow}>
        <span className={s.formLabel}>System</span>
        <div className={s.radioRow} role="group" aria-label="External system">
          {SYSTEMS.map((sys) => (
            <button
              key={sys}
              type="button"
              className={[s.radio, system === sys ? s.radioOn : ''].join(' ')}
              onClick={() => setSystem(sys)}
              aria-pressed={system === sys}
            >
              {sys}
            </button>
          ))}
        </div>
      </div>
      <div className={s.formRow}>
        <span className={s.formLabel}>Location</span>
        <input
          className={s.input}
          aria-label="External location"
          value={location}
          placeholder={system === 'github' ? 'owner/repo' : system === 'obsidian' ? 'vault:research / note.md' : 'notion.so/…'}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className={s.formRow}>
        <span className={s.formLabel}>Name</span>
        <input className={s.input} aria-label="Artifact name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className={s.formRow}>
        <span className={s.formLabel}>
          Why it matters here<span className={s.optional}> · optional</span>
        </span>
        <input className={s.input} aria-label="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
      <div className={s.formActions}>
        <Button size="sm" variant="primary" type="submit" disabled={!ready}>
          Create reference
        </Button>
        <span className={s.formAside}>
          the source stays its system of record — no sync exists in this build
        </span>
      </div>
    </form>
  );
}

/** The title of the section a new artifact starts with. */
function KIND_SECTIONS_FIRST(kind: ArtifactKind): string {
  const templates: Record<ArtifactKind, string> = {
    concept: 'Definition',
    methodology: 'Purpose',
    executable: 'Description',
    product: 'Description',
    empirical: 'Observation',
    structural: 'Overview',
    external: 'Summary',
  };
  return templates[kind]!;
}
