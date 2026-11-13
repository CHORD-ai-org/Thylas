import { describe, expect, it } from 'vitest';
import {
  FILES_PATH,
  FILE_HEADERS,
  FILE_MAX_BYTES,
  decodeFileName,
  fileFailure,
  isFileKind,
  isSafeSegment,
  statusForFile,
} from './files';

describe('files contract', () => {
  it('names the endpoint, headers and the 100MB cap', () => {
    expect(FILES_PATH).toBe('/api/files');
    expect(FILE_HEADERS.name).toBe('x-thylas-file-name');
    expect(FILE_MAX_BYTES).toBe(100 * 1024 * 1024);
  });

  it('keeps the failure shape and an honest retryable flag', () => {
    expect(fileFailure('too_large', 'over')).toEqual({
      ok: false,
      kind: 'too_large',
      message: 'over',
      retryable: false,
    });
    expect(fileFailure('upstream', 'disk').retryable).toBe(true);
  });

  it('maps failure kinds to HTTP status', () => {
    expect(statusForFile('contract')).toBe(400);
    expect(statusForFile('not_found')).toBe(404);
    expect(statusForFile('too_large')).toBe(413);
    expect(statusForFile('not_configured')).toBe(503);
    expect(statusForFile('upstream')).toBe(502);
  });

  it('rejects path traversal in ids', () => {
    expect(isSafeSegment('ws-1')).toBe(true);
    expect(isSafeSegment('../etc')).toBe(false);
    expect(isSafeSegment('a/b')).toBe(false);
    expect(isSafeSegment('')).toBe(false);
    expect(isSafeSegment(12)).toBe(false);
  });

  it('accepts only the product file kinds', () => {
    expect(isFileKind('pdf')).toBe(true);
    expect(isFileKind('exe')).toBe(false);
    expect(isFileKind(null)).toBe(false);
  });

  it('decodes a header file name and rejects junk', () => {
    expect(decodeFileName('report%20final.pdf')).toBe('report final.pdf');
    expect(decodeFileName(undefined)).toBeNull();
    expect(decodeFileName('%E0%A4%A')).toBeNull();
    expect(decodeFileName('%20')).toBeNull();
  });
});
