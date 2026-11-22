/**
 * Invocation core — pure functions behind the `@` / `/` composer trigger.
 *
 * Scope (roadmap T0.1): token detection, ranking, and a mapping to the one
 * binding shape that already exists (`ContextSource`, `lib/chat.ts`). No DOM, no
 * network, no state. The composer and palette layer on top of these in T0.2.
 *
 * Distinguishes (see docs/home-interaction/02): Object Invocation (reference an
 * existing object) from Action Invocation (request an operation). `@` is object,
 * `/` is action; this module only recognises the trigger — it never executes.
 *
 * Deliberate rule: an invocation query is a single token (stops at whitespace or
 * newline). This keeps trigger detection unambiguous — it cannot mistake an
 * e-mail (`user@host`) or a path (`a/b`) for a trigger, and cannot leave a stale
 * palette open after the user moves on. Multi-word search is a palette affordance
 * layered over `rank`, not a wider token.
 */
import type { ContextSource } from './chat';

export type InvokeTrigger = '@' | '/';

export type InvokeGroup = 'coworker' | 'workspace' | 'artifact' | 'resource' | 'gsc' | 'action';

export type InvokeItem = {
  id: string;
  group: InvokeGroup;
  /** Finer label within the group: 'note' | 'file' | 'board' | 'process' | 'concept' | … */
  kind: string;
  label: string;
  detail?: string;
  /** Workspace id, or 'personal'. Used to prefer same-scope objects. */
  scope: string;
};

export type InvokeToken = {
  trigger: InvokeTrigger;
  /** Index of the trigger character in the source text. */
  start: number;
  query: string;
};

export type InvokeQuery = {
  token: string;
  group: 'all' | InvokeGroup;
  scope: string;
};

/** Group → priority, used only as a final tie-break (higher wins). */
const GROUP_PRIORITY: Record<InvokeGroup, number> = {
  coworker: 5,
  artifact: 4,
  resource: 3,
  workspace: 2,
  gsc: 1,
  action: 0,
};

const isTokenChar = (c: string): boolean => !/\s/.test(c);

/**
 * Detect an active invocation token at the caret.
 *
 * Returns null when the caret is not inside a trigger-led token: no token, a
 * token that does not begin with `@`/`/`, or a mid-word `@`/`/` (e-mail, path).
 */
export function parseInvokeToken(text: string, caret: number): InvokeToken | null {
  if (caret < 0 || caret > text.length) return null;
  let start = caret;
  while (start > 0 && isTokenChar(text[start - 1]!)) start -= 1;
  if (start === caret) return null;
  const trigger = text[start];
  if (trigger !== '@' && trigger !== '/') return null;
  return { trigger, start, query: text.slice(start + 1, caret) };
}

/**
 * Match tier: how well an item matches the query (0 = no match).
 * Higher is better; case-insensitive.
 */
function matchTier(item: InvokeItem, token: string): number {
  if (token === '') return 1; // empty query lists everything as a weak match
  const q = token.toLowerCase();
  const label = item.label.toLowerCase();
  if (label === q) return 5;
  if (label.startsWith(q)) return 4;
  if (label.includes(q)) return 3;
  if (item.detail && item.detail.toLowerCase().includes(q)) return 2;
  return 0;
}

/**
 * Filter by group + query, then order. Interpretation of the ranking intent:
 * with a query, match quality leads (exact > prefix > contains) and recency
 * breaks ties; with an empty query, recency leads. Same-scope and group
 * priority are later tie-breaks, then label — always deterministic.
 */
export function rank(items: readonly InvokeItem[], q: InvokeQuery, usage: readonly string[] = []): InvokeItem[] {
  const recent = new Map<string, number>();
  usage.forEach((id, i) => recent.set(id, i)); // lower index = more recent

  const recency = (id: string): number => recent.get(id) ?? Number.MAX_SAFE_INTEGER;

  const matched = items.filter((item) => {
    if (q.group !== 'all' && item.group !== q.group) return false;
    return matchTier(item, q.token) > 0;
  });

  const tier = (item: InvokeItem): number => (q.token === '' ? 0 : matchTier(item, q.token));
  const sameScope = (item: InvokeItem): number => (item.scope === q.scope ? 1 : 0);

  return [...matched].sort((a, b) => {
    if (q.token !== '') {
      const dTier = tier(b) - tier(a);
      if (dTier !== 0) return dTier;
    }
    const dRecency = recency(a.id) - recency(b.id);
    if (dRecency !== 0) return dRecency;
    const dScope = sameScope(b) - sameScope(a);
    if (dScope !== 0) return dScope;
    const dGroup = GROUP_PRIORITY[b.group] - GROUP_PRIORITY[a.group];
    if (dGroup !== 0) return dGroup;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Map an invoked object to the one binding shape that exists today.
 *
 * Returns null where `ContextSource` has no kind yet (coworker, gsc, action,
 * process). Binding those needs the contract extension in roadmap T0.3 — this
 * returns null rather than mislabelling them as `integration`.
 */
export function toContextSource(item: InvokeItem): ContextSource | null {
  if (item.group === 'workspace') {
    return { id: item.id, kind: 'workspace', name: item.label, ...(item.detail ? { detail: item.detail } : {}) };
  }
  if (item.group === 'resource' && (item.kind === 'file' || item.kind === 'note' || item.kind === 'board')) {
    return { id: item.id, kind: item.kind, name: item.label, ...(item.detail ? { detail: item.detail } : {}) };
  }
  return null;
}
