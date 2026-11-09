import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  INTEGRATION_LABEL,
  PROVIDERS,
  providerOf,
  type ProviderField,
  type Resource,
  type ResourceKind,
} from '../../data/compute';
import { addResource, resourceViewOf, useCompute } from '../../state/compute';
import { Button, Chip } from '../../components/ui';
import { IconArrow, IconCheck } from '../../components/icons';
import { ComputeShell } from './ComputeShell';
import s from './compute.module.css';

/** Declared profiles. A prototype cannot measure a host it cannot reach, so the
    person says what the machine has and the detail page labels it declared. */
const PROFILES = [
  { id: 'cpu', label: 'CPU only', cpu: 'x86 workstation', cores: 8, memoryGb: 32, storageGb: 1000 },
  { id: 'consumer', label: 'Consumer GPU · 12GB', cpu: 'Ryzen 7', cores: 12, gpu: 'RTX 4070 Ti', gpuMemoryGb: 12, gpuClass: 'consumer' as const, memoryGb: 64, storageGb: 2000 },
  { id: 'workstation', label: 'Workstation GPU · 48GB', cpu: 'Xeon W', cores: 24, gpu: 'RTX A6000', gpuMemoryGb: 48, gpuClass: 'workstation' as const, memoryGb: 128, storageGb: 4000 },
  { id: 'datacenter', label: 'Datacenter GPU · 40GB', cpu: 'Xeon Gold', cores: 64, gpu: 'A100 40GB', gpuMemoryGb: 40, gpuClass: 'datacenter' as const, memoryGb: 512, storageGb: 8000 },
  { id: 'h100', label: 'Datacenter GPU · 80GB', cpu: 'Xeon Platinum', cores: 48, gpu: 'H100 80GB', gpuMemoryGb: 80, gpuClass: 'datacenter' as const, memoryGb: 256, storageGb: 2000 },
];

const KIND_OPTIONS: { id: ResourceKind; label: string; providerId: string; blurb: string }[] = [
  { id: 'local', label: 'Add local machine', providerId: 'p-local', blurb: 'A machine running the Thylas agent: this one, or another on your network.' },
  { id: 'ssh', label: 'Connect via SSH', providerId: 'p-ssh', blurb: 'Any host you already have a shell on. Nothing is installed on it.' },
  { id: 'instance', label: 'Connect cloud provider', providerId: 'p-aws', blurb: 'A provider account. The registry decides which fields this needs.' },
];

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'machine';
}

