import { useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  PROVIDERS,
  hardwareSummary,
  noMatchReason,
  rankResources,
  statusLine,
  type Recommendation,
  type Requirements,
} from '../../data/compute';
import { acceptRecommendation, resourcesView, resourceViewOf, useCompute } from '../../state/compute';
import { Badge, Button, Chip, EmptyState } from '../../components/ui';
import { IconCheck } from '../../components/icons';
import { ComputeShell } from './ComputeShell';
import { ProviderMark, StatusPair, Utilization } from './parts';
import s from './compute.module.css';

const KINDS = ['Training run', 'Evaluation', 'Batch job', 'Agent run', 'Data job', 'Indexing'];

const GPU_CLASSES: { id: string; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'consumer', label: 'Consumer' },
  { id: 'workstation', label: 'Workstation' },
  { id: 'datacenter', label: 'Datacenter' },
];

/**
 * Find compute: a form that turns a paragraph of requirements into a ranked
 * list with reasons. It is the assisted half of Hybrid Coordination — the
 * ranking is a sort, the choice is the reader's, and accepting records a target
 * rather than starting anything.
 */
export function ComputeFind() {
  useCompute();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>(KINDS[0] ?? 'Training run');
  const [gpuClass, setGpuClass] = useState('any');
  const [minGpu, setMinGpu] = useState('');
  const [minCores, setMinCores] = useState('');
  const [minMemory, setMinMemory] = useState('');
  const [providerId, setProviderId] = useState('all');
  const [scope, setScope] = useState<'any' | 'personal' | 'org'>('any');
  const [more, setMore] = useState(false);
  const [results, setResults] = useState<Recommendation[] | null>(null);
  const [assigned, setAssigned] = useState<{ name: string; resource: string; resourceId: string; workloadId: string } | null>(null);

  const req: Requirements = {
    name,
    kind,
    ...(gpuClass !== 'any' ? { gpuClass: gpuClass as Requirements['gpuClass'] } : {}),
    ...(minGpu ? { minGpuMemoryGb: Number(minGpu) } : {}),
    ...(minCores ? { minCores: Number(minCores) } : {}),
    ...(minMemory ? { minMemoryGb: Number(minMemory) } : {}),
    ...(providerId !== 'all' ? { providerId } : {}),
    scope,
  };

  const search = () => setResults(rankResources(req, resourcesView()));

  const choose = (resourceId: string) => {
    const workload = acceptRecommendation(req, resourceId);
    const view = resourceViewOf(resourceId);
    setAssigned({ name: workload.name, resource: view?.name ?? resourceId, resourceId, workloadId: workload.id });
  };

  const reset = () => {
    setResults(null);
    setAssigned(null);
  };

  return (
    <ComputeShell
      sub="State what a workload needs. Thylas ranks the machines it can see and says why each one fits or does not. You choose; nothing starts."
    >
      <div className={s.findGrid}>
        <form
          className={s.findForm}
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <p className={s.findEyebrow}>Requirements</p>

          <label className={s.formRow}>
            <span className={s.formLabel}>Workload name</span>
            <input
              className={s.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ablation-8"
              aria-label="Workload name"
            />
          </label>

          <label className={s.formRow}>
            <span className={s.formLabel}>Workload type</span>
            <select className={s.select} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Workload type">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>

          <div className={s.formRow}>
            <span className={s.formLabel}>GPU class</span>
            <div className={s.chipRow}>
              {GPU_CLASSES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={[s.chip, gpuClass === g.id ? s.chipOn : ''].join(' ')}
                  aria-pressed={gpuClass === g.id}
                  onClick={() => setGpuClass(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <label className={s.formRow}>
            <span className={s.formLabel}>Minimum GPU memory</span>
            <div className={s.inlineField}>
              <input
                className={s.input}
                type="number"
                min={0}
                step={8}
                value={minGpu}
                onChange={(e) => setMinGpu(e.target.value)}
                placeholder="any"
                aria-label="Minimum GPU memory in GB"
              />
              <span className={s.unit}>GB</span>
            </div>
            <div className={s.chipRow}>
              {[12, 24, 40, 80].map((gb) => (
                <button
                  key={gb}
                  type="button"
                  className={[s.chip, minGpu === String(gb) ? s.chipOn : ''].join(' ')}
                  onClick={() => setMinGpu(minGpu === String(gb) ? '' : String(gb))}
                >
                  {gb}GB
                </button>
              ))}
            </div>
          </label>

          <button type="button" className={s.moreToggle} aria-expanded={more} onClick={() => setMore((v) => !v)}>
            {more ? '− Fewer constraints' : '+ More constraints'}
          </button>

          {more ? (
            <>
              <label className={s.formRow}>
                <span className={s.formLabel}>Minimum cores</span>
                <input
                  className={s.input}
                  type="number"
                  min={0}
                  value={minCores}
                  onChange={(e) => setMinCores(e.target.value)}
                  placeholder="any"
                  aria-label="Minimum cores"
                />
              </label>
              <label className={s.formRow}>
                <span className={s.formLabel}>Minimum memory</span>
                <div className={s.inlineField}>
                  <input
                    className={s.input}
                    type="number"
                    min={0}
                    value={minMemory}
                    onChange={(e) => setMinMemory(e.target.value)}
                    placeholder="any"
                    aria-label="Minimum memory in GB"
                  />
                  <span className={s.unit}>GB</span>
                </div>
              </label>
              <label className={s.formRow}>
                <span className={s.formLabel}>Preferred provider</span>
                <select className={s.select} value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label="Preferred provider">
                  <option value="all">No preference</option>
                  {PROVIDERS.filter((p) => p.integration !== 'planned').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className={s.formRow}>
                <span className={s.formLabel}>Scope</span>
                <div className={s.chipRow}>
                  {(['any', 'personal', 'org'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={[s.chip, scope === v ? s.chipOn : ''].join(' ')}
                      aria-pressed={scope === v}
                      onClick={() => setScope(v)}
                    >
                      {v === 'any' ? 'Any' : v === 'org' ? 'Organization' : 'Personal'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className={s.formActions}>
            <Button type="submit" icon={<IconCheck size={13} />}>
              Find machines
            </Button>
            {results ? (
              <Button variant="ghost" onClick={reset}>
                Clear results
              </Button>
            ) : null}
          </div>

          <p className={s.findNote}>
            Cost is not shown: no provider in this build reports a rate. The ranking uses free GPU memory,
            idle state, ownership and how much hardware the request would waste.
          </p>
        </form>

        <div className={s.findResults} aria-live="polite">
          {assigned ? (
            <div className={s.assignedBand}>
              <span className={s.assignedTitle}>
                <Chip tone="ok">Assigned</Chip> {assigned.name} → {assigned.resource}
              </span>
              <p className={s.assignedNote}>
                Recorded as queued. Thylas does not start work in this build, so this run has a target
                and no executor.
                {(() => {
                  const target = resourceViewOf(assigned.resourceId);
                  if (!target) return null;
                  const line = statusLine(target);
                  return line.startsWith('Connected · Available') ? null : (
                    <>
                      {' '}
                      <strong>{target.name}</strong> reports <em>{line}</em>, so it would wait rather than
                      start.
                    </>
                  );
                })()}
              </p>
              <Link to={routes.computeWorkload(assigned.workloadId)} className={s.linkArrow}>
                Open the queued workload
              </Link>
            </div>
          ) : null}

          {!results ? (
            <div className={s.findIntro}>
              <p className={s.findIntroTitle}>Nothing has been searched yet.</p>
              <p className={s.findIntroBody}>
                Every machine in the pool is a candidate. A requirement removes machines; it does not
                order them. What remains is ranked by how well it fits, with the reasons shown, so a
                recommendation can be argued with.
              </p>
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              title="No machine fits"
              hint={noMatchReason(req)}
              action={
                minGpu ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMinGpu('');
                      setResults(rankResources({ ...req, minGpuMemoryGb: undefined }, resourcesView()));
                    }}
                  >
                    Drop the GPU memory requirement
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className={s.resultLine}>
                <span className={s.resultCount}>
                  {results.length} machine{results.length === 1 ? '' : 's'} fit
                </span>
                <span className={s.resultNote}>Ranked, not scheduled</span>
              </p>
              <ol className={s.recList}>
                {results.map((rec, i) => (
                  <li key={rec.resource.id} className={s.rec} data-top={i === 0 || undefined}>
                    <div className={s.recHead}>
                      <span className={s.recRank}>{String(i + 1).padStart(2, '0')}</span>
                      <ProviderMark providerId={rec.resource.providerId} />
                      <span className={s.recName}>
                        {rec.resource.name}
                        <Badge>{rec.resource.scope === 'org' ? 'ORG' : 'PERSONAL'}</Badge>
                      </span>
                      <span className={s.recScore} title={`Fit ${rec.score} of 100`}>
                        <span className={s.recScoreTrack}>
                          <span className={s.recScoreFill} style={{ width: `${rec.score}%` }} />
                        </span>
                        {rec.score}
                      </span>
                    </div>

                    <p className={s.recHardware}>{hardwareSummary(rec.resource.hardware)}</p>
                    <div className={s.recStatus}>
                      <StatusPair resource={rec.resource} />
                    </div>
                    <Utilization resource={rec.resource} />

                    <ul className={s.recReasons}>
                      {rec.reasons.map((reason) => (
                        <li key={reason}>
                          <span className={s.reasonMark} aria-hidden>
                            <IconCheck size={11} />
                          </span>
                          {reason}
                        </li>
                      ))}
                      {rec.caveats.map((caveat) => (
                        <li key={caveat} className={s.caveat}>
                          <span className={s.caveatMark} aria-hidden>
                            !
                          </span>
                          {caveat}
                        </li>
                      ))}
                    </ul>

                    <div className={s.recActions}>
                      <Button size="sm" onClick={() => choose(rec.resource.id)}>
                        Choose this
                      </Button>
                      <Link to={routes.computeResource(rec.resource.id)} className={s.linkArrow}>
                        Open the machine
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </ComputeShell>
  );
}
