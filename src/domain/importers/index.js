/**
 * Bank/UPI statement importers (tickets #36, #45). Each format is a module exposing
 * `{ id, label, input: 'text' | 'pdf', detect, parse → { rows: NormalizedRow[], invalidCount } }`,
 * where a 'text' importer's detect/parse take the file's text and a 'pdf' importer's take the
 * StatementSource itself (`{ kind: 'pdf', lines }`, lines from groupTextItemsIntoLines):
 *
 *   StatementSource = { kind: 'text', text } | { kind: 'pdf', lines }
 *   NormalizedRow   = { externalId, date: 'YYYY-MM-DD', time: 'HH:MM', amount, direction: 'debit'|'credit', payee, rawDescription }
 *
 * `externalId` is `<format id>:<the source's own transaction id>` — the dedup key that ends up on
 * the imported transaction. Adding a format means one module here plus its tests; the review
 * screen and everything downstream only ever see NormalizedRows.
 */
import { phonepe } from './phonepe.js';
import { gpay } from './gpay.js';

export const IMPORTERS = [phonepe, gpay];

export class StatementImportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Auto-detects the format and parses. Throws StatementImportError ('unrecognized' | 'empty'). */
export function parseStatement(source) {
  const inputOf = (f) => (f.input === 'pdf' ? source : source.text);
  const format = IMPORTERS.find((f) => (f.input === 'pdf') === (source.kind === 'pdf') && f.detect(inputOf(f)));
  if (!format) {
    throw new StatementImportError('unrecognized', `Unrecognized file — supported: ${IMPORTERS.map((f) => f.label).join(', ')}`);
  }
  const { rows, invalidCount } = format.parse(inputOf(format));
  if (rows.length === 0) {
    throw new StatementImportError('empty', `No transactions found in this ${format.label} statement.`);
  }
  return { format, rows, invalidCount };
}
