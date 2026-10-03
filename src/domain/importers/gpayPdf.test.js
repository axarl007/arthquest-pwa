// @vitest-environment node
// End-to-end over a real PDF: the synthetic fixture (scripts/gen-gpay-fixture.mjs) through pdf.js
// (legacy/Node build — the app uses the browser build via src/native/pdfText.js, same API),
// statementSourceFromBytes and parseStatement.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { statementSourceFromBytes } from './statementSource.js';
import { parseStatement } from './index.js';

async function extractPdfPages(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) pages.push((await (await doc.getPage(p)).getTextContent()).items);
  return pages;
}

describe('Google Pay PDF, end to end', () => {
  it('parses every transaction in the synthetic statement', async () => {
    const bytes = new Uint8Array(fs.readFileSync(path.join(import.meta.dirname, 'fixtures/gpay-sample.pdf')));
    const { format, rows, invalidCount } = parseStatement(await statementSourceFromBytes(bytes, extractPdfPages));
    expect(format.id).toBe('gpay');
    expect(invalidCount).toBe(0);
    expect(rows.map((r) => [r.externalId, r.date, r.time, r.amount, r.direction, r.payee])).toEqual([
      ['gpay:600000000001', '2026-09-01', '10:47', 5920, 'debit', 'Myntra'],
      ['gpay:600000000002', '2026-09-02', '17:28', 3499, 'debit', 'EKART'],
      ['gpay:600000000003', '2026-09-04', '14:38', 3.09, 'credit', 'Google Play'],
      ['gpay:600000000004', '2026-09-09', '14:44', 999, 'debit', 'ADYAR ANANDA BHAVAN SWEETS INDIA PRIVATE LIMITED BRANCH OFFICE'],
      ['gpay:600000000005', '2026-09-30', '00:05', 183250.5, 'debit', 'SHADOWFAX TECHNOLOGIES LIMITED'],
    ]);
  });
});
