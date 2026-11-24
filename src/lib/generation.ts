/**
 * C2-3 生成-校验回路 (Coworker plan §27): generator proposes, verifier checks
 * against a **rubric of specific checks** (research: "every figure cited", not
 * "is this good?"), loop hard-capped. Empirical anchors (tech-research §1):
 * cap at 2–3 rounds, malformed verdicts fail conservatively.
 *
 * Pure contract + prompts + parsing — the orchestration lives in
 * `src/services/generation/loop.ts`, injectable for tests.
 */

export const MAX_GENERATION_ROUNDS = 3;

/** Specific, checkable checks. One string per check. */
export type GenerationRubric = string[];

export type VerifyVerdict = 'pass' | 'fail';

export type GenerationRound = {
  round: number;
  output: string;
  verdict: VerifyVerdict;
  misses: string[];
};

export type GenerationResult = {
  output: string;
  rounds: GenerationRound[];
  /** True when the loop stopped at the cap without a pass. */
  capped: boolean;
};

export function generationPrompt(task: string, rubric: GenerationRubric, misses: string[]): string {
  const checks = rubric.map((check, i) => `${i + 1}. ${check}`).join('\n');
  const previous =
    misses.length === 0
      ? ''
      : `\n上一轮未满足的检查（必须修复）：\n${misses.map((m) => `- ${m}`).join('\n')}`;
  return (
    `你是执行任务的 Coworker。产出要满足全部检查。\n任务：${task}\n` +
    `检查清单：\n${checks}${previous}\n只输出产出本身，不要解释。`
  );
}

export function verificationPrompt(task: string, rubric: GenerationRubric, output: string): string {
  const checks = rubric.map((check, i) => `${i + 1}. ${check}`).join('\n');
  return (
    `逐条核对产出是否满足检查清单。只输出 JSON：` +
    `{"verdict":"pass"|"fail","misses":["未满足的检查，写检查原文"]}。\n` +
    `任务：${task}\n检查清单：\n${checks}\n产出：\n${output}`
  );
}

export type ParsedVerdict = { verdict: VerifyVerdict; misses: string[] };

/**
 * Conservative parse: anything malformed is a `fail` naming itself —
 * an unverifiable round must not count as a pass.
 */
export function parseVerdict(text: string): ParsedVerdict {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return { verdict: 'fail', misses: ['verdict 不是可解析的 JSON'] };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      verdict?: unknown;
      misses?: unknown;
    };
    const misses = Array.isArray(parsed.misses)
      ? parsed.misses.filter((m): m is string => typeof m === 'string')
      : [];
    if (parsed.verdict === 'pass') return { verdict: 'pass', misses };
    return {
      verdict: 'fail',
      misses: misses.length > 0 ? misses : ['verdict 为 fail 但未列出 misses'],
    };
  } catch {
    return { verdict: 'fail', misses: ['verdict 不是可解析的 JSON'] };
  }
}
