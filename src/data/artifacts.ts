/**
 * Artifact seed data — seven artifacts covering every kind, one external.
 *
 * Content is prototype data, presented as such in the UI. Section templates
 * are per-kind: the detail page renders what each kind actually needs, and
 * the sections below ARE those templates with content filled in.
 */

export type ArtifactKind =
  | 'concept'
  | 'methodology'
  | 'executable'
  | 'product'
  | 'empirical'
  | 'structural'
  | 'external';

export type ArtifactStatus = 'draft' | 'in-review' | 'accepted' | 'deprecated';

export type ArtifactSection = { id: string; title: string; body: string };

export type ArtifactRelation = {
  id: string;
  label: string;
  targetId: string;
};

export type ExternalSource = { system: 'notion' | 'obsidian' | 'github'; location: string };

/** Cover hues (design/artifacts-gallery.md §2.2). Named, not free-form: the
    palette owns six values per theme, the artifact only names one. */
export const COVER_HUES = ['blue', 'green', 'clay', 'violet', 'teal', 'amber'] as const;
export type CoverHue = (typeof COVER_HUES)[number];

/** An artifact's cover selection. Both fields are optional — absent means
    "derive": symbol from the kind, hue from the id hash. */
export type ArtifactCover = {
  symbol?: ArtifactKind;
  hue?: CoverHue;
};

export type Artifact = {
  id: string;
  kind: ArtifactKind;
  name: string;
  summary: string;
  status: ArtifactStatus;
  createdAt: number;
  updatedAt: number;
  author: string;
  source: 'native' | ExternalSource;
  sections: ArtifactSection[];
  relations: ArtifactRelation[];
  versions: { v: number; at: number; by: string; note: string }[];
  cover?: ArtifactCover;
};

export const KIND_LABEL: Record<ArtifactKind, string> = {
  concept: 'Concept',
  methodology: 'Methodology',
  executable: 'Executable',
  product: 'Product',
  empirical: 'Empirical',
  structural: 'Structural',
  external: 'External',
};

/** Section templates per kind: what the detail page renders and what a new
    artifact of this kind starts with. */
export const KIND_SECTIONS: Record<ArtifactKind, string[]> = {
  concept: ['Definition', 'Origin and context', 'Components', 'Examples and counter-examples'],
  methodology: ['Purpose', 'Applicability', 'Preconditions', 'Procedure', 'Decision rules', 'Expected outputs', 'Constraints'],
  executable: ['Description', 'Source', 'Usage', 'Dependencies'],
  product: ['Description', 'Purpose', 'Key properties', 'Related resources'],
  empirical: ['Observation', 'Conditions', 'Evidence', 'Supports / contradicts'],
  structural: ['Overview', 'Stages', 'Open questions'],
  external: ['Summary', 'Why it matters here'],
};

const DAY = 86_400_000;
const now = Date.now();

