/**
 * First-run content and pure helpers for the onboarding preview.
 *
 * Nothing here reaches a store or a network: the page owns its state, the
 * outline is scripted from the answers, and every string the collaboration
 * produces is derivable from what the person typed. Keeping the content in one
 * module means the six screens cannot drift into six different products.
 */

export type PhaseId = 'welcome' | 'profile' | 'workspace' | 'coworker' | 'collaboration' | 'enter';

export const PHASES: { id: PhaseId; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'profile', label: 'Profile' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'coworker', label: 'Coworker' },
  { id: 'collaboration', label: 'Collab' },
  { id: 'enter', label: 'Enter' },
];

/** One question per screen. The six phases stay visible above the sheet; the
    micro-steps inside them are shown as short dots. */
export type StepId =
  | 'welcome'
  | 'name'
  | 'focus'
  | 'interests'
  | 'starting-point'
  | 'workspace-name'
  | 'template'
  | 'coworker-name'
  | 'style'
  | 'collaboration'
  | 'enter';

export type OnboardingStep = {
  id: StepId;
  label: string;
  phase: PhaseId;
  field?: keyof OnboardingState;
};

export const STEPS: OnboardingStep[] = [
  { id: 'welcome', label: 'Welcome', phase: 'welcome' },
  { id: 'name', label: 'Your name', phase: 'profile', field: 'name' },
  { id: 'focus', label: 'Current focus', phase: 'profile', field: 'focus' },
  { id: 'interests', label: 'Interests', phase: 'profile', field: 'interests' },
  { id: 'starting-point', label: 'Starting point', phase: 'workspace', field: 'category' },
  { id: 'workspace-name', label: 'Workspace name', phase: 'workspace', field: 'workspaceName' },
  { id: 'template', label: 'Coworker template', phase: 'coworker', field: 'templateId' },
  { id: 'coworker-name', label: 'Coworker name', phase: 'coworker', field: 'coworkerName' },
  { id: 'style', label: 'Working style', phase: 'coworker', field: 'style' },
  { id: 'collaboration', label: 'First collaboration', phase: 'collaboration' },
  { id: 'enter', label: 'Enter Thylas', phase: 'enter' },
];

/* --------------------------------------------------------------------------
   Starting points
   -------------------------------------------------------------------------- */

export type CategoryId = 'research' | 'product' | 'engineering' | 'knowledge' | 'business' | 'scratch';

export type WorkspaceCategory = {
  id: CategoryId;
  title: string;
  hint: string;
  defaultName: string;
  defaultDescription: string;
  /** 24×24 path, drawn with the shared 1.2 stroke. */
  glyph: string;
};

export const WORKSPACE_CATEGORIES: WorkspaceCategory[] = [
  {
    id: 'research',
    title: 'Research & Discovery',
    hint: 'Questions, evidence, and sources that need to stay connected.',
    defaultName: 'Research & Discovery',
    defaultDescription: 'Open questions, sources, and what was checked.',
    glyph: 'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8M12 3.6v16.8M3.6 12h16.8',
  },
  {
    id: 'product',
    title: 'Product Development',
    hint: 'Shaping what to build and why, from intent to specification.',
    defaultName: 'Product Development',
    defaultDescription: 'Decisions, constraints, and why they were made.',
    glyph: 'M12 3.4 20 7.6v8.8L12 20.6 4 16.4V7.6zM4.2 7.8 12 12l7.8-4.2M12 12v8.4',
  },
  {
    id: 'engineering',
    title: 'Software Engineering',
    hint: 'Systems, code, and the decisions behind their structure.',
    defaultName: 'Software Engineering',
    defaultDescription: 'Components, boundaries, and what changes them.',
    glyph: 'M3.6 7.2v9.6M20.4 7.2v9.6M9.6 8.2 15.4 12l-5.8 3.8z',
  },
  {
    id: 'knowledge',
    title: 'Personal Knowledge',
    hint: 'A private place for notes that accumulate over time.',
    defaultName: 'Personal Knowledge',
    defaultDescription: 'Reading notes and things worth returning to.',
    glyph: 'M4 4.4h7v15.2H4zM13 4.4h7v15.2h-7zM6.4 8.4h2.2M15.4 8.4h2.2',
  },
  {
    id: 'business',
    title: 'Business & Strategy',
    hint: 'Markets, plans, and the assumptions they rest on.',
    defaultName: 'Business & Strategy',
    defaultDescription: 'Assumptions and the evidence that would change a plan.',
    glyph: 'M4 19.4h16M4 15.4l4.6-4 3.4 2.6 4-5.6 4 3.4',
  },
  {
    id: 'scratch',
    title: 'Start from Scratch',
    hint: 'An empty environment, named entirely by you.',
    defaultName: 'My Workspace',
    defaultDescription: '',
    glyph: 'M4.6 4.6h14.8v14.8H4.6zM8.4 12h7.2',
  },
];

