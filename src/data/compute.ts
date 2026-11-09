/**
 * Compute: providers, resources, workloads, and the recommendation model.
 *
 * Three nouns and one rule. A provider is something Thylas can talk to; a
 * resource is a machine that provider can reach; a workload is work assigned to
 * a machine. The rule is that connection state and availability are different
 * facts and never share a word: a connected machine can be busy, and a machine
 * we cannot reach has no availability to report at all.
 *
 * Nothing here claims an integration that does not exist. A provider says what
 * it is (`integration`), and a resource only carries utilization when it is
 * reachable — a disconnected server with a live GPU graph would be a lie the
 * interface cannot detect later.
 */

export type ProviderCategory = 'local' | 'ssh' | 'cloud' | 'gpu-cloud' | 'custom';

/** How real the connection is. `prototype` means the flow is a UI simulation. */
export type Integration = 'built-in' | 'prototype' | 'planned';

export type ProviderCapability =
  | 'list-machines'
  | 'launch-instance'
  | 'stop-instance'
  | 'ssh'
  | 'metrics'
  | 'billing';

export type Provider = {
  id: string;
  name: string;
  category: ProviderCategory;
  blurb: string;
  integration: Integration;
  capabilities: ProviderCapability[];
  /** What the connection form asks for. Data-driven: one flow, many providers. */
  fields: ProviderField[];
  docs?: string;
};

export type ProviderField = {
  id: string;
  label: string;
  kind: 'text' | 'secret' | 'select';
  hint?: string;
  options?: string[];
  optional?: boolean;
};

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

/** What the machine can take right now. `unknown` when we cannot see it. */
export type Availability = 'available' | 'busy' | 'offline' | 'unknown';

export type ResourceKind = 'local' | 'ssh' | 'instance';

export type Hardware = {
  cpu: string;
  cores: number;
  gpu?: string;
  gpuMemoryGb?: number;
  gpuClass?: 'consumer' | 'workstation' | 'datacenter';
  memoryGb: number;
  storageGb: number;
};

export type Utilization = { cpu: number; gpu?: number; memory: number };

export type Resource = {
  id: string;
  name: string;
  providerId: string;
  kind: ResourceKind;
  scope: 'personal' | 'org';
  owner: string;
  hardware: Hardware;
  os: string;
  runtime: string[];
  connection: ConnectionState;
  availability: Exclude<Availability, 'unknown'>;
  /** Present only while the resource is reachable. Absence is the honest state. */
  utilization?: Utilization;
  workloads: number;
  lastSeen: string;
  /** True when a person typed the hardware in rather than a host reporting it.
      The detail page says so; a declared number is a weaker claim than a read. */
  declared?: boolean;
  note?: string;
};

export type WorkloadState = 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';

export type Workload = {
  id: string;
  name: string;
  kind: string;
  resourceId: string;
  state: WorkloadState;
  startedAt: string;
  duration: string;
  progress?: number;
  cpuPct: number;
  memoryGb: number;
  gpuPct?: number;
  note?: string;
};

export type Requirements = {
  name: string;
  kind: string;
  minCores?: number;
  minMemoryGb?: number;
  minGpuMemoryGb?: number;
  gpuClass?: Exclude<NonNullable<Hardware['gpuClass']>, never>;
  scope?: 'any' | 'personal' | 'org';
  providerId?: string;
};

export type Recommendation = {
  resource: Resource;
  score: number;
  reasons: string[];
  caveats: string[];
};

export type Decision = {
  id: string;
  at: string;
  kind: 'reserve' | 'connect' | 'disconnect' | 'add';
  text: string;
  resourceId?: string;
};

/* --------------------------------------------------------------------------
   Providers
   -------------------------------------------------------------------------- */

const LOCAL_FIELDS: ProviderField[] = [
  {
    id: 'agent',
    label: 'Agent',
    kind: 'text',
    hint: 'The address the local agent reports from. This build pretends to read it.',
  },
];

const SSH_FIELDS: ProviderField[] = [
  { id: 'host', label: 'Host', kind: 'text', hint: 'hostname or address' },
  { id: 'port', label: 'Port', kind: 'text', hint: '22 by default', optional: true },
  { id: 'user', label: 'User', kind: 'text' },
  {
    id: 'auth',
    label: 'Authentication',
    kind: 'select',
    options: ['Key file', 'SSH agent', 'Password'],
    hint: 'A key path is recorded; the file is never read in this build.',
  },
];

