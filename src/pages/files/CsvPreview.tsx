import { useMemo } from 'react';
import { isNumericColumn, parseCsv } from '../../lib/csv';
import p from './preview.module.css';

/**
 * CSV as a table. Sticky header, numeric columns right-aligned in the mono
 * face, and a footer that says how much of the file is on screen — a preview
 * that silently stops at row 200 is a lie.
 */
export function CsvPreview({ source }: { source: string }) {
  const table = useMemo(() => parseCsv(source), [source]);
  const numeric = useMemo(
    () => table.header.map((_, index) => isNumericColumn(table.rows, index)),
    [table],
  );

  if (table.header.length === 0) {
    return <p className={p.empty}>This file has no rows.</p>;
  }

  return (
    <div className={p.csvWrap} role="region" aria-label="CSV preview" tabIndex={0} data-csv-preview>
      <table className={p.csvTable} data-csv-table>
        <thead>
          <tr>
            {table.header.map((cell, index) => (
              <th key={index} scope="col" data-num={numeric[index] ? 'true' : undefined}>
                {cell || `column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} data-num={numeric[cellIndex] ? 'true' : undefined} title={cell}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={p.csvFoot}>
        {table.truncatedRows
          ? `Showing ${table.rows.length} of ${table.totalRows} rows`
          : `${table.totalRows} row${table.totalRows === 1 ? '' : 's'}`}
        {table.truncatedCols ? ' · extra columns hidden' : ''}
      </p>
    </div>
  );
}
