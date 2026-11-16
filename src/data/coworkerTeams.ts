/**
 * Illustrative preset teams for the Team perspective.
 *
 * Read-only mock data, local to the UI. Names follow the proposed Norse
 * convention in docs/product/coworkers/TEAM-NAMING-CONVENTION.md; the
 * identities, purposes and compositions below are prototype examples, not
 * confirmed team definitions. No store, API, orchestration or runtime exists.
 */
export type TeamMember = {
  role: string;
  name: string;
  contributes: string;
};

export type CoworkerTeam = {
  id: string;
  name: string;
  subtitle: string;
  archetype: string;
  philosophy: string;
  purpose: string;
  members: TeamMember[];
};

export const COWORKER_TEAMS: CoworkerTeam[] = [
  {
    id: 'team-mimir',
    name: 'MÍMIR',
    subtitle: 'Polymath Research Collective',
    archetype: 'The Keeper of Wisdom',
    philosophy: 'Hold the question open long enough for the evidence to answer.',
    purpose: 'Turn a broad question into a record others can check and extend.',
    members: [
      { role: 'Researcher', name: 'Mira', contributes: 'Finds sources and separates claim from evidence.' },
      { role: 'Critic', name: 'Völva', contributes: 'Names what the current framing cannot explain.' },
      { role: 'Synthesizer', name: 'Saga', contributes: 'Connects findings without flattening their differences.' },
    ],
  },
  {
    id: 'team-odin',
    name: 'ODIN',
    subtitle: 'Sovereign Strategy Council',
    archetype: 'The Sovereign Intellect',
    philosophy: 'Choose the few moves that change the board.',
    purpose: 'Make a decision explicit, with its assumptions and its costs.',
    members: [
      { role: 'Visionary', name: 'Hugin', contributes: 'Sets the direction worth arguing about.' },
      { role: 'Analyst', name: 'Munin', contributes: 'States the measures and the missing data.' },
      { role: 'Critic', name: 'Rata', contributes: 'Tests the decision against its own premises.' },
    ],
  },
  {
    id: 'team-yggdrasil',
    name: 'YGGDRASIL',
    subtitle: 'Systems Architecture Guild',
    archetype: 'The Interconnected Worlds',
    philosophy: 'Every boundary is a place where meaning crosses.',
    purpose: 'Draw the parts, the seams and the decisions those seams force.',
    members: [
      { role: 'Architect', name: 'Ygg', contributes: 'Names components and what each one owns.' },
      { role: 'Critic', name: 'Ratatösk', contributes: 'Finds the dependency nobody declared.' },
      { role: 'Builder', name: 'Verdandi', contributes: 'Keeps the draft buildable as it changes.' },
    ],
  },
  {
    id: 'team-bifrost',
    name: 'BIFRÖST',
    subtitle: 'Integration Studio',
    archetype: 'The Bridge Between Worlds',
    philosophy: 'Make the passage between systems legible.',
    purpose: 'Give every handoff a named input, output and owner.',
    members: [
      { role: 'Builder', name: 'Heimdal', contributes: 'Builds the crossing and records its contract.' },
      { role: 'Researcher', name: 'Iris', contributes: 'Checks what each side actually assumes.' },
      { role: 'Critic', name: 'Gjallar', contributes: 'Sounds the alarm when the contract drifts.' },
    ],
  },
  {
    id: 'team-loki',
    name: 'LOKI',
    subtitle: 'Adversarial Design Cell',
    archetype: 'The Disruptive Mind',
    philosophy: 'Find the flaw while it is still cheap.',
    purpose: 'Produce the strongest objection before the work hardens.',
    members: [
      { role: 'Critic', name: 'Loki', contributes: 'Writes the strongest available counterexample.' },
      { role: 'Researcher', name: 'Nari', contributes: 'Checks whether the objection has evidence.' },
      { role: 'Visionary', name: 'Hel', contributes: 'Reframes the problem after the objection lands.' },
    ],
  },
  {
    id: 'team-svartalfheim',
    name: 'SVARTÁLFHEIM',
    subtitle: 'Forge of Creation',
    archetype: 'The Forge of Creation',
    philosophy: 'Build the thing, then name its seams.',
    purpose: 'Turn an intent into ordered steps, constraints and a first artefact.',
    members: [
      { role: 'Builder', name: 'Brokkr', contributes: 'Takes the smallest verifiable step first.' },
      { role: 'Architect', name: 'Sindri', contributes: 'Keeps the structure coherent while it grows.' },
      { role: 'Critic', name: 'Eitri', contributes: 'States what is not done yet, plainly.' },
    ],
  },
];

/** Role distribution shown on a team card without opening its composition. */
export function teamRoles(team: CoworkerTeam): string[] {
  return [...new Set(team.members.map((member) => member.role))];
}
