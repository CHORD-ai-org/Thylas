/**
 * Wire contract for the Profile Initialization Pipeline. Shared by the server
 * route and the client service (D-006 pattern): a wire change is a compile
 * error on the other side. No implementation here — shapes and validators only.
 */

export const PROFILE_PATH = '/api/profile';

export type ProfileSourceType =
  | 'website'
  | 'github'
  | 'linkedin'
  | 'portfolio'
  | 'article'
  | 'custom';

export const SOURCE_TYPES: ProfileSourceType[] = [
  'website',
  'github',
  'linkedin',
  'portfolio',
  'article',
  'custom',
];

export type ProfileCategory =
  | 'basic'
  | 'interests'
  | 'goals'
  | 'expertise'
  | 'preferences'
  | 'activities';

export const PROFILE_CATEGORIES: ProfileCategory[] = [
  'basic',
  'interests',
  'goals',
  'expertise',
  'preferences',
  'activities',
];

export type InformationType = 'explicit' | 'inferred';
export type CandidateStatus = 'pending' | 'accepted' | 'rejected' | 'edited';
export type RecordState = 'active' | 'outdated' | 'archived';
export type SourceStatus = 'pending' | 'ok' | 'failed' | 'unsupported';

export type ProfileSource = {
  id: string;
  type: ProfileSourceType;
  url: string;
  status: SourceStatus;
  createdAt: string;
  retrievedAt: string | null;
  error: string | null;
};

export type ProfileCandidate = {
  id: string;
  sourceId: string;
  sourceUrl: string;
  category: ProfileCategory;
  content: string;
  /** The page excerpt the item came from — provenance, not a summary. */
  evidence: string;
  informationType: InformationType;
  /** Model self-report, not a calibrated probability. */
  confidence: number;
  status: CandidateStatus;
  /** User edit wins over the original extraction, permanently. */
  editedContent: string | null;
  discoveredAt: string;
  confirmedAt: string | null;
  confirmedBy: string | null;
  /** Set on rediscovery when it resembles an existing confirmed record. */
  possibleMatch: string | null;
};

export type ProfileRecord = {
  id: string;
  /** Normalized (category + content) key — the deduplication identity. */
  key: string;
  category: ProfileCategory;
  content: string;
  sourceUrl: string;
  evidence: string;
  informationType: InformationType;
  state: RecordState;
  createdAt: string;
  discoveredAt: string;
  updatedAt: string;
  confirmedAt: string;
  confirmedBy: string;
};

export type ProfileHistoryEntry = {
  id: string;
  recordId: string;
  from: string | null;
  to: string;
  at: string;
  by: string;
};

export type ProfileSession = {
  id: string;
  stage: 'sources' | 'discovering' | 'review' | 'complete';
  createdAt: string;
  updatedAt: string;
};

export type ProfileState = {
  sources: ProfileSource[];
  candidates: ProfileCandidate[];
  records: ProfileRecord[];
  history: ProfileHistoryEntry[];
  session: ProfileSession | null;
  overview: string | null;
};

export type ProfileErrorKind =
  | 'contract'
  | 'unauthorized'
  | 'forbidden'
  | 'not_configured'
  | 'network'
  | 'upstream'
  | 'unsupported'
  | 'not_found';

export type ProfileFailure = { ok: false; error: { kind: ProfileErrorKind; message: string; retryable: boolean } };

export function profileFailure(kind: ProfileErrorKind, message: string, retryable = false): ProfileFailure {
  return { ok: false, error: { kind, message, retryable } };
}

export function profileStatusFor(kind: ProfileErrorKind): number {
  switch (kind) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'contract':
      return 400;
    case 'unsupported':
      return 422;
    default:
      return 502;
  }
}

const MAX_URL = 2048;
const MAX_CONTENT = 800;
const MAX_EVIDENCE = 1200;

/** Public http(s) URL only. DNS/private-network checks happen server-side. */
export function isPublicUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username !== '' || url.password !== '') return false;
    return url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function isSourceBody(value: unknown): value is { type: ProfileSourceType; url: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && SOURCE_TYPES.includes(v.type as ProfileSourceType) && isPublicUrl(v.url);
}

export function isCandidatePatch(value: unknown): value is {
  action: 'accept' | 'reject' | 'edit';
  content?: string;
} {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.action !== 'accept' && v.action !== 'reject' && v.action !== 'edit') return false;
  if (v.action === 'edit') {
    return typeof v.content === 'string' && v.content.trim().length > 0 && v.content.length <= MAX_CONTENT;
  }
  return true;
}

/** The model's extraction shape, validated before anything reaches a store. */
export type ExtractedItem = {
  category: ProfileCategory;
  content: string;
  evidence: string;
  informationType: InformationType;
  confidence: number;
};

export function isExtractedItem(value: unknown): value is ExtractedItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.category === 'string' &&
    PROFILE_CATEGORIES.includes(v.category as ProfileCategory) &&
    typeof v.content === 'string' &&
    v.content.trim().length > 0 &&
    v.content.length <= MAX_CONTENT &&
    typeof v.evidence === 'string' &&
    v.evidence.length <= MAX_EVIDENCE &&
    (v.informationType === 'explicit' || v.informationType === 'inferred') &&
    typeof v.confidence === 'number' &&
    Number.isFinite(v.confidence) &&
    v.confidence >= 0 &&
    v.confidence <= 1
  );
}

/** Deduplication identity: category + normalized content, never timestamps. */
export function recordKey(category: ProfileCategory, content: string): string {
  return `${category}:${content.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_CONTENT)}`;
}
