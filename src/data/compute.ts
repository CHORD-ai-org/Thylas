/**
 * Compute v2: backends, instances, workloads, marketplace listings, and the
 * selection model.
 *
 * Four nouns and three rules. A **backend** is an execution interface — where
 * and through what mechanism work can run; an **instance** is a concrete
 * machine a backend exposes; a **workload** is work running or queued on a
 * target; a **listing** is capacity someone could acquire in the Marketplace.
 *
 * The rules:
 *   - a backend is not an instance — connecting one creates no machine, and
 *     backends with `instances: 'none'` (Slurm, Modal, …) are targeted
 *     directly, with the cluster or platform doing the provisioning;
 *   - connection state and availability are separate facts, never merged, and
 *     an unreachable machine reports no utilization at all (D-048, kept);
 *   - a listing is not a backend — acquired capacity is used *through* one.
 *
 * Nothing here executes, provisions or bills. A backend's `status` is what a
 * deterministic test can produce; a listing's rate is labelled representative.
 */

export type BackendType =
  | 'local'
  | 'ssh'
  | 'slurm'
  | 'kubernetes'
  | 'ray'
  | 'modal'
  | 'hf-jobs'
  | 'tinker';

/** Whether Thylas can currently reach the execution interface. */
export type BackendStatus = 'ready' | 'unverified' | 'unreachable' | 'error';

/** What the backend can do once reached. */
export type ExecCapability = 'run' | 'instances' | 'schedule' | 'scale' | 'logs';

export type BackendField = {
  id: string;
  label: string;
  kind: 'text' | 'secret' | 'select';
  hint?: string;
  options?: string[];
  optional?: boolean;
};

export type Backend = {
  id: string;
  name: string;
  type: BackendType;
  blurb: string;
  status: BackendStatus;
  enabled: boolean;
  isDefault?: boolean;
  /** Whether the backend exposes machines a person can point at. */
  instances: 'exposed' | 'none';
  capabilities: ExecCapability[];
  /** What configuration asks for. Data-driven: one form flow, many types. */
  fields: BackendField[];
  /** Saved values. Absent for backends that are not configured yet. */
  config?: Record<string, string>;
  /** Set once configured in this session (catalog entries start unconfigured). */
  configured?: boolean;
  docs?: string;
};

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

/** What the machine can take right now. `unknown` when we cannot see it. */
export type Availability = 'available' | 'busy' | 'offline' | 'unknown';

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

export type Instance = {
  id: string;
  name: string;
  backendId: string;
  scope: 'personal' | 'org';
  owner: string;
  hardware: Hardware;
  os: string;
  runtime: string[];
  connection: ConnectionState;
  availability: Exclude<Availability, 'unknown'>;
  /** Present only while the instance is reachable. Absence is the honest state. */
  utilization?: Utilization;
  workloads: number;
  lastSeen: string;
  /** True when a person typed the hardware in rather than a host reporting it. */
  declared?: boolean;
  /** Representative hourly rate, carried from a Marketplace acquisition. */
  ratePerHour?: number;
  acquiredVia?: string;
  note?: string;
};

export type WorkloadState = 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';

export type Workload = {
  id: string;
  name: string;
  kind: string;
  backendId: string;
  /** Absent when the target is the backend itself (cluster / serverless). */
  instanceId?: string;
  state: WorkloadState;
  startedAt: string;
  duration: string;
  progress?: number;
  cpuPct: number;
  memoryGb: number;
  gpuPct?: number;
  intent?: string;
  events?: { t: string; text: string; kind?: 'tool' | 'state' | 'artifact' }[];
  note?: string;
};

export type Listing = {
  id: string;
  provider: string;
  name: string;
  hardware: Hardware;
  region: string;
  /** Representative hourly rate in USD. Never a live price. */
  ratePerHour: number;
  availability: 'representative' | 'waitlist';
  /** Which backend type would use this capacity once acquired. */
  useVia: BackendType[];
  blurb: string;
};

/* --------------------------------------------------------------------------
   Backend catalog
   -------------------------------------------------------------------------- */

