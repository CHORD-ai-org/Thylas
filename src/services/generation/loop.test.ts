import { describe, expect, it } from 'vitest';
import { parseVerdict, generationPrompt, verificationPrompt } from '../../lib/generation';
import { runGenerationLoop, type AskFn } from './loop';
import type { ProjectCandidateDto } from '../../lib/projects';

const RUBRIC = ['每个数字有来源', '不超出材料范围', '结论一句话'];

function fakeClients() {
  const events: { verb: string; payload: unknown }[] = [];
  const created: { body: unknown }[] = [];
  return {
    events,
    created,
    coworkers: {
      createEvent: async (_id: string, body: { verb: string; payload?: unknown }) => {
        events.push({ verb: body.verb, payload: body.payload });
        return { ok: true as const, item: {} };
      },
    },
    projects: {
      createCandidate: async (_projectId: string, body: unknown) => {
        created.push({ body });
        return {
          ok: true as const,
          item: {
            id: 'cand-1',
            projectId: 'p-1',
            title: '产出',
            body: '',
            proposedBy: 'cw-1',
            proposedByName: 'Mira',
            status: 'proposed',
            confirmedBy: null,
            createdAt: '2026-11-24T00:00:00.000Z',
            updatedAt: '2026-11-24T00:00:00.000Z',
          } satisfies ProjectCandidateDto,
        };
      },
    },
  };
}

describe('C2-3 生成-校验回路', () => {
  it('C2 gate: verifier-always-fails stops at the round cap, never more', async () => {
    const calls: string[] = [];
    const askFn: AskFn = async (prompt) => {
      calls.push(prompt);
      return prompt.startsWith('逐条核对')
        ? { ok: true, text: '{"verdict":"fail","misses":["每个数字有来源"]}' }
        : { ok: true, text: 'draft output' };
    };
    const fake = fakeClients();
    const result = await runGenerationLoop({
      coworkerId: 'cw-1',
      coworkerName: 'Mira',
      projectId: 'p-1',
      task: '写对比表',
      rubric: RUBRIC,
      askFn,
      projects: fake.projects as never,
      coworkers: fake.coworkers as never,
    });

    expect(result.rounds).toHaveLength(3);
    expect(result.capped).toBe(true);
    expect(calls).toHaveLength(6); // 2 calls per round — the cap is real
    expect(result.rounds.every((r) => r.verdict === 'fail')).toBe(true);
    expect(result.candidate?.proposedByName).toBe('Mira');
  });

  it('passes early: stops after the passing round', async () => {
    let round = 0;
    const askFn: AskFn = async (prompt) => {
      if (prompt.startsWith('逐条核对')) {
        return {
          ok: true,
          text: round === 1 ? '{"verdict":"fail","misses":["结论一句话"]}' : '{"verdict":"pass","misses":[]}',
        };
      }
      round += 1;
      return { ok: true, text: `draft ${round}` };
    };
    const fake = fakeClients();
    const result = await runGenerationLoop({
      coworkerId: 'cw-1',
      coworkerName: 'Mira',
      projectId: 'p-1',
      task: '写对比表',
      rubric: RUBRIC,
      askFn,
      projects: fake.projects as never,
      coworkers: fake.coworkers as never,
    });
    expect(result.rounds).toHaveLength(2);
    expect(result.capped).toBe(false);
    expect(result.rounds[1]?.verdict).toBe('pass');
  });

  it('malformed verdict fails conservatively and still hits the cap', async () => {
    const askFn: AskFn = async (prompt) =>
      prompt.startsWith('逐条核对')
        ? { ok: true, text: 'looks fine to me' }
        : { ok: true, text: 'draft' };
    const fake = fakeClients();
    const result = await runGenerationLoop({
      coworkerId: 'cw-1',
      coworkerName: 'Mira',
      projectId: 'p-1',
      task: '写对比表',
      rubric: RUBRIC,
      askFn,
      projects: fake.projects as never,
      coworkers: fake.coworkers as never,
    });
    expect(result.rounds).toHaveLength(3);
    expect(result.rounds[0]?.misses[0]).toContain('JSON');
    expect(result.capped).toBe(true);
  });

  it('every round lands in the trace; prompts carry the previous misses', async () => {
    const prompts: string[] = [];
    const askFn: AskFn = async (prompt) => {
      prompts.push(prompt);
      return prompt.startsWith('逐条核对')
        ? { ok: true, text: '{"verdict":"fail","misses":["每个数字有来源"]}' }
        : { ok: true, text: 'draft' };
    };
    const fake = fakeClients();
    await runGenerationLoop({
      coworkerId: 'cw-1',
      coworkerName: 'Mira',
      projectId: 'p-1',
      task: '写对比表',
      rubric: RUBRIC,
      askFn,
      projects: fake.projects as never,
      coworkers: fake.coworkers as never,
    });
    expect(fake.events.filter((e) => e.verb === 'generation_round')).toHaveLength(3);
    expect(fake.events.some((e) => e.verb === 'generation_completed')).toBe(true);
    expect(prompts[2]).toContain('上一轮未满足的检查');
    expect(prompts[2]).toContain('每个数字有来源');
  });

  it('prompt builders and verdict parsing are strict and pure', () => {
    expect(generationPrompt('t', RUBRIC, [])).toContain('1. 每个数字有来源');
    expect(verificationPrompt('t', RUBRIC, 'out')).toContain('"verdict":"pass"|"fail"');
    expect(parseVerdict('{"verdict":"pass","misses":[]}')).toEqual({ verdict: 'pass', misses: [] });
    expect(parseVerdict('nonsense').verdict).toBe('fail');
    expect(parseVerdict('{"verdict":"fail"}').misses.length).toBeGreaterThan(0);
    expect(parseVerdict('prefix {"verdict":"pass"} suffix').verdict).toBe('pass');
  });
});
