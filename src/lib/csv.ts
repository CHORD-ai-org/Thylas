/**
 * CSV, parsed as text — no library, no HTML.
 *
 * Scope is deliberately the RFC 4180 subset that real exports use: quoted
 * fields, doubled quotes inside a quote, newlines inside a quote, CRLF or LF.
 * The delimiter is always a comma; sniffing is out of scope and pretending
 * otherwise is how "1;2;3" silently becomes one column.
 *
 * Limits exist because previews are previews: the renderer stops at
 * `maxRows × maxCols`, and the caller reports what it dropped.
 */
export type CsvOptions = {
  maxRows?: number;
  maxCols?: number;
};

export type CsvTable = {
  header: string[];
  rows: string[][];
  /** Data rows in the file, before the row cap. */
  totalRows: number;
  truncatedRows: boolean;
  truncatedCols: boolean;
};

export const CSV_DEFAULT_ROWS = 200;
export const CSV_DEFAULT_COLS = 40;

/** Splits the source into raw rows. Quotes are resolved here; trimming happens
    only on fields that were never quoted (a quoted field keeps its spaces). */
export function splitCsv(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let wasQuoted = false;
  let i = 0;

  const endField = () => {
    row.push(wasQuoted ? field : field.trim());
    field = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"' && field.trim() === '') {
      inQuotes = true;
      wasQuoted = true;
      field = '';
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  if (field !== '' || row.length > 0) endRow();

  /* A trailing newline produces one empty row; drop it rather than render a
     phantom line at the bottom of every table. */
  const last = rows.at(-1);
  if (last && last.length === 1 && last[0] === '') rows.pop();

  return rows;
}

export function parseCsv(source: string, options: CsvOptions = {}): CsvTable {
  const maxRows = options.maxRows ?? CSV_DEFAULT_ROWS;
  const maxCols = options.maxCols ?? CSV_DEFAULT_COLS;

  const all = splitCsv(source);
  if (all.length === 0) {
    return { header: [], rows: [], totalRows: 0, truncatedRows: false, truncatedCols: false };
  }

  const widest = all.reduce((max, row) => Math.max(max, row.length), 0);
  const width = Math.min(Math.max(widest, 1), maxCols);

  const header = (all[0] ?? []).slice(0, width);
  while (header.length < width) header.push('');

  const body = all.slice(1);
  const rows = body.slice(0, maxRows).map((row) => {
    const cells = row.slice(0, width);
    while (cells.length < width) cells.push('');
    return cells;
  });

  return {
    header,
    rows,
    totalRows: body.length,
    truncatedRows: body.length > rows.length,
    truncatedCols: widest > width,
  };
}

/** Right-aligns a column when most of its values look numeric. */
export function isNumericColumn(rows: string[][], index: number): boolean {
  const sample = rows.slice(0, 40).map((row) => row[index] ?? '').filter((cell) => cell !== '');
  if (sample.length === 0) return false;
  const numeric = sample.filter((cell) => /^-?\d+(\.\d+)?$/.test(cell)).length;
  return numeric / sample.length >= 0.6;
}