/* --------------------------------------------------------------------------
   Coworker templates
   -------------------------------------------------------------------------- */

export type TemplateId = 'researcher' | 'architect' | 'engineer' | 'analyst' | 'critic' | 'generalist';
export type WorkingStyle = 'methodical' | 'exploratory' | 'direct';

export type CoworkerTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  responsibility: string;
  approach: string;
  style: WorkingStyle;
  /** The kind of retained output this working approach produces first. */
  output: string;
  lines: string[];
  glyph: string;
};

export const COWORKER_TEMPLATES: CoworkerTemplate[] = [
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Finds sources, separates evidence from claim, and keeps the open questions visible.',
    responsibility: 'Turn a broad question into a structured line of inquiry with sources to check.',
    approach: 'Evidence first. Cites what it can and marks what it cannot.',
    style: 'methodical',
    output: 'Research Outline',
    lines: [
      'State the question precisely enough that an answer could be wrong.',
      'List what is already known and where that knowledge came from.',
      'Name the sources that would change the current view.',
      'Separate claims, evidence, and open assumptions.',
    ],
    glyph: 'M4 4.6h5.2l2 2.2H20v12.6H4zM7.6 4.6V3M9.8 10.4h4.4M9.8 13.4h4.4M9.8 16.4h2.6',
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Maps the parts, boundaries, and trade-offs before anything is committed.',
    responsibility: 'Produce a draft structure with named components and explicit boundaries.',
    approach: 'Structure first. Names the seams and the decisions they force.',
    style: 'methodical',
    output: 'Architecture Draft',
    lines: [
      'Name the components and the job each one owns.',
      'Draw the boundaries and say what crosses them.',
      'Record the trade-off behind every significant seam.',
      'Mark the decisions that are still reversible.',
    ],
    glyph: 'M4.4 4.4h15.2v15.2H4.4zM4.4 12h15.2M12 4.4v15.2M4.4 4.4l15.2 15.2',
  },
  {
    id: 'engineer',
    name: 'Engineer',
    description: 'Turns intent into ordered steps, constraints, and a path that can be built.',
    responsibility: 'Break work into ordered, testable steps with their dependencies.',
    approach: 'Build order first. Smallest verifiable step before the next.',
    style: 'direct',
    output: 'Implementation Roadmap',
    lines: [
      'Write down the smallest step that can be checked.',
      'Order the steps by dependency, not by ambition.',
      'Name the constraint each step has to respect.',
      'Define what "done" looks like before starting.',
    ],
    glyph: 'M3.6 7.2v9.6M20.4 7.2v9.6M9.6 8.2 15.4 12l-5.8 3.8z',
  },
  {
    id: 'analyst',
    name: 'Analyst',
    description: 'Works from data, states assumptions, and quantifies what is actually known.',
    responsibility: 'Frame the metrics, assumptions, and comparisons needed to judge a question.',
    approach: 'Measures first. Separates signal, assumption, and unknown.',
    style: 'methodical',
    output: 'Analysis Brief',
    lines: [
      'Define the quantity that would answer the question.',
      'List the assumptions the current framing depends on.',
      'Choose the comparison that makes a result interpretable.',
      'Say plainly which data does not exist yet.',
    ],
    glyph: 'M4.2 3.8v16h16M7.6 15.6l3.6-3.6 2.6 1.8 4.2-6',
  },
  {
    id: 'critic',
    name: 'Critic',
    description: 'Reads a claim for weak joints and says plainly where it fails.',
    responsibility: 'Challenge the current framing and record the objections worth answering.',
    approach: 'Objection first. Strongest counterexample before agreement.',
    style: 'exploratory',
    output: 'Review Notes',
    lines: [
      'Restate the claim in its strongest form.',
      'Find the assumption that would do the most damage if wrong.',
      'Write the best available counterexample.',
      'Separate fixable objections from fatal ones.',
    ],
    glyph: 'M12 3.6 20 7.4v5.2c0 4-3.4 6.6-8 8-4.6-1.4-8-4-8-8V7.4zM8.6 8.4l6.8 6.8M15.4 8.4l-6.8 6.8',
  },
  {
    id: 'generalist',
    name: 'Generalist',
    description: 'Connects threads across a body of work without a fixed specialty.',
    responsibility: 'Keep an organised record of the work and surface what connects.',
    approach: 'Continuity first. Keeps the thread intact across sessions.',
    style: 'exploratory',
    output: 'Structured Note',
    lines: [
      'Collect the pieces of work already in motion.',
      'Group them by the question they belong to.',
      'Note where two threads touch.',
      'Leave a clear place for the next session to resume.',
    ],
    glyph: 'M4 5.4h16M4 9.6h16M4 13.8h10M4 18h7',
  },
];