export const ARTIFACTS: Artifact[] = [
  {
    id: 'a-boundary',
    kind: 'concept',
    name: 'Boundary model',
    summary: 'What a boundary is, what it is not, and why the word needs a definition before models can be compared.',
    status: 'accepted',
    createdAt: now - 9 * DAY,
    updatedAt: now - 1 * DAY,
    author: 'Ceaser',
    source: 'native',
    sections: [
      { id: 's1', title: 'Definition', body: 'A boundary is where one thing stops being itself and another begins. It is an edge with two sides, a direction of crossing, and a cost.' },
      { id: 's2', title: 'Origin and context', body: 'Grew out of the tokenizer comparison work: models disagreed because they measured different edges.' },
      { id: 's3', title: 'Components', body: 'Two sides. A crossing rule. A cost of crossing. A witness — the observable that tells you the boundary was crossed.' },
      { id: 's4', title: 'Examples and counter-examples', body: 'A timezone is a boundary (crossing costs coordination). A Meridian line is not — nothing observable changes when you cross it.' },
    ],
    relations: [
      { id: 'r1', label: 'defined by', targetId: 'a-method' },
      { id: 'r2', label: 'tested by', targetId: 'a-bench' },
    ],
    versions: [
      { v: 1, at: now - 9 * DAY, by: 'Ceaser', note: 'first draft' },
      { v: 2, at: now - 3 * DAY, by: 'WAM (proposal, accepted by Ceaser)', note: 'added the witness component' },
      { v: 3, at: now - 1 * DAY, by: 'Ceaser', note: 'accepted as the working definition' },
    ],
  },
  {
    id: 'a-method',
    kind: 'methodology',
    name: 'Boundary mapping method',
    summary: 'A repeatable procedure for finding and naming the boundaries of a system before comparing models of it.',
    status: 'accepted',
    createdAt: now - 8 * DAY,
    updatedAt: now - 2 * DAY,
    author: 'Ceaser',
    source: 'native',
    sections: [
      { id: 's1', title: 'Purpose', body: 'Make model comparisons meaningful by pinning what each model treats as an edge.' },
      { id: 's2', title: 'Applicability', body: 'Any comparison of systems that claim to solve the same problem. Not applicable to single-system reviews.' },
      { id: 's3', title: 'Preconditions', body: 'A named problem statement. At least two candidate models. Permission to run one small probe.' },
      { id: 's4', title: 'Procedure', body: '1. List each model\u2019s claimed edges.\n2. For every claimed edge, name the witness you expect to observe.\n3. Run one minimal probe per witness.\n4. Record which edges produced observable crossings.' },
      { id: 's5', title: 'Decision rules', body: 'If no witness fires for a claimed edge, the edge is notional — mark it and continue. If a probe contradicts a witness, the model\u2019s boundary claim fails first.' },
      { id: 's6', title: 'Expected outputs', body: 'A boundary table and at least one recorded probe result.' },
      { id: 's7', title: 'Constraints', body: 'One probe per witness — the method measures, it does not prove.' },
    ],
    relations: [{ id: 'r1', label: 'defines', targetId: 'a-boundary' }],
    versions: [
      { v: 1, at: now - 8 * DAY, by: 'Ceaser', note: 'extracted from the tokenizer comparison notes' },
      { v: 2, at: now - 2 * DAY, by: 'Ceaser', note: 'added the notional-edge decision rule' },
    ],
  },
  {
    id: 'a-cli',
    kind: 'executable',
    name: 'tfm-cli',
    summary: 'A small CLI that maps text files to boundary tables using the boundary mapping method.',
    status: 'draft',
    createdAt: now - 5 * DAY,
    updatedAt: now - 4 * DAY,
    author: 'Ceaser',
    source: 'native',
    sections: [
      { id: 's1', title: 'Description', body: 'Reads plain text, extracts claimed edges, and prints a boundary table. Intended as the probe runner for the boundary mapping method.' },
      { id: 's2', title: 'Source', body: 'github.com/zbbsdsb/tfm-cli — the repository is external and not connected in this build.' },
      { id: 's3', title: 'Usage', body: 'tfm map <file> — prints the table.\ntfm probe <file> --witness <name> — runs one probe.' },
      { id: 's4', title: 'Dependencies', body: 'Node 22. No runtime dependencies; the parser is local.' },
    ],
    relations: [{ id: 'r1', label: 'implements', targetId: 'a-method' }],
    versions: [{ v: 1, at: now - 5 * DAY, by: 'Ceaser', note: 'registered the tool' }],
  },
  {
    id: 'a-product',
    kind: 'product',
    name: 'Thylas',
    summary: 'The product this workspace builds — defined here so its principles and roadmap are addressable artifacts.',
    status: 'accepted',
    createdAt: now - 30 * DAY,
    updatedAt: now - 6 * DAY,
    author: 'Ceaser',
    source: 'native',
    sections: [
      { id: 's1', title: 'Description', body: 'A workspace application for computational and research work: files, notes, boards, processes, and the environments that run them.' },
      { id: 's2', title: 'Purpose', body: 'Make computational environments usable — not make users manage infrastructure for its own sake.' },
      { id: 's3', title: 'Key properties', body: 'Workspaces own organization. Processes carry state visibly. Artifacts — this page — carry meaning across work.' },
      { id: 's4', title: 'Related resources', body: 'See the relations panel: the roadmap and the boundary model that governs v1 decisions.' },
    ],
    relations: [
      { id: 'r1', label: 'planned by', targetId: 'a-roadmap' },
      { id: 'r2', label: 'governed by', targetId: 'a-boundary' },
    ],
    versions: [
      { v: 1, at: now - 30 * DAY, by: 'Ceaser', note: 'created' },
      { v: 2, at: now - 6 * DAY, by: 'Ceaser', note: 'artifacts added to key properties' },
    ],
  },
  {
    id: 'a-bench',
    kind: 'empirical',
    name: 'Tokenizer benchmark — boundary probe',
    summary: 'One recorded probe from the boundary mapping method: two models, four claimed edges, two observable crossings.',
    status: 'accepted',
    createdAt: now - 2 * DAY,
    updatedAt: now - 2 * DAY,
    author: 'WAM (proposal, accepted by Ceaser)',
    source: 'native',
    sections: [
      { id: 's1', title: 'Observation', body: 'Of four claimed boundaries, two produced observable crossings; the other two were notional.' },
      { id: 's2', title: 'Conditions', body: 'Same input corpus, temperature 0, one probe per witness as the method requires.' },
      { id: 's3', title: 'Evidence', body: 'The boundary table produced by tfm-cli, stored alongside the run notes.' },
      { id: 's4', title: 'Supports / contradicts', body: 'Supports the boundary model\u2019s witness component. Contradicts neither competing model\u2019s core claim.' },
    ],
    relations: [
      { id: 'r1', label: 'used method', targetId: 'a-method' },
      { id: 'r2', label: 'supports', targetId: 'a-boundary' },
    ],
    versions: [{ v: 1, at: now - 2 * DAY, by: 'WAM (proposal, accepted by Ceaser)', note: 'recorded from the run' }],
  },
  {
    id: 'a-roadmap',
    kind: 'structural',
    name: 'Roadmap — artifacts and coworkers',
    summary: 'The staged plan for bringing artifacts, then coworkers, into the workspace.',
    status: 'in-review',
    createdAt: now - 7 * DAY,
    updatedAt: now - 12 * 60 * 60 * 1000,
    author: 'Ceaser',
    source: 'native',
    sections: [
      { id: 's1', title: 'Overview', body: 'Artifacts first (this page), then coworkers per workspace, then cross-workspace reuse.' },
      { id: 's2', title: 'Stages', body: '1. Library, detail, creation (this prototype).\n2. Server-side persistence for conversations and artifacts.\n3. Coworker records and per-coworker WAM connections.\n4. Canonical reuse across workspaces.' },
      { id: 's3', title: 'Open questions', body: 'Persistence technology. Canonical registry location. Permission model details.' },
    ],
    relations: [{ id: 'r1', label: 'planned by', targetId: 'a-product' }],
    versions: [
      { v: 1, at: now - 7 * DAY, by: 'Ceaser', note: 'created' },
      { v: 2, at: now - 12 * 60 * 60 * 1000, by: 'Ceaser', note: 'stage 1 marked in progress' },
    ],
  },
  {
    id: 'a-vault',
    kind: 'external',
    name: 'Research vault (Obsidian)',
    summary: 'The personal Obsidian vault — referenced, not imported. The vault stays its system of record.',
    status: 'accepted',
    createdAt: now - 4 * DAY,
    updatedAt: now - 4 * DAY,
    author: 'Ceaser',
    source: { system: 'obsidian', location: 'vault:research / boundary-notes.md' },
    sections: [
      { id: 's1', title: 'Summary', body: 'Working notes on boundaries and probes, maintained in Obsidian.' },
      { id: 's2', title: 'Why it matters here', body: 'Several boundary-model sections started as entries in this vault; the vault remains their record.' },
    ],
    relations: [{ id: 'r1', label: 'relates to', targetId: 'a-boundary' }],
    versions: [{ v: 1, at: now - 4 * DAY, by: 'Ceaser', note: 'referenced' }],
  },
];
