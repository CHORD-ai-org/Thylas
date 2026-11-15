import { describe, expect, it } from 'vitest';
import { isNumericColumn, parseCsv, splitCsv } from './csv';

describe('fields and rows', () => {
  it('splits a plain table', () => {
    expect(splitCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a comma inside quotes', () => {
    expect(splitCsv('id,label\n1,"north, inner"\n')).toEqual([
      ['id', 'label'],
      ['1', 'north, inner'],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(splitCsv('id,label\n1,"north ""outer"""\n')[1]).toEqual(['1', 'north "outer"']);
  });

  it('keeps a newline inside quotes', () => {
    const rows = splitCsv('id,note\n1,"first\nsecond"\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]![1]).toBe('first\nsecond');
  });

  it('accepts CRLF and does not leave a carriage return in the cell', () => {
    expect(splitCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('trims unquoted padding but not inside quotes', () => {
    expect(splitCsv('a, b \n1, " x "\n')[1]).toEqual(['1', ' x ']);
  });

  it('drops a single trailing newline instead of adding a phantom row', () => {
    expect(splitCsv('a\n1\n')).toHaveLength(2);
    expect(splitCsv('a\n1')).toHaveLength(2);
  });
});

describe('parseCsv', () => {
  it('reports header, rows and totals', () => {
    const table = parseCsv('a,b\n1,2\n3,4\n');
    expect(table.header).toEqual(['a', 'b']);
    expect(table.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(table.totalRows).toBe(2);
    expect(table.truncatedRows).toBe(false);
  });

  it('pads short rows and pads a short header', () => {
    const table = parseCsv('a,b,c\n1,2\n');
    expect(table.rows[0]).toEqual(['1', '2', '']);
    expect(table.header).toEqual(['a', 'b', 'c']);
  });

  it('truncates rows and says so', () => {
    const source = ['a', ...Array.from({ length: 30 }, (_, i) => String(i))].join('\n');
    const table = parseCsv(source, { maxRows: 10 });
    expect(table.rows).toHaveLength(10);
    expect(table.totalRows).toBe(30);
    expect(table.truncatedRows).toBe(true);
  });

  it('truncates columns and says so', () => {
    const table = parseCsv('a,b,c,d\n1,2,3,4\n', { maxCols: 2 });
    expect(table.header).toEqual(['a', 'b']);
    expect(table.rows[0]).toEqual(['1', '2']);
    expect(table.truncatedCols).toBe(true);
  });

  it('returns an empty table for empty input', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [], totalRows: 0, truncatedRows: false, truncatedCols: false });
  });
});

describe('isNumericColumn', () => {
  it('spots a numeric column', () => {
    expect(isNumericColumn([['1', 'x'], ['2.5', 'y']], 0)).toBe(true);
    expect(isNumericColumn([['1', 'x'], ['2.5', 'y']], 1)).toBe(false);
  });

  it('ignores empty cells rather than counting them as text', () => {
    expect(isNumericColumn([['1', ''], ['2', '']], 0)).toBe(true);
    expect(isNumericColumn([['', ''], ['', '']], 0)).toBe(false);
  });
});
