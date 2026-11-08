/**
 * Time as a reader says it, not as a clock does. Deterministic for tests: `now`
 * is a parameter, and the locale is pinned so a machine set to another language
 * cannot change the output.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(at: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 2 * DAY) return 'yesterday';
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
