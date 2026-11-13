/// <reference types="node" />
/**
 * Public-page retrieval for the Profile pipeline. The page is untrusted data:
 * no scripts run, no private network addresses are reachable, redirects are
 * re-validated hop by hop, and the response is bounded in time and size.
 */
import { lookup } from 'node:dns/promises';
import { isPublicUrl, type ProfileFailure } from '../../src/lib/profile.ts';

const MAX_BYTES = 512 * 1024;
const MAX_TEXT = 12_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

export type FetchedPage = {
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  retrievedAt: string;
};

export type PageFetcher = (url: string, init: { signal: AbortSignal }) => Promise<Response>;
export type AddressLookup = (hostname: string) => Promise<string[]>;

type Deps = {
  fetcher: PageFetcher;
  lookupAddresses: AddressLookup;
};

const defaultDeps: Deps = {
  fetcher: (url, init) => fetch(url, { ...init, redirect: 'manual', headers: { 'user-agent': 'Thylas-Profile/0.1 (+public sources only)' } }),
  lookupAddresses: async (hostname) => {
    const answers = await lookup(hostname, { all: true });
    return answers.map((a) => a.address);
  },
};

/** IPv4 private/loopback/link-local/reserved + IPv6 equivalents. */
export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase();
  if (a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80:')) return true;
  if (a.startsWith('::ffff:')) return isPrivateAddress(a.slice(7));
  const parts = a.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [x, y] = parts;
  if (x === undefined || y === undefined) return false;
  if (x === 0 || x === 10 || x === 127) return true;
  if (x === 169 && y === 254) return true; /* includes 169.254.169.254 metadata */
  if (x === 172 && y !== undefined && y >= 16 && y <= 31) return true;
  if (x === 192 && y === 168) return true;
  if (x === 100 && y !== undefined && y >= 64 && y <= 127) return true;
  if (x >= 224) return true;
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return (
    h === 'localhost' ||
    h === 'localhost.localdomain' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === 'metadata.google.internal' ||
    h === 'metadata'
  );
}

/** Resolves DNS so a public-looking name cannot redirect us into a private IP. */
export async function assertPublicTarget(raw: string, deps: Deps): Promise<{ ok: true; url: URL } | { ok: false; failure: ProfileFailure }> {
  if (!isPublicUrl(raw)) {
    return { ok: false, failure: { ok: false, error: { kind: 'contract', message: 'Only public http(s) URLs are allowed.', retryable: false } } };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, failure: { ok: false, error: { kind: 'contract', message: 'The URL is not valid.', retryable: false } } };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, failure: { ok: false, error: { kind: 'contract', message: 'Private or internal hosts are not allowed.', retryable: false } } };
  }
  /* A literal IP needs no DNS answer to be judged: never trust a resolver to
     refuse 127.0.0.1 or 169.254.169.254 for us. */
  const literal = url.hostname.replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(literal) || literal.includes(':')) {
    if (isPrivateAddress(literal)) {
      return { ok: false, failure: { ok: false, error: { kind: 'contract', message: 'Private or reserved addresses are not allowed.', retryable: false } } };
    }
  }
  try {
    const addresses = await deps.lookupAddresses(url.hostname);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
      return { ok: false, failure: { ok: false, error: { kind: 'contract', message: 'This URL resolves to a private or reserved address.', retryable: false } } };
    }
  } catch {
    return { ok: false, failure: { ok: false, error: { kind: 'network', message: 'The host name could not be resolved.', retryable: true } } };
  }
  return { ok: true, url };
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? '').replace(/<[^>]+>/g, '').trim().slice(0, 200);
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|header|aside|noscript|svg|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  const seen = new Set<string>();
  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (line.length < 3) return false;
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { title, text: lines.join('\n').slice(0, MAX_TEXT) };
}

/** Bounded read: never let a large or endless response fill the process. */
async function readBounded(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchPublicPage(
  raw: string,
  injected?: Partial<Deps>,
): Promise<{ ok: true; page: FetchedPage } | { ok: false; failure: ProfileFailure }> {
  const deps: Deps = { ...defaultDeps, ...injected };
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await assertPublicTarget(current, deps);
    if (!check.ok) return check;
    let response: Response;
    try {
      response = await deps.fetcher(current, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      return { ok: false, failure: { ok: false, error: { kind: 'network', message: 'The page could not be retrieved.', retryable: true } } };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) {
        return { ok: false, failure: { ok: false, error: { kind: 'network', message: 'Too many or invalid redirects.', retryable: false } } };
      }
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) {
      return {
        ok: false,
        failure: {
          ok: false,
          error: {
            kind: response.status === 429 || response.status >= 500 ? 'network' : 'unsupported',
            message: response.status === 403 || response.status === 401
              ? 'This page requires access we do not have. A login wall or paywall is never bypassed.'
              : `The page answered ${response.status}.`,
            retryable: response.status === 429 || response.status >= 500,
          },
        },
      };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
      return { ok: false, failure: { ok: false, error: { kind: 'unsupported', message: 'This source type is not a readable public page.', retryable: false } } };
    }
    const rawBody = await readBounded(response);
    const extracted = /text\/html|application\/xhtml\+xml/i.test(contentType) ? htmlToText(rawBody) : { title: '', text: rawBody.slice(0, MAX_TEXT) };
    if (extracted.text.trim().length < 20) {
      return { ok: false, failure: { ok: false, error: { kind: 'unsupported', message: 'No usable text was found on this page.', retryable: false } } };
    }
    return {
      ok: true,
      page: {
        url: raw,
        finalUrl: current,
        title: extracted.title,
        text: extracted.text,
        retrievedAt: new Date().toISOString(),
      },
    };
  }
  return { ok: false, failure: { ok: false, error: { kind: 'network', message: 'Too many redirects.', retryable: false } } };
}
