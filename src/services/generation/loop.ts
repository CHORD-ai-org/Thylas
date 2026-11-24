/**
 * C2-3 orchestration: the generate→verify loop with a hard round cap. Every
 * round lands in the Coworker's append-only trace (build the trace before the
 * second Coworker); the final output lands as a **project candidate with a
 * signature** — the human review (确认/驳回) closes the loop.
 *
 * Dependencies are injectable so tests script the AI and assert the cap.
 */
import {
  MAX_GENERATION_ROUNDS,
  generationPrompt,
  parseVerdict,
  verificationPrompt,
  type GenerationResult,
  type GenerationRound,
  type GenerationRubric,
} from '../../lib/generation';
import type { ProjectCandidateDto } from '../../lib/projects';
import { createProjectsClient, type ProjectsClient } from '../projects/client';
import { createCoworkersClient, type CoworkersClient } from '../coworkers/client';
import { ask } from '../ai/client';

export type AskFn = (prompt: string) => Promise<{ ok: true; text: string } | { ok: false }>;

const defaultAsk: AskFn = async (prompt) => {
  const result = await ask(prompt);
  return result.ok ? { ok: true, text: result.answer.text } : { ok: false };
};

export type GenerationLoopOptions = {
  coworkerId: string;
  coworkerName: string;
  projectId: string;
  task: string;
  rubric: GenerationRubric;
  maxRounds?: number;
  askFn?: AskFn;
  projects?: ProjectsClient;
  coworkers?: CoworkersClient;
};

export type GenerationLoopResult = GenerationResult & {
  candidate?: ProjectCandidateDto;
};

export async function runGenerationLoop(
  options: GenerationLoopOptions,
): Promise<GenerationLoopResult> {
  const maxRounds = options.maxRounds ?? MAX_GENERATION_ROUNDS;
  const askFn = options.askFn ?? defaultAsk;
  const projects = options.projects ?? createProjectsClient();
  const coworkers = options.coworkers ?? createCoworkersClient();

  const rounds: GenerationRound[] = [];
  let misses: string[] = [];
  let output = '';

  for (let round = 1; round <= maxRounds; round += 1) {
    const generated = await askFn(generationPrompt(options.task, options.rubric, misses));
    if (!generated.ok) break;
    output = generated.text;

    const verified = await askFn(verificationPrompt(options.task, options.rubric, output));
    /* A failed verification request is not a pass. */
    const parsed = verified.ok
      ? parseVerdict(verified.text)
      : { verdict: 'fail' as const, misses: ['校验未能完成'] };
    rounds.push({ round, output, verdict: parsed.verdict, misses: parsed.misses });
    misses = parsed.misses;

    void coworkers
      .createEvent(options.coworkerId, {
        verb: 'generation_round',
        projectId: options.projectId,
        actorKind: 'coworker',
        payload: { round, verdict: parsed.verdict, misses: parsed.misses },
      })
      .catch(() => undefined);

    if (parsed.verdict === 'pass') break;
    /* Fail on the last allowed round: the cap ends the loop, not another try. */
    if (round === maxRounds) break;
  }

  const last = rounds[rounds.length - 1];
  const capped = rounds.length >= maxRounds && last?.verdict === 'fail';

  let candidate: ProjectCandidateDto | undefined;
  if (output.trim() !== '') {
    const title = options.task.trim().split('\n')[0]?.slice(0, 80) || '产出';
    const created = await projects.createCandidate(options.projectId, {
      title,
      body: output,
      proposedBy: options.coworkerId,
      proposedByName: options.coworkerName,
    });
    if (created.ok) {
      candidate = created.item;
      void coworkers
        .createEvent(options.coworkerId, {
          verb: 'generation_completed',
          projectId: options.projectId,
          actorKind: 'coworker',
          payload: { rounds: rounds.length, capped, candidateId: created.item.id },
        })
        .catch(() => undefined);
    }
  }

  return {
    output,
    rounds,
    capped,
    ...(candidate ? { candidate } : {}),
  };
}
