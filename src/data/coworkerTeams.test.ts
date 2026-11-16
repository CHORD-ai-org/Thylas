import { describe, expect, it } from 'vitest';
import { COWORKER_TEAMS, teamRoles } from './coworkerTeams';

describe('illustrative coworker teams', () => {
  it('uses the six proposed names once each', () => {
    expect(COWORKER_TEAMS.map((team) => team.name)).toEqual([
      'MÍMIR',
      'ODIN',
      'YGGDRASIL',
      'BIFRÖST',
      'LOKI',
      'SVARTÁLFHEIM',
    ]);
    expect(new Set(COWORKER_TEAMS.map((team) => team.id)).size).toBe(6);
  });

  it('gives every team an identity, a purpose and a real composition', () => {
    for (const team of COWORKER_TEAMS) {
      expect(team.subtitle.length).toBeGreaterThan(8);
      expect(team.archetype.startsWith('The ')).toBe(true);
      expect(team.philosophy.length).toBeGreaterThan(20);
      expect(team.purpose.length).toBeGreaterThan(20);
      expect(team.members.length).toBeGreaterThanOrEqual(3);
      for (const member of team.members) {
        expect(member.role.length).toBeGreaterThan(2);
        expect(member.name.length).toBeGreaterThan(1);
        expect(member.contributes.length).toBeGreaterThan(15);
      }
    }
  });

  it('derives a role distribution from the members', () => {
    expect(teamRoles(COWORKER_TEAMS[0]!)).toEqual(['Researcher', 'Critic', 'Synthesizer']);
  });
});
