import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import { BACKEND_CATALOG, type Backend } from '../../data/compute';
import { addBackend, saveBackendConfig } from '../../state/compute';
import { Button, EmptyState } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { ComputeShell, Section } from './parts';
import s from './compute.module.css';

/**
 * Add a backend: pick a type with a flow, fill its fields, test, save. The
 * test is deterministic — a host whose name contains "unreachable" never
 * answers — so the failure states on this page are statements, not noise.
 */
export function ComputeAddBackend() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = params.get('type');

  const selected = BACKEND_CATALOG.find((c) => c.type === type && c.configured && c.type !== 'local');

  return (
    <PlainLayout size="console">
      <ComputeShell
        title={selected ? `Add ${selected.name}` : 'Add a backend'}
        sub="Configuring creates no machine. The test is simulated here."
        actions={<Link to={routes.computeBackends()} className={s.backLink}>Backends</Link>}
      >
        {!selected ? (
          <>
            <Section title="Types with a flow">
              <div className={s.kindGrid}>
                {BACKEND_CATALOG.filter((c) => c.configured && c.type !== 'local').map((entry) => (
                  <Link key={entry.id} to={`${routes.computeAddBackend()}?type=${entry.type}`} className={s.kindCard}>
                    <span className={s.kindLabel}>{entry.name}</span>
                    <span className={s.kindBlurb}>{entry.blurb}</span>
                  </Link>
                ))}
              </div>
            </Section>
            <Section title="No flow yet">
              <p className={s.quiet}>
                {BACKEND_CATALOG.filter((c) => !c.configured)
                  .map((c) => c.name)
                  .join(', ')}{' '}
                are listed on the Backends page so the boundary is a fact, not an absence.
              </p>
            </Section>
          </>
        ) : (
          <BackendConfigForm
            source={selected}
            onDone={(id) => navigate(routes.computeBackend(id))}
          />
        )}
      </ComputeShell>
    </PlainLayout>
  );
}

/** The shared form for configuring a backend — used by Add and by Configure. */
export function BackendConfigForm({
  source,
  existing,
  onDone,
}: {
  source: Backend;
  existing?: Backend;
  onDone?: (id: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(existing?.config ?? {});
  const [testing, setTesting] = useState<'idle' | 'testing' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const willFail = Object.values(values).some((v) => v.toLowerCase().includes('unreachable'));

  const set = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  const save = () => {
    for (const field of source.fields) {
      if (!field.optional && !values[field.id]?.trim()) {
        setError(`${field.label} is required.`);
        return;
      }
    }
    setError(null);
    setTesting('testing');
    /* The test is simulated and its outcome is decided here, not at random —
       a prototype that fails at random teaches the reader nothing. */
    window.setTimeout(() => {
      setTesting('done');
      const status = willFail ? 'unreachable' : 'ready';
      if (existing) {
        saveBackendConfig(existing.id, values, status);
        onDone?.(existing.id);
        return;
      }
      const backend: Backend = {
        ...source,
        id: `b-${source.type}-${Date.now().toString(36)}`,
        name: source.type === 'ssh' ? `SSH · ${values.host ?? source.type}` : source.name,
        config: values,
        status,
        enabled: true,
        configured: true,
      };
      addBackend(backend);
      onDone?.(backend.id);
    }, 1100);
  };

  if (source.fields.length === 0) {
    return (
      <EmptyState title="Nothing to configure" hint="No fields for this type." />
    );
  }

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {error ? (
        <p className={s.formError} role="alert">
          {error}
        </p>
      ) : null}

      {source.fields.map((field) => (
        <div key={field.id} className={s.formRow}>
          <span className={s.formLabel}>
            {field.label}
            {field.optional ? <span className={s.optional}> · optional</span> : null}
          </span>
          {field.kind === 'select' ? (
            <select
              className={s.input}
              aria-label={field.label}
              value={values[field.id] ?? ''}
              onChange={(e) => set(field.id, e.target.value)}
            >
              <option value="">Choose…</option>
              {(field.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={s.input}
              aria-label={field.label}
              type={field.kind === 'secret' ? 'password' : 'text'}
              value={values[field.id] ?? ''}
              placeholder={field.hint}
              onChange={(e) => set(field.id, e.target.value)}
            />
          )}
          {field.kind === 'secret' || field.optional ? <span className={s.formHint}>{field.hint}</span> : null}
        </div>
      ))}

      {testing === 'done' ? (
        <div className={s.checkBand}>
          <span className={s.checkRow}>
            {willFail
              ? 'No answer. The backend is saved as unreachable — its targets stay out of Run until a test passes.'
              : 'Ready. The backend can take work in Run; its targets are in the pool.'}
          </span>
        </div>
      ) : null}

      <div className={s.formActions}>
        <Button size="sm" variant="primary" type="submit" disabled={testing === 'testing'}>
          {testing === 'testing' ? 'Testing…' : 'Test and save'}
        </Button>
        <span className={s.formAside}>
          A host named <code style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>unreachable.*</code> always fails — that is
          the demonstration of the failure state.
        </span>
      </div>
    </form>
  );
}