export function ComputeAddResource() {
  useCompute();

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialProvider = params.get('provider');
  const initialKind = KIND_OPTIONS.find((k) => k.providerId === initialProvider)?.id ?? null;

  const [kind, setKind] = useState<ResourceKind | null>(initialKind);
  const [providerId, setProviderId] = useState(initialProvider ?? 'p-aws');
  const [step, setStep] = useState<'kind' | 'details' | 'verify'>(initialKind ? 'details' : 'kind');
  const [name, setName] = useState('');
  const [scope, setScope] = useState<'personal' | 'org'>('personal');
  const [values, setValues] = useState<Record<string, string>>({});
  const [profileId, setProfileId] = useState('workstation');
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'done'>('idle');
  const [created, setCreated] = useState<Resource | null>(null);
  const [touched, setTouched] = useState(false);

  const provider = providerOf(kind === 'local' ? 'p-local' : kind === 'ssh' ? 'p-ssh' : providerId) ?? PROVIDERS[0]!;
  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0]!;
  const fields: ProviderField[] = provider.fields;

  /* A select shows its first option, so that option is already the answer; the
     state starts empty and validation must not call it missing. */
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        fields.filter((f) => f.kind === 'select').map((f) => [f.id, f.options?.[0] ?? '']),
      ) as Record<string, string>,
    [fields],
  );
  const effective = { ...defaults, ...values };

  const suggested = useMemo(() => {
    const hint = values.host || values.agent || '';
    return hint ? slug(hint) : '';
  }, [values.host, values.agent]);

  const set = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setError(null);
  };

  const missing = fields.filter((f) => !f.optional && !(effective[f.id] ?? '').trim());

  const submit = () => {
    setTouched(true);
    if (missing.length > 0) {
      setError(`Fill ${missing.map((f) => f.label.toLowerCase()).join(', ')} before checking the connection.`);
      return;
    }
    setPhase('checking');
    setError(null);
    window.setTimeout(() => {
      /* Deterministic failure, so the error state can be demonstrated: a host
         named unreachable, or a cloud account with no secret. */
      const host = (effective.host ?? '').toLowerCase();
      const willFail =
        host.includes('unreachable') || host.includes('fail') || (kind === 'instance' && !(effective.secret ?? '').trim());
      if (willFail) {
        setPhase('idle');
        setError(
          host.includes('unreachable') || host.includes('fail')
            ? 'The host did not answer within 5s. Nothing was added: a machine Thylas cannot read is not a resource it can report on.'
            : 'The provider rejected the request: no access key was supplied.',
        );
        return;
      }
      const resource: Resource = {
        id: `r-${slug(name || suggested || provider.name)}-${Date.now().toString(36)}`,
        name: name.trim() || suggested || `${provider.name} machine`,
        providerId: provider.id,
        kind: kind ?? 'ssh',
        scope,
        owner: scope === 'org' ? 'Research' : 'Ceaser',
        hardware: {
          cpu: profile.cpu,
          cores: profile.cores,
          ...(profile.gpu ? { gpu: profile.gpu, gpuMemoryGb: profile.gpuMemoryGb, gpuClass: profile.gpuClass } : {}),
          memoryGb: profile.memoryGb,
          storageGb: profile.storageGb,
        },
        os: kind === 'instance' ? 'Not read yet' : kind === 'local' ? 'This machine' : 'Not read yet',
        runtime: [],
        connection: 'connected',
        availability: 'available',
        workloads: 0,
        lastSeen: 'just now',
        declared: true,
        note: 'Added in this session. Hardware is declared, not measured: this build cannot query a real host.',
      };
      addResource(resource);
      setPhase('done');
      setCreated(resource);
    }, 1100);
  };

  if (created) {
    const view = resourceViewOf(created.id) ?? created;
    return (
      <ComputeShell title="Machine added" sub="It is in the pool. Nothing is running on it.">
        <div className={s.doneCard}>
          <span className={s.doneMark} aria-hidden>
            <IconCheck size={18} />
          </span>
          <div>
            <p className={s.doneTitle}>{view.name}</p>
            <p className={s.doneMeta}>
              {provider.name} · declared {profile.label.toLowerCase()} · {scope === 'org' ? 'shared with Research' : 'personal'}
            </p>
            <p className={s.doneNote}>
              Hardware in this record was declared in the form, not measured. A real agent would replace
              it on the first poll.
            </p>
          </div>
          <div className={s.doneActions}>
            <Button onClick={() => navigate(routes.computeResource(view.id))}>Open the machine</Button>
            <Button variant="ghost" onClick={() => navigate(routes.computeResources())}>
              Back to the pool
            </Button>
          </div>
        </div>
      </ComputeShell>
    );
  }

  return (
    <ComputeShell
      title="Add a resource"
      sub="One flow for three kinds of machine. The fields come from the provider's own declaration, so a new provider does not need a new page."
      actions={
        <Link to={routes.computeResources()} className={s.backLink}>
          Cancel
        </Link>
      }
    >
      <ol className={s.steps} aria-label="Steps">
        <li data-on={step === 'kind' || undefined} data-done={(step !== 'kind') || undefined}>
          <span className={s.stepIndex}>01</span> Choose a kind
        </li>
        <li data-on={step === 'details' || undefined} data-done={(step === 'verify') || undefined}>
          <span className={s.stepIndex}>02</span> Describe the machine
        </li>
        <li data-on={step === 'verify' || undefined}>
          <span className={s.stepIndex}>03</span> Verify
        </li>
      </ol>

      {step === 'kind' ? (
        <div className={s.kindGrid}>
          {KIND_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={[s.kindCard, kind === option.id ? s.kindOn : ''].join(' ')}
              onClick={() => {
                setKind(option.id);
                setProviderId(option.providerId);
                setValues({});
                setStep('details');
              }}
            >
              <span className={s.kindLabel}>{option.label}</span>
              <span className={s.kindBlurb}>{option.blurb}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 'details' ? (
        <div className={s.form}>
          {kind === 'instance' ? (
            <label className={s.formRow}>
              <span className={s.formLabel}>Provider</span>
              <select
                className={s.select}
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value);
                  setValues({});
                }}
                aria-label="Provider"
              >
                {PROVIDERS.filter((p) => p.integration !== 'planned' && p.category !== 'local' && p.category !== 'ssh').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {INTEGRATION_LABEL[p.integration]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className={s.formRow}>
            <span className={s.formLabel}>Name</span>
            <input
              className={s.input}
              value={name}
              placeholder={suggested || 'lab-02'}
              aria-label="Resource name"
              onChange={(e) => setName(e.target.value)}
            />
            <span className={s.formHint}>Shown in the pool and in every tab that points at it.</span>
          </div>

          <div className={s.formRow}>
            <span className={s.formLabel}>Scope</span>
            <div className={s.radioRow} role="radiogroup" aria-label="Scope">
              <button type="button" role="radio" aria-checked={scope === 'personal'} className={[s.radio, scope === 'personal' ? s.radioOn : ''].join(' ')} onClick={() => setScope('personal')}>
                Personal
              </button>
              <button type="button" role="radio" aria-checked={scope === 'org'} className={[s.radio, scope === 'org' ? s.radioOn : ''].join(' ')} onClick={() => setScope('org')}>
                Organization · Research
              </button>
            </div>
            <span className={s.formHint}>Scope is a label, not a permission system. Sharing rules are out of scope for this build.</span>
          </div>

          {fields.map((field) => (
            <label key={field.id} className={s.formRow}>
              <span className={s.formLabel}>
                {field.label}
                {field.optional ? <span className={s.optional}> optional</span> : null}
              </span>
              {field.kind === 'select' ? (
                <select className={s.select} value={values[field.id] ?? field.options?.[0] ?? ''} onChange={(e) => set(field.id, e.target.value)}>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={s.input}
                  type={field.kind === 'secret' ? 'password' : 'text'}
                  value={values[field.id] ?? ''}
                  placeholder={field.kind === 'secret' ? '••••••••' : ''}
                  aria-invalid={touched && !field.optional && !(values[field.id] ?? '').trim() ? true : undefined}
                  onChange={(e) => set(field.id, e.target.value)}
                  autoComplete="off"
                />
              )}
              {field.hint ? <span className={s.formHint}>{field.hint}</span> : null}
            </label>
          ))}

          <div className={s.formRow}>
            <span className={s.formLabel}>Hardware</span>
            <div className={s.chipRow}>
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={[s.chip, profileId === p.id ? s.chipOn : ''].join(' ')}
                  aria-pressed={profileId === p.id}
                  onClick={() => setProfileId(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className={s.formHint}>
              Declared, not measured. This build cannot query a host it is not really connected to.
            </span>
          </div>

          {error ? (
            <p className={s.formError} role="alert">
              {error}
            </p>
          ) : null}

          <div className={s.formActions}>
            <Button onClick={submit} disabled={phase === 'checking'} icon={<IconArrow size={13} />}>
              {phase === 'checking' ? 'Checking…' : 'Verify and add'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('kind')}>
              Back
            </Button>
            <span className={s.formAside}>
              Try a host called <code>unreachable.host</code> to see the failure state.
            </span>
          </div>
        </div>
      ) : null}

      {phase === 'checking' ? (
        <div className={s.checkBand} aria-busy="true">
          <span className={s.checkRow}>
            <Chip tone="live">Checking</Chip> Reading {provider.name} · nothing is installed on the host
          </span>
        </div>
      ) : null}

      <div className={s.specNote}>
        <p className={s.specLabel}>What this flow does</p>
        <p className={s.specBody}>
          Records a machine and its declared hardware, then marks the connection verified. It does not
          create a cloud instance, store a real secret, or run a command on the host.
        </p>
      </div>
    </ComputeShell>
  );
}