const CLOUD_FIELDS: ProviderField[] = [
  { id: 'account', label: 'Account ID', kind: 'text', hint: 'or project / tenant identifier' },
  { id: 'secret', label: 'Access key', kind: 'secret', hint: 'Held in the OS keychain by the host; never stored here.' },
  { id: 'region', label: 'Region', kind: 'select', options: ['us-east-1', 'eu-central-1', 'ap-northeast-1'] },
  { id: 'role', label: 'Role', kind: 'text', hint: 'Optional. A read-only role is enough to list machines.', optional: true },
];

export const PROVIDERS: Provider[] = [
  {
    id: 'p-local',
    name: 'This machine',
    category: 'local',
    blurb: 'The computer Thylas is running on, plus any machine on the same network that runs the local agent.',
    integration: 'built-in',
    capabilities: ['list-machines', 'metrics'],
    fields: LOCAL_FIELDS,
  },
  {
    id: 'p-ssh',
    name: 'SSH',
    category: 'ssh',
    blurb: 'Any server you can reach over SSH. Thylas reads hardware and reachability; it does not install anything on the host.',
    integration: 'built-in',
    capabilities: ['ssh', 'metrics'],
    fields: SSH_FIELDS,
  },
  {
    id: 'p-aws',
    name: 'AWS',
    category: 'cloud',
    blurb: 'EC2 instances in one account. Listing and health only — no launch, no termination, no cost data.',
    integration: 'prototype',
    capabilities: ['list-machines', 'metrics'],
    fields: CLOUD_FIELDS,
    docs: 'https://docs.aws.amazon.com/ec2/',
  },
  {
    id: 'p-thinking-machines',
    name: 'Thinking Machines',
    category: 'gpu-cloud',
    blurb: 'A GPU cloud entry kept separate from AWS on purpose: the two do not expose the same objects, and one connection form cannot pretend they do.',
    integration: 'prototype',
    capabilities: ['list-machines'],
    fields: [
      { id: 'account', label: 'Workspace', kind: 'text', hint: 'workspace or team identifier' },
      { id: 'secret', label: 'API token', kind: 'secret' },
      { id: 'region', label: 'Region', kind: 'select', options: ['us-west', 'us-east', 'eu-west'] },
    ],
  },
  {
    id: 'p-gcp',
    name: 'Google Cloud',
    category: 'cloud',
    blurb: 'Not implemented. Listed so the registry shows where a provider goes before a flow exists.',
    integration: 'planned',
    capabilities: [],
    fields: CLOUD_FIELDS,
  },
  {
    id: 'p-lambda',
    name: 'Lambda',
    category: 'gpu-cloud',
    blurb: 'Not implemented. A GPU cloud whose objects would need their own mapping, not a copy of the AWS one.',
    integration: 'planned',
    capabilities: [],
    fields: CLOUD_FIELDS,
  },
];

export const PROVIDER_CATEGORY_LABEL: Record<ProviderCategory, string> = {
  local: 'Local',
  ssh: 'Remote · SSH',
  cloud: 'Cloud infrastructure',
  'gpu-cloud': 'GPU infrastructure',
  custom: 'Custom',
};

export const INTEGRATION_LABEL: Record<Integration, string> = {
  'built-in': 'Built in',
  prototype: 'Prototype flow',
  planned: 'Planned',
};

export const CAPABILITY_LABEL: Record<ProviderCapability, string> = {
  'list-machines': 'list machines',
  'launch-instance': 'launch',
  'stop-instance': 'stop',
  ssh: 'ssh',
  metrics: 'metrics',
  billing: 'billing',
};

/* --------------------------------------------------------------------------
   Resources
   -------------------------------------------------------------------------- */

