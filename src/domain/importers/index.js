/**
 * Bank/UPI statement importers (ticket #36). Each format is a module exposing
 * `{ id, label, detect(text), parse(text) → { rows: NormalizedRow[], invalidCount } }`, where
 *
 *   NormalizedRow = { externalId, date: 'YYYY-MM-DD', time: 'HH:MM', amount, direction: 'debit'|'credit', payee, rawDescription }
 *
 * `externalId` is `<format id>:<the source's own transaction id>` — the dedup key that ends up on
 * the imported transaction. Adding a format means one module here plus its tests; the review
 * screen and everything downstream only ever see NormalizedRows.
 */
import { phonepe } from './phonepe.js';

export const IMPORTERS = [phonepe];

export class StatementImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Auto-detects the format and parses. Throws StatementImportError ('unrecognized' | 'empty'). */
export function parseStatement(text) {
  const format = IMPORTERS.find((f) => f.detect(text));
  if (!format) {
    throw new StatementImportError('unrecognized', `Unrecognized file — supported: ${IMPORTERS.map((f) => f.label).join(', ')}`);
  }
  const { rows, invalidCount } = format.parse(text);
  if (rows.length === 0) {
    throw new StatementImportError('empty', `No transactions found in this ${format.label} statement.`);
  }
  return { format, rows, invalidCount };
}