export const WORKING_STYLES: { id: WorkingStyle; label: string; hint: string }[] = [
  { id: 'methodical', label: 'Methodical', hint: 'Ordered, explicit, cites its steps' },
  { id: 'exploratory', label: 'Exploratory', hint: 'Wide, generative, follows connections' },
  { id: 'direct', label: 'Direct', hint: 'Brief, concrete, starts with the next action' },
];

export const INTEREST_SUGGESTIONS = [
  'Systems thinking',
  'Human–computer interaction',
  'Machine learning',
  'Epistemology',
  'Product design',
  'Writing',
  'Cognitive science',
  'Software architecture',
  'Mathematics',
  'Biology',
  'Startups',
  'Philosophy',
] as const;

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

export type OnboardingState = {
  name: string;
  focus: string;
  interests: string[];
  category: CategoryId | null;
  workspaceName: string;
  workspaceDescription: string;
  templateId: TemplateId | null;
  coworkerName: string;
  responsibility: string;
  style: WorkingStyle;
  /** The first output was explicitly retained in the workspace. */
  kept: boolean;
};

export function initialOnboardingState(): OnboardingState {
  /* A recommended template is pre-selected and its defaults are editable.
     The journey starts from a template, but nobody has to configure a system
     before they have seen one. */
  const suggested = COWORKER_TEMPLATES[0]!;
  return {
    name: '',
    focus: '',
    interests: [],
    category: null,
    workspaceName: '',
    workspaceDescription: '',
    templateId: suggested.id,
    coworkerName: suggested.name,
    responsibility: suggested.responsibility,
    style: suggested.style,
    kept: false,
  };
}

/** Realistic answers for a reviewer who wants to walk the whole flow at once. */
export function sampleOnboardingState(): OnboardingState {
  return {
    name: 'Ceaser',
    focus: 'Designing an AI-native learning system that keeps a learner’s context across sessions.',
    interests: ['Systems thinking', 'Machine learning', 'Product design'],
    category: 'research',
    workspaceName: 'Learning Systems',
    workspaceDescription: 'How context survives between sessions.',
    templateId: 'researcher',
    coworkerName: 'Mira',
    responsibility: 'Turn a broad question into a structured line of inquiry with sources to check.',
    style: 'methodical',
    kept: false,
  };
}

export function categoryOf(id: CategoryId | null): WorkspaceCategory {
  return WORKSPACE_CATEGORIES.find((c) => c.id === id) ?? WORKSPACE_CATEGORIES[5]!;
}

export function templateOf(id: TemplateId | null): CoworkerTemplate {
  return COWORKER_TEMPLATES.find((t) => t.id === id) ?? COWORKER_TEMPLATES[5]!;
}

export function styleOf(id: WorkingStyle): string {
  return WORKING_STYLES.find((s) => s.id === id)?.label ?? 'Methodical';
}

/* --------------------------------------------------------------------------
   Derived content
   -------------------------------------------------------------------------- */

/** One line, never an ellipsis in the middle of a word. */
export function shortFocus(text: string, max = 64): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function suggestedTask(state: OnboardingState): string {
  const template = templateOf(state.templateId);
  const output = template.output.toLowerCase();
  const topic = state.focus.trim() ? shortFocus(state.focus, 58) : 'your current focus';
  return `Prepare ${articleFor(output)} ${output} for ${topic}`;
}