const SSH_FIELDS: BackendField[] = [
  { id: 'host', label: 'Host', kind: 'text', hint: 'login node hostname or address' },
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

const SLURM_FIELDS: BackendField[] = [
  { id: 'host', label: 'Login node', kind: 'text', hint: 'hostname of the submission host' },
  { id: 'partition', label: 'Partition', kind: 'text', hint: 'default partition for submissions' },
  { id: 'account', label: 'Account', kind: 'text', hint: 'scheduler account, if your cluster charges one', optional: true },
];

const KUBERNETES_FIELDS: BackendField[] = [
  { id: 'context', label: 'Context', kind: 'text', hint: 'kubeconfig context name' },
  { id: 'namespace', label: 'Namespace', kind: 'text', hint: 'where jobs are created' },
];

const RAY_FIELDS: BackendField[] = [
  { id: 'head', label: 'Head address', kind: 'text', hint: 'ray://host:port of the dashboard agent' },
];

export const BACKEND_TYPE_LABEL: Record<BackendType, string> = {
  local: 'Local',
  ssh: 'SSH',
  slurm: 'Slurm',
  kubernetes: 'Kubernetes',
  ray: 'Ray',
  modal: 'Modal',
  'hf-jobs': 'Hugging Face Jobs',
  tinker: 'Tinker',
};

export const CAPABILITY_LABEL: Record<ExecCapability, string> = {
  run: 'run work',
  instances: 'expose instances',
  schedule: 'schedule via a queue',
  scale: 'provision on demand',
  logs: 'stream logs',
};

export const BACKEND_STATUS_WORD: Record<BackendStatus, string> = {
  ready: 'Ready',
  unverified: 'Not verified',
  unreachable: 'Unreachable',
  error: 'Connection error',
};

/** Configured backends, seeds first. Catalog entries below are not configured. */
export const BACKENDS: Backend[] = [
  {
    id: 'b-local',
    name: 'This machine',
    type: 'local',
    blurb: 'The machine Thylas runs on.',
    status: 'ready',
    enabled: true,
    isDefault: true,
    instances: 'exposed',
    capabilities: ['run', 'instances', 'logs'],
    fields: [
      { id: 'agent', label: 'Agent', kind: 'text', hint: 'The address the local agent reports from. This build pretends to read it.' },
    ],
    config: { agent: 'localhost:7710' },
  },
  {
    id: 'b-ssh',
    name: 'Lab SSH',
    type: 'ssh',
    blurb: 'Any server reachable over SSH.',
    status: 'ready',
    enabled: true,
    instances: 'exposed',
    capabilities: ['run', 'instances', 'logs'],
    fields: SSH_FIELDS,
    config: { host: 'lab.onda.dev', port: '22', user: 'ceaser', auth: 'Key file' },
  },
  {
    id: 'b-slurm',
    name: 'Cluster (Slurm)',
    type: 'slurm',
    blurb: 'Submitted to a partition; the scheduler decides.',
    status: 'ready',
    enabled: true,
    instances: 'none',
    capabilities: ['run', 'schedule', 'logs'],
    fields: SLURM_FIELDS,
    config: { host: 'login.onda.dev', partition: 'gpu', account: 'research' },
  },
  {
    id: 'b-kubernetes',
    name: 'Kubernetes',
    type: 'kubernetes',
    blurb: 'One namespace, one context. Saved, never tested.',
    status: 'unverified',
    enabled: true,
    instances: 'none',
    capabilities: ['run', 'schedule', 'logs'],
    fields: KUBERNETES_FIELDS,
    config: { context: 'onda-prod', namespace: 'research' },
  },
];

/** Catalog entries a person could configure. Planned ones have no flow. */
export const BACKEND_CATALOG: Backend[] = [
  { id: 'c-local', name: 'Local', type: 'local', blurb: 'This machine, through the local agent.', status: 'ready', enabled: true, instances: 'exposed', capabilities: ['run', 'instances', 'logs'], fields: [], configured: true },
  { id: 'c-ssh', name: 'SSH', type: 'ssh', blurb: 'A server you can reach. Hardware is read; nothing is installed.', status: 'ready', enabled: true, instances: 'exposed', capabilities: ['run', 'instances', 'logs'], fields: SSH_FIELDS, configured: true },
  { id: 'c-slurm', name: 'Slurm', type: 'slurm', blurb: 'Submit to a partition; the scheduler places the work.', status: 'ready', enabled: true, instances: 'none', capabilities: ['run', 'schedule', 'logs'], fields: SLURM_FIELDS, configured: true },
  { id: 'c-kubernetes', name: 'Kubernetes', type: 'kubernetes', blurb: 'Jobs in one namespace of one context.', status: 'ready', enabled: true, instances: 'none', capabilities: ['run', 'schedule', 'logs'], fields: KUBERNETES_FIELDS, configured: true },
  { id: 'c-ray', name: 'Ray', type: 'ray', blurb: 'Submit to a Ray cluster through its head address.', status: 'ready', enabled: true, instances: 'none', capabilities: ['run', 'schedule', 'logs'], fields: RAY_FIELDS, configured: true },
  { id: 'c-modal', name: 'Modal', type: 'modal', blurb: 'Serverless containers, provisioned per run. Nothing to point at.', status: 'ready', enabled: true, instances: 'none', capabilities: ['run', 'scale', 'logs'], fields: [{ id: 'token', label: 'Token', kind: 'secret' }], docs: 'https://modal.com/docs' },
  { id: 'c-hf-jobs', name: 'Hugging Face Jobs', type: 'hf-jobs', blurb: 'Run jobs on Hugging Face infrastructure.', status: 'ready', enabled: true, instances: 'none', capabilities: ['run', 'scale'], fields: [{ id: 'token', label: 'Token', kind: 'secret' }], docs: 'https://huggingface.co/docs' },
  { id: 'c-tinker', name: 'Tinker', type: 'tinker', blurb: 'Not implemented. Listed so the boundary is a fact, not an absence.', status: 'ready', enabled: false, instances: 'none', capabilities: [], fields: [], docs: 'https://thinkingmachines.ai' },
];

/* --------------------------------------------------------------------------
   Instances
   -------------------------------------------------------------------------- */

export const INSTANCES: Instance[] = [
  {
    id: 'r-studio',
    name: 'studio-win',
    backendId: 'b-local',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: { cpu: 'Ryzen 9 7950X', cores: 16, gpu: 'RTX 4070 Ti', gpuMemoryGb: 12, gpuClass: 'consumer', memoryGb: 64, storageGb: 2000 },
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
    backendId: 'b-local',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: { cpu: 'Apple M3 Max', cores: 16, gpu: 'M3 Max (40-core)', gpuMemoryGb: 36, gpuClass: 'workstation', memoryGb: 48, storageGb: 1000 },
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
    backendId: 'b-ssh',
    scope: 'org',
    owner: 'Research',
    hardware: { cpu: 'Xeon Gold 6338', cores: 64, gpu: '2 × A100 40GB', gpuMemoryGb: 40, gpuClass: 'datacenter', memoryGb: 512, storageGb: 8000 },
    os: 'Ubuntu 24.04 LTS',
    runtime: ['CUDA 12.6', 'PyTorch 2.5', 'Slurm worker'],
    connection: 'connected',
    availability: 'busy',
    utilization: { cpu: 78, gpu: 94, memory: 71 },
    workloads: 2,
    lastSeen: 'now',
  },
  {
    id: 'r-onda-gpu',
    name: 'onda-gpu-02',
    backendId: 'b-ssh',
    scope: 'org',
    owner: 'Onda Lab',
    hardware: { cpu: 'EPYC 7543', cores: 32, gpu: 'RTX A6000', gpuMemoryGb: 48, gpuClass: 'workstation', memoryGb: 256, storageGb: 4000 },
    os: 'Ubuntu 22.04 LTS',
    runtime: ['CUDA 12.2', 'PyTorch 2.4'],
    connection: 'connected',
    availability: 'available',
    utilization: { cpu: 6, gpu: 0, memory: 18 },
    workloads: 0,
    lastSeen: 'now',
  },
  {
    id: 'r-office',
    name: 'office-box',
    backendId: 'b-ssh',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: { cpu: 'i7-12700', cores: 12, gpu: 'RTX 3060', gpuMemoryGb: 12, gpuClass: 'consumer', memoryGb: 32, storageGb: 1000 },
    os: 'Debian 12',
    runtime: ['CUDA 12.1'],
    connection: 'disconnected',
    availability: 'offline',
    workloads: 0,
    lastSeen: '6d ago',
  },
  {
    id: 'r-aws-h100',
    name: 'h100-x1 · i-0a77',
    backendId: 'b-ssh',
    scope: 'personal',
    owner: 'Ceaser',
    hardware: { cpu: 'EPYC 7R32', cores: 8, gpu: 'H100 80GB', gpuMemoryGb: 80, gpuClass: 'datacenter', memoryGb: 64, storageGb: 500 },
    os: 'Ubuntu 24.04 LTS',
    runtime: ['CUDA 12.6', 'PyTorch 2.5'],
    connection: 'connected',
    availability: 'available',
    utilization: { cpu: 4, gpu: 0, memory: 11 },
    workloads: 0,
    lastSeen: 'now',
    ratePerHour: 2.49,
    acquiredVia: 'l-h100-1',
    note: 'Acquired in the Marketplace. Billed hourly while it runs; the rate shown is the representative sample, not a live price.',
  },
];

/* --------------------------------------------------------------------------
   Workloads
   -------------------------------------------------------------------------- */

export const WORKLOADS: Workload[] = [
  {
    id: 'wl-ablation',
    name: 'ablation-7 · context window sweep',
    kind: 'Training',
    backendId: 'b-ssh',
    instanceId: 'r-lab-01',
    state: 'running',
    startedAt: '1h 12m ago',
    duration: '~3h left',
    progress: 62,
    cpuPct: 78,
    gpuPct: 94,
    memoryGb: 210,
    intent: 'Sweep the context window and report the delta with a confidence interval.',
    events: [
      { t: '00:00', text: 'accepted · target chosen in Run' },
      { t: '00:02', text: 'tool: files.read(raw-runs.parquet)', kind: 'tool' },
      { t: '00:06', text: 'training step 3,140 / 5,100', kind: 'state' },
    ],
  },
  {
    id: 'wl-tokenizer',
    name: 'tokenizer-eval',
    kind: 'Evaluation',
    backendId: 'b-ssh',
    instanceId: 'r-lab-01',
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
    kind: 'Data job',
    backendId: 'b-local',
    instanceId: 'r-studio',
    state: 'running',
    startedAt: '8m ago',
    duration: '~20m left',
    progress: 18,
    cpuPct: 41,
    gpuPct: 87,
    memoryGb: 28,
  },
  {
    id: 'wl-cluster-brief',
    name: 'protocol-brief · compile specs',
    kind: 'Data job',
    backendId: 'b-slurm',
    state: 'queued',
    startedAt: 'queued 3m ago',
    duration: 'waiting for the scheduler',
    cpuPct: 0,
    memoryGb: 0,
    note: 'Targets the Slurm partition. No single machine is the target; the scheduler places it.',
  },
  {
    id: 'wl-baseline',
    name: 'baseline-sweep · seed 12',
    kind: 'Training',
    backendId: 'b-ssh',
    instanceId: 'r-lab-01',
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
    backendId: 'b-ssh',
    instanceId: 'r-office',
    state: 'failed',
    startedAt: '2d ago',
    duration: '0m 41s',
    cpuPct: 0,
    memoryGb: 0,
    note: 'The host stopped answering mid-run.',
    events: [{ t: '00:19', text: 'failed · host stopped answering', kind: 'state' }],
  },
  {
    id: 'wl-docs',
    name: 'reindex · notes',
    kind: 'Data job',
    backendId: 'b-local',
    instanceId: 'r-macbook',
    state: 'cancelled',
    startedAt: '3d ago',
    duration: '12m 04s',
    cpuPct: 0,
    memoryGb: 0,
  },
];

/* --------------------------------------------------------------------------
   Marketplace listings — representative samples, never live prices
   -------------------------------------------------------------------------- */

export const LISTINGS: Listing[] = [
  {
    id: 'l-h100-1',
    provider: 'Lambda',
    name: '1 × H100 80GB',
    hardware: { cpu: 'EPYC 7452', cores: 30, gpu: 'H100 PCIe', gpuMemoryGb: 80, gpuClass: 'datacenter', memoryGb: 240, storageGb: 500 },
    region: 'us-east-1',
    ratePerHour: 2.49,
    availability: 'representative',
    useVia: ['ssh'],
    blurb: 'Single H100 on a dedicated host. The sample this build pretends r-aws-h100 came from.',
  },
  {
    id: 'l-h100-8',
    provider: 'AWS',
    name: 'p5.48xlarge · 8 × H100',
    hardware: { cpu: 'Intel Sapphire Rapids', cores: 192, gpu: '8 × H100 80GB', gpuMemoryGb: 640, gpuClass: 'datacenter', memoryGb: 2048, storageGb: 8000 },
    region: 'us-east-1',
    ratePerHour: 37.9,
    availability: 'representative',
    useVia: ['ssh', 'kubernetes'],
    blurb: 'Multi-GPU training node. Used through SSH or attached to a Kubernetes cluster.',
  },
  {
    id: 'l-a100-1',
    provider: 'GCP',
    name: '1 × A100 40GB',
    hardware: { cpu: 'Intel Xeon 8473C', cores: 24, gpu: 'A100 40GB', gpuMemoryGb: 40, gpuClass: 'datacenter', memoryGb: 170, storageGb: 1000 },
    region: 'us-central1',
    ratePerHour: 1.89,
    availability: 'representative',
    useVia: ['ssh', 'kubernetes'],
    blurb: 'The previous datacenter standard; still the cheapest 40GB of HBM in the sample.',
  },
  {
    id: 'l-4090-1',
    provider: 'RunPod',
    name: '1 × RTX 4090',
    hardware: { cpu: 'AMD EPYC 7402', cores: 16, gpu: 'RTX 4090', gpuMemoryGb: 24, gpuClass: 'consumer', memoryGb: 64, storageGb: 500 },
    region: 'eu-central',
    ratePerHour: 0.69,
    availability: 'representative',
    useVia: ['ssh'],
    blurb: 'Consumer GPU, community cloud. Fine for evaluation; not a datacenter machine.',
  },
  {
    id: 'l-a6000-1',
    provider: 'Vast.ai',
    name: '1 × RTX A6000',
    hardware: { cpu: 'Ryzen 9 5950X', cores: 16, gpu: 'RTX A6000', gpuMemoryGb: 48, gpuClass: 'workstation', memoryGb: 128, storageGb: 1000 },
    region: 'us-west',
    ratePerHour: 0.54,
    availability: 'waitlist',
    useVia: ['ssh'],
    blurb: '48GB workstation card at the lowest sample rate; hosts report when available.',
  },
  {
    id: 'l-cpu-1',
    provider: 'Hetzner',
    name: 'CPX61 · 16 vCPU',
    hardware: { cpu: 'AMD EPYC 7502P', cores: 16, memoryGb: 64, storageGb: 960 },
    region: 'eu-central',
    ratePerHour: 0.21,
    availability: 'representative',
    useVia: ['ssh'],
    blurb: 'CPU-only. Data preparation and builds; no GPU, which is the point.',
  },
];

/* --------------------------------------------------------------------------
   Derived views
   -------------------------------------------------------------------------- */

/** A machine we cannot reach has no availability to report. */
export function availabilityOf(instance: Instance): Availability {
  if (instance.connection === 'connected') return instance.availability;
  return 'unknown';
}

/** Utilization exists only while the machine can be seen right now. */
export function metricsOf(instance: Instance): Utilization | undefined {
  return availabilityOf(instance) === 'unknown' ? undefined : instance.utilization;
}

export function statusLine(instance: Instance): string {
  const conn =
    instance.connection === 'connected'
      ? 'Connected'
      : instance.connection === 'connecting'
        ? 'Connecting'
        : instance.connection === 'error'
          ? 'Connection error'
          : 'Disconnected';
  const avail = availabilityOf(instance);
  const word =
    avail === 'available' ? 'Available' : avail === 'busy' ? 'Busy' : avail === 'offline' ? 'Offline' : 'Availability unknown';
  return `${conn} · ${word}`;
}

/** The table version: one line, the least decisive number dropped first. */
export function hardwareBrief(h: Hardware): string {
  /* A GPU whose name already carries its size ("H100 80GB") must not get the
     number appended a second time. */
  const gpu = h.gpu ? `${h.gpu}${h.gpuMemoryGb && !/GB/i.test(h.gpu) ? ` ${h.gpuMemoryGb}GB` : ''}` : 'no GPU';
  return `${h.cores} cores · ${gpu} · ${h.memoryGb}GB`;
}

/* --------------------------------------------------------------------------
   Compute Selection — a sort with reasons the reader can argue with
   -------------------------------------------------------------------------- */

export type Requirements = {
  name: string;
  kind: string;
  gpu: 'required' | 'none' | 'any';
  minGpuMemoryGb?: number;
  gpuClass?: Hardware['gpuClass'];
  minCores?: number;
  minMemoryGb?: number;
  scope: 'any' | 'personal' | 'org';
  backendId?: string;
};

export const EMPTY_REQUIREMENTS: Requirements = {
  name: '',
  kind: 'Evaluation',
  gpu: 'any',
  scope: 'any',
};

/** A runnable target: an instance, or a backend that provisions itself. */
export type Target = {
  kind: 'instance' | 'backend';
  id: string;
  name: string;
  backendId: string;
  backendName: string;
  scope: 'personal' | 'org';
  owner: string;
  hardware?: Hardware;
  availability: Availability;
  connection?: Instance['connection'];
  /** For a backend target: the words for why there is no machine to pick. */
  provisionNote?: string;
};

export type Recommendation = {
  target: Target;
  score: number;
  reasons: string[];
  caveats: string[];
};

/** The eligible targets, given the backends that exist and are usable. */
export function eligibleTargets(backends: Backend[], instances: Instance[]): Target[] {
  const targets: Target[] = [];
  const usable = new Map(backends.filter((b) => b.enabled && b.status === 'ready').map((b) => [b.id, b]));
  for (const instance of instances) {
    const backend = usable.get(instance.backendId);
    if (!backend) continue;
    targets.push({
      kind: 'instance',
      id: instance.id,
      name: instance.name,
      backendId: backend.id,
      backendName: backend.name,
      scope: instance.scope,
      owner: instance.owner,
      hardware: instance.hardware,
      availability: availabilityOf(instance),
      connection: instance.connection,
    });
  }
  for (const backend of usable.values()) {
    if (backend.instances !== 'none') continue;
    targets.push({
      kind: 'backend',
      id: backend.id,
      name: backend.name,
      backendId: backend.id,
      backendName: backend.name,
      scope: 'org',
      owner: '—',
      availability: 'unknown',
      provisionNote: 'Work targets the environment; the cluster or platform provisions. Start time is not known here.',
    });
  }
  return targets;
}

/**
 * Rank targets against stated requirements. Hard filters first, then fit,
 * locality, waste, and backend honesty. Deterministic: same inputs, same
 * order, so a recommendation can be argued with and reproduced.
 */
export function rankTargets(req: Requirements, targets: Target[]): Recommendation[] {
  const out: Recommendation[] = [];
  for (const target of targets) {
    const reasons: string[] = [];
    const caveats: string[] = [];
    const h = target.hardware;

    if (req.scope !== 'any' && target.kind === 'instance' && target.scope !== req.scope) continue;
    if (req.backendId && target.backendId !== req.backendId) continue;

    if (target.kind === 'instance' && h) {
      if (req.gpu === 'required' && !h.gpuMemoryGb) continue;
      if (req.gpu === 'none' && h.gpuMemoryGb) continue;
      if (req.minGpuMemoryGb) {
        if (!h.gpuMemoryGb || h.gpuMemoryGb < req.minGpuMemoryGb) continue;
      }
      if (req.gpuClass && h.gpuClass !== req.gpuClass) continue;
      if (req.minCores && h.cores < req.minCores) continue;
      if (req.minMemoryGb && h.memoryGb < req.minMemoryGb) continue;
    }
    if (target.kind === 'backend') {
      /* A GPU requirement cannot be verified against an environment that
         exposes no machines, so it is not promised here either. */
      if (req.gpu !== 'any' || req.minGpuMemoryGb) continue;
    }

    let score = 40;

    if (target.kind === 'instance') {
      if (target.availability === 'available') {
        score += 30;
        reasons.push('Idle: no workload is running on it.');
      } else if (target.availability === 'busy') {
        score -= 20;
        caveats.push('Running work now; it would queue.');
      } else if (target.availability === 'offline') {
        score -= 45;
        caveats.push('Asleep or offline; it has to come back before anything can start.');
      } else {
        caveats.push('No connection, so availability is unknown, not merely idle.');
      }

      if (req.minGpuMemoryGb && h?.gpuMemoryGb) {
        const headroom = h.gpuMemoryGb - req.minGpuMemoryGb;
        if (headroom >= 24) {
          score -= 6;
          caveats.push(`${headroom}GB of GPU memory beyond the requirement.`);
        } else if (headroom >= 8) {
          score += 8;
          reasons.push(`${headroom}GB of GPU memory to spare — enough for a larger batch.`);
        } else {
          score += 2;
          reasons.push('GPU memory fits with room to spare.');
        }
      }

      if (target.scope === 'personal') {
        score += 6;
        reasons.push('Yours: no one else is waiting for it.');
      } else {
        caveats.push(`Shared with ${target.owner}. Coordinate before a long run.`);
      }
    } else {
      score += 4;
      reasons.push('The environment provisions for the work; no machine has to be free.');
      caveats.push(target.provisionNote ?? 'Start time is not known here.');
    }

    if (reasons.length === 0) reasons.push('Meets every stated requirement.');

    out.push({ target, score: Math.max(0, Math.min(100, score)), reasons, caveats });
  }

  return out.sort(
    (a, b) => b.score - a.score || a.target.name.localeCompare(b.target.name),
  );
}

/** What the selection screen says when nothing fits. */
export function noMatchReason(req: Requirements): string {
  if (req.minGpuMemoryGb && req.minGpuMemoryGb > 80) {
    return 'No target in the pool offers more than 80GB of GPU memory. Acquire a larger one in the Marketplace.';
  }
  if (req.gpuClass === 'datacenter' && req.gpu === 'required') {
    return 'No connected datacenter GPU meets the other requirements. Verify an unreachable backend, or lower a constraint.';
  }
  return 'Nothing meets all of the stated requirements. Loosen one, or configure a backend that does.';
}

/* --------------------------------------------------------------------------
   Filtering (instances, marketplace)
   -------------------------------------------------------------------------- */

export type InstanceFilter = {
  query: string;
  backendId: string | 'all';
  availability: Availability | 'all';
  scope: 'personal' | 'org' | 'all';
};

export const EMPTY_INSTANCE_FILTER: InstanceFilter = {
  query: '',
  backendId: 'all',
  availability: 'all',
  scope: 'all',
};

export function filterInstances(instances: Instance[], filter: InstanceFilter, backends: Backend[]): Instance[] {
  const q = filter.query.trim().toLowerCase();
  return instances.filter((i) => {
    if (filter.backendId !== 'all' && i.backendId !== filter.backendId) return false;
    if (filter.scope !== 'all' && i.scope !== filter.scope) return false;
    if (filter.availability !== 'all' && availabilityOf(i) !== filter.availability) return false;
    if (!q) return true;
    const backend = backends.find((b) => b.id === i.backendId)?.name ?? '';
    return `${i.name} ${i.os} ${i.hardware.cpu} ${i.hardware.gpu ?? ''} ${backend}`.toLowerCase().includes(q);
  });
}

export type ListingFilter = {
  gpuClass: Hardware['gpuClass'] | 'all';
  minGpuMemoryGb: number | null;
  provider: string | 'all';
  region: string | 'all';
  maxRate: number | null;
  useVia: BackendType | 'all';
};

export const EMPTY_LISTING_FILTER: ListingFilter = {
  gpuClass: 'all',
  minGpuMemoryGb: null,
  provider: 'all',
  region: 'all',
  maxRate: null,
  useVia: 'all',
};

export function filterListings(listings: Listing[], f: ListingFilter): Listing[] {
  return listings.filter((l) => {
    if (f.gpuClass !== 'all' && l.hardware.gpuClass !== f.gpuClass) return false;
    if (f.minGpuMemoryGb !== null && (l.hardware.gpuMemoryGb ?? 0) < f.minGpuMemoryGb) return false;
    if (f.provider !== 'all' && l.provider !== f.provider) return false;
    if (f.region !== 'all' && l.region !== f.region) return false;
    if (f.maxRate !== null && l.ratePerHour > f.maxRate) return false;
    if (f.useVia !== 'all' && !l.useVia.includes(f.useVia)) return false;
    return true;
  });
}
