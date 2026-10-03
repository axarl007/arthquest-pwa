/**
 * Splits one CSV line into fields — RFC 4180 quoting (commas inside quotes, `""` as an escaped
 * quote). Statement formats handled here never put a newline inside a quoted field, so callers
 * split on lines first; that keeps preamble/footer junk (which isn't valid CSV) from derailing a
 * whole-file parser.
 */
export function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

/** File text → lines, tolerating a UTF-8 BOM and CRLF/CR line endings. */
export function splitLines(text) {
  return text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
}
