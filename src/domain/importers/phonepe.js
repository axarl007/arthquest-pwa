import { parseCsvLine, splitLines } from './csv.js';
import { halfUpRound } from '../money.js';

const HEADER = ['Date', 'Time', 'Transaction Details', 'Transaction ID', 'UTR', 'Transaction Type'];
// Date, Time, Details, Transaction ID, UTR, Type, Instrument, Amount.
const HEADER_FIELD_COUNT = 8;
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const PAYEE_PREFIXES = [/^Paid to\s+/i, /^Payment to\s+/i, /^Received from\s+/i];

function isHeaderLine(line) {
  const fields = parseCsvLine(line).map((f) => f.trim());
  return HEADER.every((h, i) => fields[i] === h);
}

/** "Oct 03, 2026" / "Sept 30, 2026" → "2026-10-03" / "2026-09-30", or null if unreadable. The
 * month can be any 3+ letter prefix of its name in any case — PhonePe itself writes September
 * as the 4-letter "Sept". */
function parseDate(value) {
  const m = /^([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})$/.exec(value.trim());
  if (!m) return null;
  const token = m[1].toLowerCase();
  const month = MONTH_NAMES.findIndex((name) => name.startsWith(token)) + 1;
  if (month === 0) return null;
  const day = Number(m[2]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "09:09 am" / "12:15 am" / "05:53 pm" → 24h "HH:MM", or null if unreadable. */
function parseTime(value) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(value.trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/** "2,500.50" / "₹800" → 2500.5 / 800 (rounded to paise), or null unless a positive amount. */
function parseAmount(value) {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = halfUpRound(Number(cleaned), 2);
  return amount > 0 ? amount : null;
}

function payeeOf(details) {
  const trimmed = details.trim();
  for (const prefix of PAYEE_PREFIXES) {
    if (prefix.test(trimmed)) return trimmed.replace(prefix, '').trim();
  }
  return trimmed;
}

/**
 * PhonePe's "Transaction Statement" CSV export: a free-text preamble (account number, Duration
 * line), then the header row, then one quoted row per transaction, then a blank line and a
 * free-text disclaimer footer. Rows are newest-first.
 */
export const phonepe = {
  id: 'phonepe',
  label: 'PhonePe',

  detect(text) {
    return splitLines(text).some(isHeaderLine);
  },

  parse(text) {
    const lines = splitLines(text);
    const headerIndex = lines.findIndex(isHeaderLine);
    const rows = [];
    let invalidCount = 0;
    for (const line of lines.slice(headerIndex + 1)) {
      // The table ends at the first line that isn't shaped like a row: normally a blank line —
      // which a spreadsheet app re-saving the file pads to ",,,,,,," — though the disclaimer
      // footer is prose either way. A row-shaped line with unreadable values is counted as
      // invalid instead, so a damaged row is reported rather than silently dropped.
      const fields = parseCsvLine(line);
      if (fields.length < HEADER_FIELD_COUNT || fields.every((f) => !f.trim())) break;
      const [dateField, timeField, details, txId, , typeField, , amountField] = fields;
      const date = parseDate(dateField);
      const time = parseTime(timeField);
      const amount = parseAmount(amountField);
      const type = typeField.trim().toUpperCase();
      const direction = type === 'DEBIT' ? 'debit' : type === 'CREDIT' ? 'credit' : null;
      if (!date || !time || amount == null || !direction || !txId.trim()) {
        invalidCount++;
        continue;
      }
      rows.push({
        externalId: `phonepe:${txId.trim()}`, date, time, amount, direction,
        payee: payeeOf(details), rawDescription: details.trim(),
      });
    }
    return { rows, invalidCount };
  },
};