export type OutlineSection = { title: string; lines: string[] };
export type Outline = {
  title: string;
  output: string;
  author: string;
  sections: OutlineSection[];
};

/** The simulated first output. Every line is derived from typed answers — no
    invented facts, no model call, and deterministic for the same answers. */
export function buildOutline(input: {
  focus: string;
  category: CategoryId | null;
  templateId: TemplateId | null;
  coworkerName: string;
  extra?: string[];
}): Outline {
  const template = templateOf(input.templateId);
  const category = categoryOf(input.category);
  const author = input.coworkerName.trim() || template.name;
  const topic = input.focus.trim() ? shortFocus(input.focus, 88) : 'your current focus';
  const extra = (input.extra ?? []).map((line) => line.trim()).filter(Boolean);

  const sections: OutlineSection[] = [
    {
      title: 'Starting point',
      lines: [topic, `Workspace: ${category.title}. Prepared with ${author}.`],
    },
    {
      title: 'The question',
      lines: [`What would have to be true for real progress on ${topic}?`],
    },
    { title: 'Lines of work', lines: [...template.lines] },
    {
      title: 'First deliverable',
      lines: [`Draft the opening section, then review it with ${author}.`],
    },
  ];
  if (extra.length > 0) {
    sections.push({ title: 'Your direction', lines: extra.map((line) => `Add: ${line}`) });
  }

  return {
    title: `${template.output} — ${shortFocus(topic, 44)}`,
    output: template.output,
    author,
    sections,
  };
}

/** One builder for the preview and for anything that reads the same outline
    after a changed answer, so the two can never disagree. */
export function outlineFor(state: OnboardingState, extras: string[] = []): Outline {
  return buildOutline({
    focus: state.focus,
    category: state.category,
    templateId: state.templateId,
    coworkerName: state.coworkerName,
    extra: extras,
  });
}

export function outlineToText(outline: Outline): string {
  const body = outline.sections
    .map((section) => `${section.title}\n${section.lines.map((line) => `- ${line}`).join('\n')}`)
    .join('\n\n');
  return `${outline.title}\n\n${body}\n`;
}

/* --------------------------------------------------------------------------
   Validation and summary
   -------------------------------------------------------------------------- */

export type Validation = { message: string; field: string } | null;

/** Essential fields only. Interests, a workspace description and the whole
    Coworker customisation are optional and can be left at their defaults. */
export function validateStep(step: number, state: OnboardingState): Validation {
  const current = STEPS[step];
  if (!current) return null;
  switch (current.id) {
    case 'name':
      if (!state.name.trim()) return { message: 'Add a preferred name.', field: 'name' };
      break;
    case 'focus':
      if (!state.focus.trim()) return { message: 'Add your current focus.', field: 'focus' };
      break;
    case 'starting-point':
      if (!state.category) return { message: 'Choose a starting point.', field: 'category' };
      break;
    case 'workspace-name':
      if (!state.workspaceName.trim()) return { message: 'Name the workspace.', field: 'workspaceName' };
      break;
    case 'template':
      if (!state.templateId) return { message: 'Choose a Coworker template.', field: 'templateId' };
      break;
    case 'coworker-name':
      if (!state.coworkerName.trim()) return { message: 'Name your Coworker.', field: 'coworkerName' };
      break;
    default:
      break;
  }
  return null;
}

export type SummaryRow = { label: string; value: string; detail: string };

export function environmentSummary(
  state: OnboardingState,
  outline: Outline | null,
  collabDone: boolean,
): SummaryRow[] {
  const template = templateOf(state.templateId);
  return [
    {
      label: 'Your profile',
      value: state.name.trim() || 'Unnamed',
      detail: state.focus.trim() ? shortFocus(state.focus, 72) : 'No current focus given',
    },
    {
      label: 'First workspace',
      value: state.workspaceName.trim() || 'Untitled workspace',
      detail: categoryOf(state.category).title,
    },
    {
      label: 'First coworker',
      value: state.coworkerName.trim() || template.name,
      detail: `${template.name} template · ${styleOf(state.style)}`,
    },
    {
      label: 'First collaboration',
      value: collabDone && outline ? outline.output : 'Not started',
      detail: collabDone && outline ? state.kept ? `Retained in ${state.workspaceName.trim() || 'the workspace'}` : 'Preview only' : 'Simulated conversation available',
    },
  ];
}
