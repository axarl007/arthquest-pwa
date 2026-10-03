import { groupTextItemsIntoLines } from './pdfLines.js';
import { StatementImportError } from './index.js';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

/**
 * A picked/shared statement file's raw bytes → StatementSource for parseStatement (ticket #45).
 * Format is decided by content ("%PDF" magic), never by file name or MIME type — Android reports
 * both unreliably for shared files. `extractPdfPages(bytes)` → per-page pdf.js text items is
 * injected (src/native/pdfText.js in the app) so this stays pure and the PDF engine is only
 * loaded when a PDF actually arrives.
 */
export async function statementSourceFromBytes(bytes, extractPdfPages) {
  const isPdf = PDF_MAGIC.every((b, i) => bytes[i] === b);
  if (!isPdf) return { kind: 'text', text: new TextDecoder('utf-8').decode(bytes) };
  let pages;
  try {
    pages = await extractPdfPages(bytes);
  } catch {
    throw new StatementImportError('unrecognized', "Couldn't read that PDF — it may be damaged or password-protected.");
  }
  return { kind: 'pdf', lines: groupTextItemsIntoLines(pages) };
}
