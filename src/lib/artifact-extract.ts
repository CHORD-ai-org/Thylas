/**
 * Local artifact-candidate extraction (roadmap P0-6).
 *
 * Turns selected source text into artifact-shaped candidates, each with a
 * citable evidence span. This is a deterministic, offline extractor — the
 * production path is the model-backed `server/profile/extract.ts` pipeline;
 * this proves the *shape* of Source → Evidence → Candidate without a network
 * and without pretending a model reasoned. Every candidate is a **candidate**,
 * never a canonical artifact (home-interaction 04 §3).
 */

/** The kinds this offline extractor can assign — a subset of the artifact
    taxonomy (`data/artifacts.ts`), kept local so `lib/` stays pure. */
export type ExtractKind = 'concept' | 'methodology' | 'structural' | 'executable' | 'empirical';

export type Evidence = {
  /** The source object the span came from. */
  sourceId: string;
  sourceName: string;
  /** The verbatim span, findable in the source. */
  span: string;
};

export type ExtractedCandidate = {
  id: string;
  kind: ExtractKind;
  name: string;
  content: string;
  evidence: Evidence[];
  /** explicit = stated in the source; inferred = derived by the extractor. */
  informationType: 'explicit' | 'inferred';
  confidence: number;
};

export type ExtractSource = { id: string; name: string; body: string };

const KIND_BY_HINT: { re: RegExp; kind: ExtractKind }[] = [
  { re: /\b(method|protocol|procedure|steps?|how to)\b/i, kind: 'methodology' },
  { re: /\b(result|measur|benchmark|experiment|data point|found that)\b/i, kind: 'empirical' },
  { re: /\b(roadmap|plan|spec|architecture|structure|model)\b/i, kind: 'structural' },
  { re: /\b(tool|script|prototype|app|code|build)\b/i, kind: 'executable' },
];

function kindOf(span: string): ExtractKind {
  for (const { re, kind } of KIND_BY_HINT) if (re.test(span)) return kind;
  return 'concept';
}

/** A sentence-ish span that names a thing: contains a capitalized term or a
    "X is/means/defines" construction. Bounded so evidence stays citable. */
function candidateSpans(body: string): string[] {
  return body
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24 && s.length <= 240)
    .filter((s) => /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\b/.test(s) || /\b(is|means|defines|refers to)\b/.test(s))
    .slice(0, 12);
}

/** The candidate name: the leading capitalized phrase, else the first words. */
function nameOf(span: string): string {
  const proper = span.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\b/);
  const raw = proper ? proper[0] : span.split(/\s+/).slice(0, 5).join(' ');
  return raw.replace(/[.,;:!?]+$/, '').slice(0, 60) || 'Untitled';
}

let seq = 0;
const nextId = () => `ac-${Date.now().toString(36)}-${(seq += 1).toString(36)}`;

export function extractCandidates(sources: ExtractSource[]): ExtractedCandidate[] {
  const out: ExtractedCandidate[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const span of candidateSpans(source.body)) {
      const name = nameOf(span);
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: nextId(),
        kind: kindOf(span),
        name,
        content: span,
        evidence: [{ sourceId: source.id, sourceName: source.name, span }],
        informationType: /\b(is|means|defines|refers to)\b/.test(span) ? 'explicit' : 'inferred',
        confidence: Math.min(0.95, 0.5 + span.length / 480),
      });
    }
  }
  return out;
}
