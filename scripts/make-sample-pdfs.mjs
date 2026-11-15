#!/usr/bin/env node
/**
 * Writes the two sample PDFs used by the file preview.
 *
 * Hand-built PDF 1.4: catalog → pages → page → two Type1 fonts → one content
 * stream. No library, because a dependency for two static pages is not a trade
 * worth making. Offsets are computed while concatenating, so the xref is exact.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(fileURLToPath(import.meta.url), '..');
const outDir = join(here, '..', 'public', 'samples');
mkdirSync(outDir, { recursive: true });

/* WinAnsi + latin1: anything outside it is dropped, so the text is folded to
   ASCII first instead of silently losing characters. */
const ascii = (s) =>
  s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, '');

const esc = (s) => ascii(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function contentStream({ title, meta, lines }) {
  const parts = [];
  parts.push('BT /F1 19 Tf 64 776 Td (' + esc(title) + ') Tj ET');
  parts.push('BT /F2 9 Tf 64 754 Td (' + esc(meta) + ') Tj ET');
  parts.push('0.55 w 64 742 m 531 742 l S');
  let y = 712;
  for (const line of lines) {
    if (line === '') {
      y -= 10;
      continue;
    }
    const bold = line.startsWith('# ');
    const text = bold ? line.slice(2) : line;
    parts.push(
      `BT /${bold ? 'F1' : 'F2'} ${bold ? 12 : 10.5} Tf 64 ${y} Td (${esc(text)}) Tj ET`,
    );
    y -= bold ? 22 : 16;
  }
  parts.push('BT /F2 8 Tf 64 60 Td (Thylas sample document — bundled with the prototype, not user data.) Tj ET');
  return parts.join('\n');
}

function buildPdf({ title, meta, lines }) {
  const content = contentStream({ title, meta, lines });
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

const protocol = buildPdf({
  title: 'Protocol v3 — boundary studies',
  meta: 'Research / datasets · version 3 · 12 pages in the source document',
  lines: [
    '# 1. Purpose',
    'This protocol fixes how a boundary study is run so that two runs can be',
    'compared without arguing about method afterwards. It is a sample file: the',
    'prototype ships one page, not the twelve the metadata claims.',
    '',
    '# 2. Preconditions',
    'A boundary must be stated before measurement. Where the boundary sits is a',
    'decision, not a finding; record who decided and when.',
    '',
    '# 3. Procedure',
    '1. Declare the boundary and the excluded region.',
    '2. Draw the sample from the declared region only.',
    '3. Record every crossing event with its timestamp.',
    '4. Compare against the previous run on the same boundary.',
    '',
    '# 4. Decision rules',
    'A crossing that cannot be located to within one tick is logged as unknown,',
    'never guessed into the nearest bin.',
    '',
    '# 5. Expected output',
    'One table: boundary id, sample size, crossings, unknowns, run label.',
  ],
});

const paper = buildPdf({
  title: 'Wu 2025 — comparability of run logs',
  meta: 'Research / papers · preprint · sample extract',
  lines: [
    '# Abstract',
    'We compare run logs collected under three logging policies and show that',
    'most of the apparent difference between systems is a difference in what',
    'each policy records, not in what the systems did.',
    '',
    '# 1. Setup',
    'Three policies, one workload, twelve repetitions. Every policy records a',
    'start and an end; only one records intermediate crossings.',
    '',
    '# 2. Finding',
    'Comparability fails at the boundary, not at the average. Two runs with the',
    'same mean can disagree on every individual crossing.',
    '',
    '# 3. Consequence',
    'Report the boundary with the number. An average without a boundary is not',
    'a measurement, it is a summary of an unstated choice.',
  ],
});

writeFileSync(join(outDir, 'protocol-v3.pdf'), protocol);
writeFileSync(join(outDir, 'wu-2025.pdf'), paper);
console.log('wrote', Buffer.byteLength(protocol), Buffer.byteLength(paper));