export const RESOURCES: Resource[] = [
  {
    id: 'r-studio',
    name: 'studio-win',
    providerId: 'p-local',
    kind: 'local',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: {
      cpu: 'Ryzen 9 7950X',
      cores: 16,
      gpu: 'RTX 4070 Ti',
      gpuMemoryGb: 12,
      gpuClass: 'consumer',
      memoryGb: 64,
      storageGb: 2000,
    },
    os: 'Windows 11 Pro 24H2',
    runtime: ['CUDA 12.4', 'Python 3.12', 'Docker Desktop'],
    connection: 'connected',
    availability: 'busy',
    utilization: { cpu: 41, gpu: 87, memory: 62 },
    workloads: 1,
    lastSeen: 'now',
  },
  {
    id: 'r-macbook',
    name: 'ceaser-mbp',
    providerId: 'p-local',
    kind: 'local',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: {
      cpu: 'Apple M3 Max',
      cores: 16,
      gpu: 'M3 Max (40-core)',
      gpuMemoryGb: 36,
      gpuClass: 'workstation',
      memoryGb: 48,
      storageGb: 1000,
    },
    os: 'macOS 15.1',
    runtime: ['MLX', 'Python 3.12'],
    connection: 'connected',
    availability: 'offline',
    workloads: 0,
    lastSeen: '3h ago',
    note: 'Asleep. The agent is connected; the machine is not.',
  },
  {
    id: 'r-lab-01',
    name: 'lab-01',
    providerId: 'p-ssh',
    kind: 'ssh',
    scope: 'org',
    owner: 'Research',
    hardware: {
      cpu: 'Xeon Gold 6338',
      cores: 64,
      gpu: '2 × A100 40GB',
      gpuMemoryGb: 40,
      gpuClass: 'datacenter',
      memoryGb: 512,
      storageGb: 8000,
    },
    os: 'Ubuntu 24.04 LTS',
    runtime: ['CUDA 12.6', 'PyTorch 2.5', 'Slurm'],
    connection: 'connected',
    availability: 'busy',
    utilization: { cpu: 78, gpu: 94, memory: 71 },
    workloads: 2,
    lastSeen: 'now',
  },
  {
    id: 'r-onda-gpu',
    name: 'onda-gpu-02',
    providerId: 'p-ssh',
    kind: 'ssh',
    scope: 'org',
    owner: 'Onda Lab',
    hardware: {
      cpu: 'EPYC 7543',
      cores: 32,
      gpu: 'RTX A6000',
      gpuMemoryGb: 48,
      gpuClass: 'workstation',
      memoryGb: 256,
      storageGb: 4000,
    },
    os: 'Ubuntu 22.04 LTS',
    runtime: ['CUDA 12.2', 'PyTorch 2.4'],
    connection: 'connected',
    availability: 'available',
    utilization: { cpu: 6, gpu: 0, memory: 18 },
    workloads: 0,
    lastSeen: 'now',
  },
  {
    id: 'r-aws-g5',
    name: 'g5.2xlarge · i-0f31',
    providerId: 'p-aws',
    kind: 'instance',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: {
      cpu: 'EPYC 7R32',
      cores: 8,
      gpu: 'A10G',
      gpuMemoryGb: 24,
      gpuClass: 'datacenter',
      memoryGb: 32,
      storageGb: 450,
    },
    os: 'Amazon Linux 2023',
    runtime: ['CUDA 12.4', 'PyTorch 2.5'],
    connection: 'connected',
    availability: 'available',
    utilization: { cpu: 12, gpu: 9, memory: 24 },
    workloads: 0,
    lastSeen: 'now',
    note: 'Billed hourly while it runs. Cost data is not read in this build.',
  },
  {
    id: 'r-tm-h100',
    name: 'tm-h100-04',
    providerId: 'p-thinking-machines',
    kind: 'instance',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: {
      cpu: 'Xeon Platinum 8480',
      cores: 48,
      gpu: 'H100 80GB',
      gpuMemoryGb: 80,
      gpuClass: 'datacenter',
      memoryGb: 256,
      storageGb: 2000,
    },
    os: 'Ubuntu 24.04 LTS',
    runtime: ['CUDA 12.6'],
    connection: 'error',
    availability: 'available',
    workloads: 0,
    lastSeen: '2d ago',
    note: 'Token rejected on the last three polls. Utilization is unknown until the connection is repaired.',
  },
  {
    id: 'r-office',
    name: 'office-box',
    providerId: 'p-ssh',
    kind: 'ssh',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: {
      cpu: 'i7-12700',
      cores: 12,
      gpu: 'RTX 3060',
      gpuMemoryGb: 12,
      gpuClass: 'consumer',
      memoryGb: 32,
      storageGb: 1000,
    },
    os: 'Debian 12',
    runtime: ['CUDA 12.1'],
    connection: 'disconnected',
    availability: 'offline',
    workloads: 0,
    lastSeen: '6d ago',
  },
];

