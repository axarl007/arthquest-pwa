import { isoDate, parseTime12h, parseAmount } from './fields.js';

const DATE_RE = /^(\d{1,2}) ([A-Za-z]{3,9}\.?),? (\d{4})$/;
const TIME_RE = /^\d{1,2}:\d{2}\s*[AP]M$/i;
const TXN_ID_RE = /^UPI Transaction ID:\s*(\S+)$/i;
const DIRECTION_PREFIXES = [
  { re: /^Paid to\s+/i, direction: 'debit' },
  { re: /^Sent to\s+/i, direction: 'debit' },
  { re: /^Received from\s+/i, direction: 'credit' },
];

/** A transaction's first line: date · description · ₹amount (the amount cell may be unreadable —
 * that's reported as invalid, not a reason to miss the transaction). */
function isTransactionStart(line) {
  return line.cells.length >= 2 && DATE_RE.test(line.cells[0]);
}

/** Page chrome repeated on every page — skipped wherever it appears, even mid-transaction (a
 * transaction never spans a page break in GPay's layout, but this keeps a wrapped one safe). */
function isPageChrome(line) {
  const first = line.cells[0];
  return /^Page \d+ of \d+$/.test(first) || /^Note: /.test(first) || first === 'Transaction statement'
    || /^received\. Any payments/.test(first) || first === 'Date & time';
}

function parseTransaction(head, rest) {
  const [dateCell, ...others] = head.cells;
  // The amount is the rightmost cell; parseAmount rejects it if it isn't one.
  const amountCell = others.length > 1 ? others.pop() : null;
  const dm = DATE_RE.exec(dateCell);
  const date = dm ? isoDate(dm[3], dm[2], dm[1]) : null;
  let description = others.join(' ');
  let time = null;
  let txnId = null;
  let instrument = null;
  for (const line of rest) {
    for (const cell of line.cells) {
      const idMatch = TXN_ID_RE.exec(cell);
      if (idMatch) txnId = idMatch[1];
      else if (TIME_RE.test(cell)) time = parseTime12h(cell);
      else if (txnId == null) description = `${description} ${cell}`.trim(); // wrapped payee
      else if (instrument == null) instrument = cell; // later cells: next page's header (phone/email)
    }
  }
  const amount = amountCell ? parseAmount(amountCell) : null;
  const prefix = DIRECTION_PREFIXES.find((p) => p.re.test(description));
  const direction = prefix?.direction
    ?? (/^Paid by\b/i.test(instrument ?? '') ? 'debit' : /^Paid to\b/i.test(instrument ?? '') ? 'credit' : null);
  if (!date || !time || !txnId || amount == null || !direction || !description) return null;
  return {
    externalId: `gpay:${txnId}`, date, time, amount, direction,
    payee: prefix ? description.replace(prefix.re, '').trim() : description,
    rawDescription: description,
  };
}

/**
 * Google Pay's monthly "Transaction statement" PDF (ticket #45), as lines from
 * groupTextItemsIntoLines. Each transaction is three lines —
 *   `DD Mon, YYYY` · `Paid to X` / `Received from X` · `₹amount`
 *   `hh:mm AM` · `UPI Transaction ID: N`
 *   `Paid by <bank>` (money out) / `Paid to <bank>` (money in)
 * — under a per-page header (name/phone/email, period, Sent/Received totals, column titles) and
 * footer ("Note: …", "Page n of m"). Rows are oldest first. Direction comes from the description
 * prefix, falling back to the instrument line for an unfamiliar prefix.
 */
export const gpay = {
  id: 'gpay',
  label: 'Google Pay',
  input: 'pdf',

  detect(source) {
    if (source.kind !== 'pdf') return false;
    return source.lines.some((l) => l.cells.includes('Date & time') && l.cells.includes('Transaction details'))
      && source.lines.some((l) => l.cells.some((c) => TXN_ID_RE.test(c)));
  },

  parse(source) {
    const rows = [];
    let invalidCount = 0;
    let current = null;
    const flush = () => {
      if (!current) return;
      const row = parseTransaction(current.head, current.rest);
      if (row) rows.push(row);
      else invalidCount++;
      current = null;
    };
    for (const line of source.lines) {
      if (isPageChrome(line)) continue;
      if (isTransactionStart(line)) {
        flush();
        current = { head: line, rest: [] };
      } else if (current) {
        current.rest.push(line);
      }
    }
    flush();
    return { rows, invalidCount };
  },
};
