/**
 * C4-2 本地协调器 (Coworker plan §27): a hub-and-spoke runner for ONE
 * collaboration session. The coordinator sits in the middle; Coworkers never
 * talk to each other directly (§17). This is a fixed script, not a general
 * engine — no recursive spawning, no open-ended agent chat (§19).
 *
 * Script: delegate A → A generates (C2-3 loop) → respond → handoff (C3
 * package) → B generates → respond → complete.
 *
 * Budget is enforced here, by the coordinator — never by the model (§17):
 * generation rounds count against `maxSteps`, wall-clock against
 * `maxSeconds`; touching either flips the session to needs_human with a
 * reason (INPUT_REQUIRED). Every step has already been journaled by the
 * C4-1b transition API before the state commits.
 */
import {
  type CollaborationState,
} from '../../lib/collaboration';
import type { CollaborationSessionDto, ProjectCandidateDto } from '../../lib/projects';
import type { GenerationRubric } from '../../lib/generation';
import { createProjectsClient, type ProjectsClient } from '../projects/client';
import { createCoworkersClient, type CoworkersClient } from '../coworkers/client';
import { runGenerationLoop, type AskFn } from '../generation/loop';

export type CollaborationRunOptions = {
  projectId: string;
  sessionId: string;
  task: string;
  rubric: GenerationRubric;
  askFn?: AskFn;
  projects?: ProjectsClient;
  coworkers?: CoworkersClient;
  /** Injectable clock so the seconds budget is testable. */
  now?: () => number;
};

export type CollaborationRunResult = {
  state: CollaborationState;
  usedSteps: number;
  roundsA: number;
  roundsB: number;
  handoffId?: string;
  candidateA?: string;
  candidateB?: string;
  stoppedReason?: string;
};

const PHASE_ROUNDS = 3;

export async function runCollaborationSession(
  options: CollaborationRunOptions,
): Promise<CollaborationRunResult> {
  const projects = options.projects ?? createProjectsClient();
  const coworkers = options.coworkers ?? createCoworkersClient();
  const now = options.now ?? Date.now;

  const sessionBody = await projects.getSession(options.projectId, options.sessionId);
  if (!sessionBody.ok) {
    return { state: 'proposed', usedSteps: 0, roundsA: 0, roundsB: 0, stoppedReason: '场次读不到' };
  }
  const session: CollaborationSessionDto = sessionBody.item;
  if (session.state !== 'proposed') {
    return {
      state: session.state,
      usedSteps: session.currentStep,
      roundsA: 0,
      roundsB: 0,
      stoppedReason: `场次已是 ${session.state}，不重新开局`,
    };
  }
  const { a, b } = session.participants;
  if (!b) {
    return {
      state: session.state,
      usedSteps: 0,
      roundsA: 0,
      roundsB: 0,
      stoppedReason: '协作需要两名参与者',
    };
  }

  const budget = session.budget;
  const startedAt = now();
  let usedSteps = 0;

  const overBudget = (): boolean =>
    usedSteps >= budget.maxSteps || now() - startedAt >= budget.maxSeconds * 1000;

  const toHuman = async (reason: string, roundsA: number, roundsB: number) => {
    await projects.transitionSession(options.projectId, options.sessionId, {
      verb: 'request_human',
      actorId: a.coworkerId,
      note: reason,
    });
    return {
      state: 'needs_human' as CollaborationState,
      usedSteps,
      roundsA,
      roundsB,
      stoppedReason: reason,
    };
  };

  await projects.transitionSession(options.projectId, options.sessionId, {
    verb: 'delegate',
    actorId: a.coworkerId,
    note: `派给 ${a.name}`,
  });

  /* Phase A — the loop journals its own rounds and lands a signed candidate.
     A throwing askFn (断网) must not kill the session: it flips to
     needs_human and stays recoverable. */
  let phaseA;
  try {
    phaseA = await runGenerationLoop({
      coworkerId: a.coworkerId,
      coworkerName: a.name,
      projectId: options.projectId,
      task: options.task,
      rubric: options.rubric,
      maxRounds: Math.max(1, Math.min(PHASE_ROUNDS, budget.maxSteps - usedSteps)),
      askFn: options.askFn,
      projects,
      coworkers,
    });
  } catch {
    return toHuman('生成中断——AI 不可达，场次停在原地可恢复', 0, 0);
  }
  usedSteps += phaseA.rounds.length;
  const roundsA = phaseA.rounds.length;
  if (overBudget()) return toHuman('预算触顶，产出停在 A', roundsA, 0);

  await projects.transitionSession(options.projectId, options.sessionId, {
    verb: 'respond',
    actorId: a.coworkerId,
    note: 'A 交付',
  });

  /* The handoff is atomic (C3): a failure here means nothing transferred. */
  const handoff = await projects.createHandoff(options.projectId, {
    fromCoworkerId: a.coworkerId,
    fromName: a.name,
    toCoworkerId: b.coworkerId,
    toName: b.name,
    task: options.task,
    inputs: phaseA.candidate ? [phaseA.candidate.id] : [],
    done: phaseA.output.slice(0, 2000),
    nextStep: '接手 A 的产出继续',
    maxSteps: budget.maxSteps,
  });
  if (!handoff.ok) return toHuman('交接失败——什么都没转移', roundsA, 0);
  await projects.transitionSession(options.projectId, options.sessionId, {
    verb: 'handoff',
    actorId: a.coworkerId,
    note: `交接给 ${b.name}`,
  });

  /* Phase B */
  let phaseB;
  try {
    phaseB = await runGenerationLoop({
      coworkerId: b.coworkerId,
      coworkerName: b.name,
      projectId: options.projectId,
      task: `${options.task}\n接手说明：${handoff.item.task}；A 的产出引用：${handoff.item.inputs.join('、') || '无'}`,
      rubric: options.rubric,
      maxRounds: Math.max(1, Math.min(PHASE_ROUNDS, budget.maxSteps - usedSteps)),
      askFn: options.askFn,
      projects,
      coworkers,
    });
  } catch {
    return toHuman('生成中断——AI 不可达，场次停在交接后可恢复', roundsA, 0);
  }
  usedSteps += phaseB.rounds.length;
  const roundsB = phaseB.rounds.length;
  if (overBudget()) return toHuman('预算触顶，产出停在 B', roundsA, roundsB);

  await projects.transitionSession(options.projectId, options.sessionId, {
    verb: 'respond',
    actorId: b.coworkerId,
    note: 'B 交付',
  });
  await projects.transitionSession(options.projectId, options.sessionId, {
    verb: 'complete',
    actorId: b.coworkerId,
    note: '双人协作完成',
  });

  return {
    state: 'completed',
    usedSteps,
    roundsA,
    roundsB,
    handoffId: handoff.item.id,
    ...(phaseA.candidate ? { candidateA: phaseA.candidate.id } : {}),
    ...(phaseB.candidate ? { candidateB: phaseB.candidate.id } : {}),
  };
}

export type { ProjectCandidateDto };