export const WORKLOADS: Workload[] = [
  {
    id: 'wl-ablation',
    name: 'ablation-7 · context window sweep',
    kind: 'Training sweep',
    resourceId: 'r-lab-01',
    state: 'running',
    startedAt: '1h 12m ago',
    duration: '~3h left',
    progress: 62,
    cpuPct: 78,
    gpuPct: 94,
    memoryGb: 210,
  },
  {
    id: 'wl-tokenizer',
    name: 'tokenizer-eval',
    kind: 'Evaluation',
    resourceId: 'r-lab-01',
    state: 'running',
    startedAt: '24m ago',
    duration: '~40m left',
    progress: 31,
    cpuPct: 22,
    gpuPct: 48,
    memoryGb: 64,
  },
  {
    id: 'wl-render',
    name: 'board-render · 1440 frames',
    kind: 'Batch job',
    resourceId: 'r-studio',
    state: 'running',
    startedAt: '8m ago',
    duration: '~20m left',
    progress: 18,
    cpuPct: 41,
    gpuPct: 87,
    memoryGb: 28,
  },
  {
    id: 'wl-spec',
    name: 'protocol-brief · compile specs',
    kind: 'Agent run',
    resourceId: 'r-onda-gpu',
    state: 'queued',
    startedAt: 'queued 3m ago',
    duration: 'waiting for a resource',
    cpuPct: 0,
    memoryGb: 0,
    note: 'Queued behind the two runs on lab-01. Thylas does not move work between machines in this build.',
  },
  {
    id: 'wl-baseline',
    name: 'baseline-sweep · seed 12',
    kind: 'Training sweep',
    resourceId: 'r-lab-01',
    state: 'completed',
    startedAt: 'yesterday',
    duration: '4h 06m',
    cpuPct: 0,
    memoryGb: 0,
  },
  {
    id: 'wl-import',
    name: 'import-runs · parquet',
    kind: 'Data job',
    resourceId: 'r-office',
    state: 'failed',
    startedAt: '2d ago',
    duration: '0m 41s',
    cpuPct: 0,
    memoryGb: 0,
    note: 'The host stopped answering mid-run.',
  },
  {
    id: 'wl-docs',
    name: 'reindex · notes',
    kind: 'Indexing',
    resourceId: 'r-macbook',
    state: 'cancelled',
    startedAt: '3d ago',
    duration: '12m 04s',
    cpuPct: 0,
    memoryGb: 0,
  },
];

/* --------------------------------------------------------------------------
   Derived views
   -------------------------------------------------------------------------- */

/** A machine we cannot reach has no availability to report. */
export function availabilityOf(resource: Resource): Availability {
  if (resource.connection === 'connected') return resource.availability;
  if (resource.connection === 'connecting') return 'unknown';
  return 'unknown';
}

/** Utilization exists only while the machine can be seen right now. */
export function metricsOf(resource: Resource): Utilization | undefined {
  return availabilityOf(resource) === 'unknown' ? undefined : resource.utilization;
}

/** "Connected · Busy" — two facts, two words, never one. */
export function statusLine(resource: Resource): string {
  const conn =
    resource.connection === 'connected'
      ? 'Connected'
      : resource.connection === 'connecting'
        ? 'Connecting'
        : resource.connection === 'error'
          ? 'Connection error'
          : 'Disconnected';
  const avail = availabilityOf(resource);
  const word =
    avail === 'available' ? 'Available' : avail === 'busy' ? 'Busy' : avail === 'offline' ? 'Offline' : 'Availability unknown';
  return `${conn} · ${word}`;
}

export function providerOf(providerId: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === providerId);
}

export function resourceById(id: string | undefined, extra: Resource[] = []): Resource | undefined {
  return [...RESOURCES, ...extra].find((r) => r.id === id);
}

export function workloadsFor(resourceId: string, extra: Workload[] = []): Workload[] {
  return [...WORKLOADS, ...extra].filter((w) => w.resourceId === resourceId);
}

/** The table version: no storage, because a column that truncates at 190px
    should drop its least decisive number rather than its last character. */
export function hardwareBrief(h: Hardware): string {
  const gpu = h.gpu ? `${h.gpu}${h.gpuMemoryGb ? ` ${h.gpuMemoryGb}GB` : ''}` : 'no GPU';
  return `${h.cores} cores · ${gpu} · ${h.memoryGb}GB`;
}

export function hardwareSummary(h: Hardware): string {
  const gpu = h.gpu ? `${h.gpu}${h.gpuMemoryGb ? ` ${h.gpuMemoryGb}GB` : ''}` : 'no GPU';
  return `${h.cores} cores · ${gpu} · ${h.memoryGb}GB`;
}

/* --------------------------------------------------------------------------
   Filtering
   -------------------------------------------------------------------------- */

export type ResourceFilter = {
  query: string;
  providerId: string | 'all';
  kind: ResourceKind | 'all';
  availability: Availability | 'all';
  scope: 'personal' | 'org' | 'all';
};

export const EMPTY_FILTER: ResourceFilter = {
  query: '',
  providerId: 'all',
  kind: 'all',
  availability: 'all',
  scope: 'all',
};

