import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { createCoworker } from '../../state/coworkers';
import { useWorkspaces } from '../../state/workspaces';
import { Button } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import a from '../artifacts/artifacts.module.css';

/**
 * Creation: name, one-paragraph brief, and an optional initial workspace.
 * Everything else is configured on the config page afterwards.
 */
export function CoworkerNew() {
  const navigate = useNavigate();
  const workspaces = useWorkspaces();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [forWork, setForWork] = useState('');
  const [notFor, setNotFor] = useState('');
  const [output, setOutput] = useState('');
  const [wsId, setWsId] = useState<string>('none');
  const ready = name.trim() !== '' && forWork.trim() !== '';

  return (
    <PlainLayout size="console">
      <header className={a.head}>
        <div className={a.headText}>
          <p className={a.eyebrow}>
            <Link to={routes.coworkers()} className={a.backLink}>
              Coworkers
            </Link>
            {' / '}New
          </p>
          <h1 className={a.title}>Create a coworker</h1>
          <p className={a.sub}>Configure the rest later.</p>
        </div>
      </header>

      <form
        className={a.form}
        data-create-coworker-form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          const created = createCoworker({
            name,
            description,
            forWork,
            notFor,
            output,
            membership: wsId === 'none' ? undefined : { wsId, role: forWork.trim().slice(0, 60) },
          });
          navigate(routes.coworker(created.id));
        }}
      >
        <div className={a.formRow}>
          <span className={a.formLabel}>Name</span>
          <input
            className={a.input}
            aria-label="Coworker name"
            value={name}
            placeholder="Protocol Reviewer"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={a.formRow}>
          <span className={a.formLabel}>
            Description<span className={a.optional}> · optional</span>
          </span>
          <input
            className={a.input}
            aria-label="Description"
            value={description}
            placeholder="One line someone else can understand"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className={a.formRow}>
          <span className={a.formLabel}>Responsible for</span>
          <textarea
            className={a.editorBody}
            aria-label="Responsible for"
            value={forWork}
            placeholder="Working domain and tasks."
            onChange={(e) => setForWork(e.target.value)}
            rows={3}
          />
        </div>
        <div className={a.formRow}>
          <span className={a.formLabel}>
            Not responsible for<span className={a.optional}> · optional</span>
          </span>
          <input
            className={a.input}
            aria-label="Not responsible for"
            value={notFor}
            placeholder="Explicit exclusions, so delegation has honest edges"
            onChange={(e) => setNotFor(e.target.value)}
          />
        </div>
        <div className={a.formRow}>
          <span className={a.formLabel}>
            What good output looks like<span className={a.optional}> · optional</span>
          </span>
          <input
            className={a.input}
            aria-label="What good output looks like"
            value={output}
            placeholder="How results will be judged"
            onChange={(e) => setOutput(e.target.value)}
          />
        </div>

        <div className={a.formRow}>
          <span className={a.formLabel}>
            Initial workspace<span className={a.optional}> · optional</span>
          </span>
          <select
            className={a.select}
            aria-label="Initial workspace"
            value={wsId}
            onChange={(e) => setWsId(e.target.value)}
          >
            <option value="none">None for now</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <span className={a.formAside}>membership grants access — nothing is implied by creating</span>
        </div>

        <div className={a.formActions}>
          <Button size="sm" variant="primary" type="submit" disabled={!ready}>
            Create coworker
          </Button>
          <span className={a.formAside}>created as active in this browser</span>
        </div>
      </form>
    </PlainLayout>
  );
}
