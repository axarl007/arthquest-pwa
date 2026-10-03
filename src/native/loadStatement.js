import { statementSourceFromBytes } from '../domain/importers/statementSource.js';
import { parseStatement, StatementImportError } from '../domain/importers/index.js';
import { extractPdfPages } from './pdfText.js';

/**
 * A statement file's bytes (picked in Settings, or shared in from Android — #36/#40/#45) → the
 * parseStatement draft the review screen takes. Rejects with a user-facing message.
 */
export async function loadStatement(bytes) {
  try {
    return parseStatement(await statementSourceFromBytes(bytes, extractPdfPages));
  } catch (e) {
    throw new Error(e instanceof StatementImportError ? e.message : "Couldn't read that file.");
  }
}

