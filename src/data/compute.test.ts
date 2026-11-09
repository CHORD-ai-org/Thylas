import { describe, expect, it } from 'vitest';
import {
  BACKENDS,
  EMPTY_REQUIREMENTS,
  INSTANCES,
  LISTINGS,
  EMPTY_LISTING_FILTER,
  EMPTY_INSTANCE_FILTER,
  availabilityOf,
  eligibleTargets,
  filterInstances,
  filterListings,
  hardwareBrief,
  metricsOf,
  noMatchReason,
  rankTargets,
  statusLine,
  type Requirements,
} from './compute';

/**
 * Pure functions only. The store applies session overrides and hands views to
 * these, so a data case covers everything the UI can compute from seeds.
 */

const targets = () => eligibleTargets(BACKENDS, INSTANCES);

describe('the three rules, in the data', () => {
  it('a backend with no instance semantics contributes a backend target, not machines', () => {
    const all = targets();
    const slurm = all.filter((t) => t.backendId === 'b-slurm');
    expect(slurm).toHaveLength(1);
    expect(slurm[0]!.kind).toBe('backend');
    expect(slurm[0]!.provisionNote).toBeTruthy();
  });

  it('an unverified backend contributes no targets at all — and a reason is owed elsewhere', () => {
    expect(targets().some((t) => t.backendId === 'b-kubernetes')).toBe(false);
  });

  it('an unreachable machine reports no availability and no utilization', () => {
    const office = INSTANCES.find((i) => i.id === 'r-office')!;
    expect(availabilityOf(office)).toBe('unknown');
    expect(metricsOf(office)).toBeUndefined();
    expect(statusLine(office)).toBe('Disconnected · Availability unknown');
  });
});

describe('rankTargets', () => {
  const req = (over: Partial<Requirements> = {}): Requirements => ({ ...EMPTY_REQUIREMENTS, ...over });

  it('is deterministic: same inputs, same order', () => {
    const a = rankTargets(req(), targets());
    const b = rankTargets(req(), targets());
    expect(a.map((r) => r.target.id)).toEqual(b.map((r) => r.target.id));
  });

  it('hard GPU requirements filter instance targets', () => {
    const ranked = rankTargets(req({ gpu: 'required', minGpuMemoryGb: 80 }), targets());
    expect(ranked.map((r) => r.target.id)).toEqual(['r-aws-h100']);
    expect(ranked[0]!.reasons.length).toBeGreaterThan(0);
  });

  it('a GPU requirement excludes backend targets: their GPUs cannot be verified', () => {
    const ranked = rankTargets(req({ gpu: 'required' }), targets());
    expect(ranked.some((r) => r.target.kind === 'backend')).toBe(false);
  });

  it('a datacenter GPU request keeps the acquired H100 above the shared 40GB A100s', () => {
    const ranked = rankTargets(req({ gpu: 'required', gpuClass: 'datacenter' }), targets());
    expect(ranked[0]!.target.id).toBe('r-aws-h100');
  });

  it('gpu:none keeps CPU-only machines and drops GPU ones', () => {
    const ranked = rankTargets(req({ gpu: 'none' }), targets());
    for (const r of ranked) {
      if (r.target.kind === 'instance') expect(r.target.hardware!.gpuMemoryGb).toBeUndefined();
    }
  });

  it('idle beats busy, personal beats shared, and both are stated as reasons', () => {
    const ranked = rankTargets(req({ gpu: 'required' }), targets());
    const onda = ranked.find((r) => r.target.id === 'r-onda-gpu')!;
    const lab = ranked.find((r) => r.target.id === 'r-lab-01')!;
    expect(onda.score).toBeGreaterThan(lab.score);
    expect(onda.reasons.join(' ')).toMatch(/[Ii]dle/);
    expect(lab.caveats.join(' ')).toContain('Shared');
  });

  it('a backend target is never dropped for availability, but always carries the start-time caveat', () => {
    const ranked = rankTargets(req({ gpu: 'any' }), targets());
    const cluster = ranked.find((r) => r.target.kind === 'backend')!;
    expect(cluster).toBeDefined();
    expect(cluster.caveats.join(' ')).toContain('Start time');
  });

  it('scope filters only instance targets; the cluster stays reachable for org work', () => {
    const ranked = rankTargets(req({ scope: 'personal' }), targets());
    expect(ranked.some((r) => r.target.id === 'r-lab-01')).toBe(false);
    expect(ranked.some((r) => r.target.kind === 'backend')).toBe(true);
  });

  it('an impossible request explains itself instead of returning silence', () => {
    expect(noMatchReason(req({ minGpuMemoryGb: 200 }))).toContain('Marketplace');
    expect(noMatchReason(req({ gpu: 'required', gpuClass: 'datacenter', minCores: 512 }))).toContain('Verify');
  });
});

describe('instance filtering', () => {
  it('filters by backend, scope and availability, and searches hardware', () => {
    const f = { ...EMPTY_INSTANCE_FILTER, backendId: 'b-ssh' };
    expect(filterInstances(INSTANCES, f, BACKENDS)).toHaveLength(4);
    expect(filterInstances(INSTANCES, { ...f, scope: 'org' }, BACKENDS).map((i) => i.id)).toEqual(['r-lab-01', 'r-onda-gpu']);
    expect(filterInstances(INSTANCES, { ...EMPTY_INSTANCE_FILTER, query: 'h100' }, BACKENDS).map((i) => i.id)).toEqual(['r-aws-h100']);
  });

  it('the availability filter uses the derived value: offline-disconnected is unknown', () => {
    const unknown = filterInstances(INSTANCES, { ...EMPTY_INSTANCE_FILTER, availability: 'unknown' }, BACKENDS);
    expect(unknown.map((i) => i.id)).toEqual(['r-office']);
  });
});

describe('marketplace filtering', () => {
  it('filters by class, memory, provider, region, rate and usable-via backend', () => {
    const base = EMPTY_LISTING_FILTER;
    expect(filterListings(LISTINGS, { ...base, gpuClass: 'datacenter' })).toHaveLength(3);
    expect(filterListings(LISTINGS, { ...base, minGpuMemoryGb: 80 }).map((l) => l.id)).toEqual(['l-h100-1', 'l-h100-8']);
    expect(filterListings(LISTINGS, { ...base, maxRate: 1 })).toHaveLength(3);
    expect(filterListings(LISTINGS, { ...base, useVia: 'kubernetes' }).map((l) => l.id)).toEqual(['l-h100-8', 'l-a100-1']);
    expect(filterListings(LISTINGS, { ...base, provider: 'Lambda' })).toHaveLength(1);
  });

  it('every listing declares which backend would use it', () => {
    for (const l of LISTINGS) expect(l.useVia.length).toBeGreaterThan(0);
  });
});

describe('presentation helpers', () => {
  it('hardwareBrief drops nothing a row needs and hides nothing behind an ellipsis', () => {
    const h100 = INSTANCES.find((i) => i.id === 'r-aws-h100')!;
    expect(hardwareBrief(h100.hardware)).toBe('8 cores · H100 80GB · 64GB');
  });
});
