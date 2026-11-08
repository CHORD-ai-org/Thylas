/**
 * `[[Target]]` and `[[Target|alias]]`.
 *
 * Resolution is by title at render time, never by id at write time. That is the
 * decision that makes renaming free: a note changes its title, and every link
 * that named the old title is now dangling — visible, not silently rerouted.
 */

export type LinkMatch = {
  target: string;
  alias: string | null;
  /** Byte offset in the source, so an editor can replace the token. */
  start: number;
  end: number;
  raw: string;
};

export type ResolvedLink = LinkMatch & {
  /** null when the target names no note in this scope: a dangling link. */
  id: string | null;
};

/* Split on the first `|` only: `[[A|B|C]]` has the alias `B|C`, because a
   person who clicks it expects the text they typed, not a parse error. */
const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Offsets of fenced code, so `[[x]]` inside a code sample stays literal. Without
 * this the backlink index would claim links that a reader never sees.
 */
function fencedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let open = -1;
  const fence = /^```/gm;
  let match: RegExpExecArray | null = fence.exec(text);
  while (match !== null) {
    if (open < 0) {
      open = match.index;
    } else {
      ranges.push([open, match.index + 3]);
      open = -1;
    }
    match = fence.exec(text);
  }
  if (open >= 0) ranges.push([open, text.length]);
  return ranges;
}

function inside(ranges: Array<[number, number]>, at: number): boolean {
  return ranges.some(([from, to]) => at >= from && at < to);
}

export function parseLinks(markdown: string): LinkMatch[] {
  const ranges = fencedRanges(markdown);
  const out: LinkMatch[] = [];
  LINK.lastIndex = 0;
  let match: RegExpExecArray | null = LINK.exec(markdown);
  while (match !== null) {
    if (!inside(ranges, match.index)) {
      const target = (match[1] ?? '').trim();
      /* `[[]]` and `[[   ]]` are not links; the regex allows one non-space
         character, this rejects a target that is only spaces. */
      if (target !== '') {
        out.push({
          target,
          alias: match[2] === undefined ? null : match[2].trim(),
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
        });
      }
    }
    match = LINK.exec(markdown);
  }
  return out;
}

/**
 * @param titles lowercase title → note id, already restricted to the scope the
 *   body belongs to. Building that map is the caller's job because scope rules
 *   are the domain's, not the parser's.
 */
export function resolveLinks(markdown: string, titles: Map<string, string>): ResolvedLink[] {
  return parseLinks(markdown).map((link) => ({
    ...link,
    id: titles.get(link.target.trim().toLowerCase()) ?? null,
  }));
}
