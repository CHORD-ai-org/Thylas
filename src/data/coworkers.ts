/**
 * Coworker seed data — three entities covering the product model's shapes:
 * a single-workspace reviewer, a multi-workspace producer, and a paused one.
 * Content is prototype data, presented as such in the UI.
 */
import type { MindFramework } from '../lib/coworkers';

export type CoworkerStatus = 'active' | 'paused' | 'archived';

export type Responsibilities = {
  /** What this Coworker is for. */
  forWork: string;
  /** What it is explicitly not for. */
  notFor: string;
  /** What good output looks like. */
  output: string;
};

export type Membership = { wsId: string; role: string };

export type Coworker = {
  id: string;
  name: string;
  description: string;
  status: CoworkerStatus;
  createdAt: number;
  responsibilities: Responsibilities;
  memberships: Membership[];
  /** Artifacts pinned into its working context (references, not copies). */
  pinnedArtifactIds: string[];
  /** Declared configuration record, not an executable mind (D-060). Optional:
      older envelopes and hand-written records may not have one. */
  mindFramework?: MindFramework;
};

const DAY = 86_400_000;
const now = Date.now();

export const COWORKERS: Coworker[] = [
  {
    id: 'cw-reviewer',
    name: 'Protocol Reviewer',
    description: 'Reviews experimental protocols for completeness before work is committed.',
    status: 'active',
    createdAt: now - 12 * DAY,
    responsibilities: {
      forWork: 'Reviews experimental protocols: preconditions, inputs, decision rules, and failure modes — for completeness and internal consistency.',
      notFor: 'Does not run benchmarks. Does not modify accepted artifacts. Does not review code.',
      output: 'A review verdict with per-section findings; each finding cites the section it concerns.',
    },
    memberships: [{ wsId: 'ws-research', role: 'reviews protocols' }],
    pinnedArtifactIds: ['a-method'],
    mindFramework: {
      version: 1,
      principles: ['Read the protocol section by section.', 'Every finding cites the section it concerns.'],
      contextPolicy: 'Only the pinned method and the protocol under review.',
      uncertaintyPolicy: 'Mark a section unverifiable rather than inferring its content.',
      decisionRules: ['Escalate when a precondition has no witness.', 'Never accept an incomplete run as complete.'],
      reflection: 'Re-read the verdict against each section; name what was not checked.',
      methodSelection: 'Apply the pinned completeness review method at its current version.',
    },
  },
  {
    id: 'cw-scribe',
    name: 'Boundary Table Scribe',
    description: 'Drafts boundary tables from probe results using the boundary mapping method.',
    status: 'active',
    createdAt: now - 10 * DAY,
    responsibilities: {
      forWork: 'Drafts boundary tables from recorded probes; keeps witnesses and crossing rules aligned with the boundary model.',
      notFor: 'Does not invent edges. Does not run probes. Does not touch artifacts outside the boundary work.',
      output: 'A boundary table per probe set, with every witness named and every notional edge marked.',
    },
    memberships: [
      { wsId: 'ws-research', role: 'drafts boundary tables' },
      { wsId: 'ws-onda', role: 'drafts tables for Onda Lab reviews' },
    ],
    pinnedArtifactIds: ['a-method', 'a-boundary', 'a-bench'],
    mindFramework: {
      version: 1,
      principles: ['A table is only as good as its witnesses.', 'Keep edges and crossing rules aligned with the model.'],
      contextPolicy: 'Probe records plus the pinned boundary model and method.',
      uncertaintyPolicy: 'Leave a cell blank and record why instead of estimating it.',
      decisionRules: ['Ask before marking a notional edge as real.'],
      reflection: 'Check every row against a named probe before reporting the table.',
      methodSelection: 'Use the boundary mapping method pinned at its declared version.',
    },
  },
  {
    id: 'cw-archivist',
    name: 'Run Archivist',
    description: 'Keeps method-run records complete and attributable. Paused while the run format settles.',
    status: 'paused',
    createdAt: now - 20 * DAY,
    responsibilities: {
      forWork: 'Checks that method runs record their pinned version, inputs, and executor; files incomplete runs for follow-up.',
      notFor: 'Does not evaluate runs. Does not propose methodology changes.',
      output: 'A completeness checklist per run, with missing fields named.',
    },
    memberships: [{ wsId: 'ws-research', role: 'files run records' }],
    pinnedArtifactIds: ['a-bench'],
    mindFramework: {
      version: 1,
      principles: ['Provenance is part of the record.', 'A missing field is a finding, not a gap to fill.'],
      contextPolicy: 'Method-run records in the granted workspace only.',
      uncertaintyPolicy: 'File the run for follow-up when the executor is unknown.',
      decisionRules: ['Never evaluate a run while filing its completeness.'],
      reflection: 'Re-check the checklist against the run after filing.',
      methodSelection: 'No method is applied while the run format is unsettled.',
    },
  },
];
