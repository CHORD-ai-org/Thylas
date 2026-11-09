import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER,
  PROVIDERS,
  RESOURCES,
  WORKLOADS,
  availabilityOf,
  filterResources,
  hardwareSummary,
  metricsOf,
  noMatchReason,
  providerOf,
  rankResources,
  statusLine,
  type Resource,
} from './compute';

const byId = (id: string) => RESOURCES.find((r) => r.id === id) as Resource;

describe('connection and availability are different facts', () => {
  it('reports connected and busy as two words', () => {
    expect(statusLine(byId('r-lab-01'))).toBe('Connected · Busy');
  });

  it('says availability is unknown when the machine cannot be reached', () => {
    expect(availabilityOf(byId('r-office'))).toBe('unknown');
    expect(statusLine(byId('r-office'))).toBe('Disconnected · Availability unknown');
  });

  it('keeps the stored availability out of the sentence when the connection failed', () => {
    /* r-tm-h100 is marked available in the seed but its token was rejected. */
    expect(byId('r-tm-h100').availability).toBe('available');
    expect(availabilityOf(byId('r-tm-h100'))).toBe('unknown');
    expect(statusLine(byId('r-tm-h100'))).toBe('Connection error · Availability unknown');
  });

  it('drops utilization whenever the machine is not connected', () => {
    expect(metricsOf(byId('r-studio'))?.gpu).toBe(87);
    expect(metricsOf(byId('r-office'))).toBeUndefined();
    expect(metricsOf(byId('r-tm-h100'))).toBeUndefined();
  });
});

describe('seed data', () => {
  it('gives every resource a provider that exists', () => {
    for (const resource of RESOURCES) {
      expect(providerOf(resource.providerId), resource.id).toBeTruthy();
    }
  });

  it('never attaches utilization to a resource that is not connected', () => {
    for (const resource of RESOURCES) {
      if (resource.utilization) expect(resource.connection, resource.id).toBe('connected');
    }
  });

  it('assigns every workload to a resource that exists', () => {
    for (const workload of WORKLOADS) {
      expect(RESOURCES.some((r) => r.id === workload.resourceId), workload.id).toBe(true);
    }
  });

  it('describes hardware in one line', () => {
    expect(hardwareSummary(byId('r-lab-01').hardware)).toBe('64 cores · 2 × A100 40GB 40GB · 512GB');
  });
});

describe('filterResources', () => {
  it('returns everything for the empty filter', () => {
    expect(filterResources(RESOURCES, EMPTY_FILTER)).toHaveLength(RESOURCES.length);
  });

  it('filters by provider', () => {
    const out = filterResources(RESOURCES, { ...EMPTY_FILTER, providerId: 'p-ssh' });
    expect(out.map((r) => r.id).sort()).toEqual(['r-lab-01', 'r-office', 'r-onda-gpu']);
  });

  it('filters by what the machine can take, not by what it says', () => {
    const out = filterResources(RESOURCES, { ...EMPTY_FILTER, availability: 'available' });
    expect(out.map((r) => r.id)).toEqual(['r-onda-gpu', 'r-aws-g5']);
  });

  it('matches a query against name, os, cpu and provider', () => {
    expect(filterResources(RESOURCES, { ...EMPTY_FILTER, query: 'a100' }).map((r) => r.id)).toEqual(['r-lab-01']);
    expect(filterResources(RESOURCES, { ...EMPTY_FILTER, query: 'ubuntu' }).map((r) => r.id).sort()).toEqual([
      'r-lab-01',
      'r-onda-gpu',
      'r-tm-h100',
    ]);
    expect(filterResources(RESOURCES, { ...EMPTY_FILTER, query: 'aws' }).map((r) => r.id)).toEqual(['r-aws-g5']);
  });

  it('filters by scope', () => {
    const out = filterResources(RESOURCES, { ...EMPTY_FILTER, scope: 'org' });
    expect(out.every((r) => r.scope === 'org')).toBe(true);
    expect(out).toHaveLength(2);
  });
});

describe('rankResources', () => {
  it('drops machines that fail a hard requirement', () => {
    const out = rankResources({ name: 'train', kind: 'training', minGpuMemoryGb: 40 });
    expect(out.every((r) => (r.resource.hardware.gpuMemoryGb ?? 0) >= 40)).toBe(true);
    expect(out.some((r) => r.resource.id === 'r-studio')).toBe(false);
  });

  it('puts an idle machine above a busy one of the same class', () => {
    const out = rankResources({ name: 'eval', kind: 'evaluation', minGpuMemoryGb: 24, gpuClass: 'datacenter' });
    const order = out.map((r) => r.resource.id);
    expect(order.indexOf('r-aws-g5')).toBeLessThan(order.indexOf('r-lab-01'));
  });

  it('explains a caveat for a shared machine', () => {
    const out = rankResources({ name: 'x', kind: 'y', minGpuMemoryGb: 40 });
    const lab = out.find((r) => r.resource.id === 'r-lab-01');
    expect(lab?.caveats.join(' ')).toMatch(/Shared with/);
  });

  it('never ranks an unreachable machine as available', () => {
    const out = rankResources({ name: 'x', kind: 'y' });
    const tm = out.find((r) => r.resource.id === 'r-tm-h100');
    expect(tm?.caveats.join(' ')).toMatch(/No connection/);
    expect(tm!.score).toBeLessThan(out[0]!.score);
  });

  it('warns that a cloud instance cannot show its rate', () => {
    const out = rankResources({ name: 'x', kind: 'y', minGpuMemoryGb: 16 });
    const aws = out.find((r) => r.resource.id === 'r-aws-g5');
    expect(aws?.caveats.join(' ')).toMatch(/bills while it runs/);
  });

  it('returns nothing when the requirement is larger than the pool', () => {
    expect(rankResources({ name: 'x', kind: 'y', minGpuMemoryGb: 120 })).toHaveLength(0);
    expect(noMatchReason({ name: 'x', kind: 'y', minGpuMemoryGb: 120 })).toMatch(/largest is 80GB/);
  });

  it('respects a provider preference', () => {
    const out = rankResources({ name: 'x', kind: 'y', providerId: 'p-ssh' });
    expect(out.every((r) => r.resource.providerId === 'p-ssh')).toBe(true);
  });
});

describe('provider registry', () => {
  it('is data-driven: every provider declares its fields', () => {
    for (const provider of PROVIDERS) {
      expect(Array.isArray(provider.fields), provider.id).toBe(true);
    }
  });

  it('does not present a planned provider as connected', () => {
    for (const provider of PROVIDERS.filter((p) => p.integration === 'planned')) {
      expect(provider.capabilities).toEqual([]);
    }
  });
});