export function filterResources(resources: Resource[], filter: ResourceFilter): Resource[] {
  const q = filter.query.trim().toLowerCase();
  return resources.filter((r) => {
    if (filter.providerId !== 'all' && r.providerId !== filter.providerId) return false;
    if (filter.kind !== 'all' && r.kind !== filter.kind) return false;
    if (filter.scope !== 'all' && r.scope !== filter.scope) return false;
    if (filter.availability !== 'all' && availabilityOf(r) !== filter.availability) return false;
    if (!q) return true;
    const provider = providerOf(r.providerId)?.name ?? '';
    return `${r.name} ${r.os} ${r.hardware.cpu} ${r.hardware.gpu ?? ''} ${provider}`.toLowerCase().includes(q);
  });
}

/* --------------------------------------------------------------------------
   Recommendation
   -------------------------------------------------------------------------- */

/**
 * Rank candidate machines against a stated workload. This is the whole of the
 * "assisted" half of Hybrid Coordination: a sort with reasons the reader can
 * argue with. It reserves nothing and starts nothing.
 *
 * Scoring, in order of weight: hard requirements filter, then fit (free GPU
 * memory, idle machine), then locality (a machine you own before one shared),
 * then how much hardware the request would waste.
 */
export function rankResources(req: Requirements, resources: Resource[] = RESOURCES): Recommendation[] {
  const wanted = req.kind.trim();
  const out: Recommendation[] = [];

  for (const resource of resources) {
    const reasons: string[] = [];
    const caveats: string[] = [];
    const h = resource.hardware;
    const avail = availabilityOf(resource);

    if (req.scope && req.scope !== 'any' && resource.scope !== req.scope) continue;
    if (req.providerId && resource.providerId !== req.providerId) continue;
    if (req.minCores && h.cores < req.minCores) continue;
    if (req.minMemoryGb && h.memoryGb < req.minMemoryGb) continue;
    if (req.minGpuMemoryGb) {
      if (!h.gpuMemoryGb) continue;
      if (h.gpuMemoryGb < req.minGpuMemoryGb) continue;
    }
    if (req.gpuClass && h.gpuClass !== req.gpuClass) continue;

    let score = 40;

    if (avail === 'available') {
      score += 30;
      reasons.push('Idle: no workload is running on it.');
    } else if (avail === 'busy') {
      score -= 20;
      caveats.push('Running work now; it would queue.');
    } else {
      score -= 45;
      caveats.push(
        resource.connection === 'connected'
          ? 'Asleep or offline; it has to come back before anything can start.'
          : 'No connection, so availability is unknown, not merely idle.',
      );
    }

    if (resource.connection === 'error') {
      score -= 15;
      caveats.push('Last connection attempt failed; repair it first.');
    }

    if (req.minGpuMemoryGb && h.gpuMemoryGb) {
      const headroom = h.gpuMemoryGb - req.minGpuMemoryGb;
      if (headroom >= 24) {
        score -= 6;
        caveats.push(`${headroom}GB of GPU memory beyond the requirement.`);
      } else if (headroom >= 8) {
        score += 8;
        reasons.push(`${headroom}GB of GPU memory to spare — enough for a larger batch.`);
      } else {
        score += 2;
        reasons.push(`GPU memory fits with ${headroom || 0}GB spare.`);
      }
    }

    if (resource.scope === 'personal') {
      score += 6;
      reasons.push('Yours: no one else is waiting for it.');
    } else {
      caveats.push(`Shared with ${resource.owner}. Coordinate before a long run.`);
    }

    if (resource.kind === 'instance') {
      caveats.push('A cloud instance bills while it runs; Thylas cannot show the rate.');
    }

    if (wanted && `${resource.name} ${resource.os} ${h.gpu ?? ''}`.toLowerCase().includes(wanted.toLowerCase())) {
      score += 3;
    }

    if (reasons.length === 0) reasons.push('Meets every stated requirement.');

    out.push({ resource, score: Math.max(0, Math.min(100, score)), reasons, caveats });
  }

  return out.sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name));
}

/** What the recommendation screen says when nothing fits. */
export function noMatchReason(req: Requirements): string {
  if (req.minGpuMemoryGb && req.minGpuMemoryGb > 80) {
    return `No machine in the pool has ${req.minGpuMemoryGb}GB of GPU memory. The largest is 80GB.`;
  }
  if (req.gpuClass === 'datacenter') {
    return 'No connected datacenter GPU meets the other requirements. Two machines in the pool are unreachable.';
  }
  return 'Nothing in the pool meets all of the stated requirements. Loosen one constraint, or connect a machine that does.';
}

export function emptyFilterIsEmpty(resources: Resource[], filter: ResourceFilter): boolean {
  return filterResources(resources, filter).length === 0;
}
