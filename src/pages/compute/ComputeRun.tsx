import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { routes } from '../../lib/routes';
import {
  EMPTY_REQUIREMENTS,
  hardwareBrief,
  noMatchReason,
  rankTargets,
  type Requirements,
} from '../../data/compute';
import { confirmTarget, targetsView, useCompute } from '../../state/compute';
import { Button } from '../../components/ui';
import { PlainLayout } from '../../shell/layouts';
import { AVAILABILITY_WORD, ComputeShell, Mark } from './parts';
import s from './compute.module.css';

/**
 * Run — Compute Selection. The central interaction: describe the work, see
 * the ranked recommendation, or pick manually from the same list. Hybrid
 * Coordination means the machine never chooses alone and the human never
 * sorts infrastructure — and confirming records a queued workload instead of
 * pretending to start one.
 */
export function ComputeRun() {
  useCompute();
  const targets = targetsView();
  const [req, setReq] = useState<Requirements>(EMPTY_REQUIREMENTS);
  const [submitted, setSubmitted] = useState<Requirements | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [chosen, setChosen] = useState<{ name: string; targetName: string } | null>(null);

  const ranked = useMemo(() => (submitted ? rankTargets(submitted, targets) : []), [submitted, targets]);
  const allEligible = useMemo(() => rankTargets({ ...EMPTY_REQUIREMENTS, scope: 'any' }, targets), [targets]);

  const set = <K extends keyof Requirements>(key: K, value: Requirements[K]) => setReq((r) => ({ ...r, [key]: value }));

  const choose = (targetId: string) => {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;
    confirmTarget(submitted ?? EMPTY_REQUIREMENTS, target);
    setChosen({ name: (submitted?.name.trim() || 'Untitled workload'), targetName: target.name });
    window.scrollTo?.(0, 0);
  };

  return (
    <PlainLayout size="console">
      <ComputeShell
        title="Run"
        sub="Choose where work runs. Describe the work, get a recommendation you can argue with, or pick the target yourself — both doors open the same pool. Confirming records a queued run; nothing starts in this build."
      >
        {chosen ? (
          <div className={s.assignedBand} role="status" data-run-assigned>
            <p className={s.assignedTitle}>Queued “{chosen.name}” on {chosen.targetName}.</p>
            <p className={s.assignedNote}>
              The run has a target and no executor — Thylas does not start work in this build. It is in{' '}
              <Link to={routes.computeActivity()} className={s.linkArrow}>Activity</Link> as queued.
            </p>
          </div>
        ) : null}

        <div className={s.runGrid}>
          <form
            className={s.runForm}
            onSubmit={(e) => {
              e.preventDefault();
              setChosen(null);
              setSubmitted({ ...req });
            }}
          >
            <span className={s.runEyebrow}>1 · The work</span>
            <div className={s.formRow}>
              <span className={s.formLabel}>Name</span>
              <input
                className={s.input}
                aria-label="Workload name"
                value={req.name}
                placeholder="tokenizer-eval"
                onChange={(e) => set('name', e.target.value)}
              />
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Kind</span>
              <select className={s.select} aria-label="Workload kind" value={req.kind} onChange={(e) => set('kind', e.target.value)}>
                {['Training', 'Evaluation', 'Data job', 'Development environment', 'Build'].map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <span className={s.runEyebrow}>2 · Requirements</span>
            <div className={s.formRow}>
              <span className={s.formLabel}>GPU</span>
              <div className={s.radioRow} role="group" aria-label="GPU requirement">
                {(['any', 'required', 'none'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={[s.radio, req.gpu === v ? s.radioOn : ''].join(' ')}
                    onClick={() => set('gpu', v)}
                    aria-pressed={req.gpu === v}
                  >
                    {v === 'any' ? 'Any' : v === 'required' ? 'Required' : 'No GPU'}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>
                Min GPU memory<span className={s.optional}> · optional</span>
              </span>
              <div className={s.inlineField}>
                <input
                  className={s.input}
                  aria-label="Minimum GPU memory in GB"
                  inputMode="numeric"
                  value={req.minGpuMemoryGb ?? ''}
                  onChange={(e) => set('minGpuMemoryGb', e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                />
                <span className={s.unit}>GB</span>
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>GPU class</span>
              <select
                className={s.select}
                aria-label="GPU class"
                value={req.gpuClass ?? ''}
                onChange={(e) => set('gpuClass', (e.target.value || undefined) as Requirements['gpuClass'])}
              >
                <option value="">Any</option>
                <option value="consumer">Consumer</option>
                <option value="workstation">Workstation</option>
                <option value="datacenter">Datacenter</option>
              </select>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>
                Min CPU cores<span className={s.optional}> · optional</span>
              </span>
              <div className={s.inlineField}>
                <input
                  className={s.input}
                  aria-label="Minimum CPU cores"
                  inputMode="numeric"
                  value={req.minCores ?? ''}
                  onChange={(e) => set('minCores', e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>
                Min system memory<span className={s.optional}> · optional</span>
              </span>
              <div className={s.inlineField}>
                <input
                  className={s.input}
                  aria-label="Minimum system memory in GB"
                  inputMode="numeric"
                  value={req.minMemoryGb ?? ''}
                  onChange={(e) => set('minMemoryGb', e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)))}
                />
                <span className={s.unit}>GB</span>
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>Scope</span>
              <div className={s.radioRow} role="group" aria-label="Scope">
                {(['any', 'personal', 'org'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={[s.radio, req.scope === v ? s.radioOn : ''].join(' ')}
                    onClick={() => set('scope', v)}
                    aria-pressed={req.scope === v}
                  >
                    {v === 'any' ? 'Any' : v === 'personal' ? 'Personal' : 'Organisation'}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.formRow}>
              <span className={s.formLabel}>
                Preferred backend<span className={s.optional}> · optional</span>
              </span>
              <select
                className={s.select}
                aria-label="Preferred backend"
                value={req.backendId ?? ''}
                onChange={(e) => set('backendId', e.target.value || undefined)}
              >
                <option value="">Any</option>
                {targets
                  .filter((t, i, arr) => arr.findIndex((x) => x.backendId === t.backendId) === i)
                  .map((t) => (
                    <option key={t.backendId} value={t.backendId}>
                      {t.backendName}
                    </option>
                  ))}
              </select>
            </div>

            <div className={s.formActions}>
              <Button size="sm" variant="primary" type="submit">
                Find targets
              </Button>
              <span className={s.formAside}>Same inputs, same ranking — every time.</span>
            </div>
          </form>

          <div className={s.findResults}>
            {!submitted ? (
              <div className={s.findIntro}>
                <p className={s.findIntroTitle}>Describe the work to see targets.</p>
                <p className={s.findIntroBody}>
                  The recommendation is a sort with reasons, not a scheduler: hard requirements filter, then fit, then
                  locality, then waste. A target from an environment without instances (Slurm, a serverless backend) can
                  always take work — the wait belongs to its scheduler, not to a machine.
                </p>
              </div>
            ) : ranked.length === 0 ? (
              <div className={s.band} role="status">
                {noMatchReason(submitted)}
              </div>
            ) : (
              <>
                <div className={s.resultLine}>
                  <span className={s.resultCount}>
                    {ranked.length} target{ranked.length === 1 ? '' : 's'}
                  </span>
                  <span className={s.resultNote}>Recommended — the top card first, each reason stated.</span>
                </div>

                <ol className={s.recList}>
                  {ranked.map((rec, i) => (
                    <li key={rec.target.id} className={s.rec} data-top={i === 0 || undefined}>
                      <div className={s.recHead}>
                        <span className={s.recRank}>{String(i + 1).padStart(2, '0')}</span>
                        <span className={s.recName}>
                          <Mark name={rec.target.backendName} size="sm" />
                          {rec.target.name}
                        </span>
                        <span className={s.recScore}>
                          {rec.score}
                          <span className={s.recScoreTrack}>
                            <span className={s.recScoreFill} style={{ width: `${rec.score}%` }} />
                          </span>
                        </span>
                      </div>

                      <p className={s.recHardware}>
                        {rec.target.kind === 'instance' && rec.target.hardware
                          ? `${rec.target.backendName} · ${hardwareBrief(rec.target.hardware)}`
                          : `${rec.target.backendName} · the environment provisions`}
                      </p>
                      <div className={s.recStatus}>
                        <span className={s.status} data-unknown={rec.target.availability === 'unknown' || undefined}>
                          <span className={s.statusAvail}>{AVAILABILITY_WORD[rec.target.availability]}</span>
                        </span>
                      </div>

                      <ul className={s.recReasons}>
                        {rec.reasons.map((reason) => (
                          <li key={reason}>
                            <span className={s.reasonMark} aria-hidden>
                              ✓
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
                        <Button size="sm" variant="primary" onClick={() => choose(rec.target.id)} data-choose-target={rec.target.id}>
                          Choose this
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>

                {showAll ? (
                  <>
                    <div className={s.resultLine} style={{ marginTop: 'var(--s6)' }}>
                      <span className={s.resultCount}>All eligible targets</span>
                      <span className={s.resultNote}>Manual selection — the same pool, unsorted by fit.</span>
                    </div>
                    <ul className={s.rows}>
                      {allEligible.map((rec) => {
                        const t = rec.target;
                        return (
                          <li key={`all-${t.id}`}>
                            <div className={s.row}>
                              <Mark name={t.backendName} size="sm" />
                              <span className={s.rowMain}>
                                <span className={s.rowTitle}>{t.name}</span>
                                <span className={s.rowMeta}>
                                  {t.backendName} · {t.kind === 'instance' ? (t.hardware ? hardwareBrief(t.hardware) : '') : 'environment target'}
                                </span>
                              </span>
                              <span className={s.rowState}>{AVAILABILITY_WORD[t.availability]}</span>
                              <span className={s.rowActions}>
                                <Button size="sm" onClick={() => choose(t.id)} data-choose-target={t.id}>
                                  Choose
                                </Button>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <button type="button" className={s.moreToggle} style={{ marginTop: 'var(--s4)' }} onClick={() => setShowAll(true)}>
                    Show all {allEligible.length} targets for manual selection
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </ComputeShell>
    </PlainLayout>
  );
}
