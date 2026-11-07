/* Scroll offsets for list surfaces, keyed by path + a named region.
   In-memory first, sessionStorage as the durable copy so a reload still
   restores. Offsets are small integers; writing one on scroll is cheaper than
   a debounce that can lose the last frame when the page navigates away. */

const KEY = 'thylas:scroll:v2';
type ScrollMap = Record<string, number>;

let cache: ScrollMap | undefined;
let warned = false;

function read(): ScrollMap {
  if (cache) return cache;
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ScrollMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function key(path: string, region: string): string {
  return `${path}#${region}`;
}

export function saveScroll(path: string, region: string, y: number): void {
  const map = read();
  const k = key(path, region);
  if (map[k] === y) return;
  map[k] = y;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    if (!warned) {
      warned = true;
      console.warn('[thylas] Scroll offsets are in-memory only for this tab.');
    }
  }
}

export function readScroll(path: string, region: string): number {
  const y = read()[key(path, region)];
  return typeof y === 'number' && Number.isFinite(y) && y > 0 ? y : 0;
}
