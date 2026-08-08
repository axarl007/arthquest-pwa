export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Indian digit grouping on a plain digit string, e.g. "120000" -> "1,20,000" (last 3, then pairs). */
export function groupIndianDigits(digits) {
  let last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  if (rest !== '') {
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    last3 = ',' + last3;
  }
  return rest + last3;
}

/** Indian-numbering currency string, e.g. 120000 -> "₹1,20,000". */
export function formatINR(n) {
  const neg = n < 0;
  const rounded = Math.round(Math.abs(n));
  return (neg ? '-' : '') + '₹' + groupIndianDigits(String(rounded));
}

/** "2026-08-15" -> { y: 2026, m: 8, d: 15 } */
export function parseIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

/** "2026-08-01" -> "1 Aug" */
export function shortDate(iso) {
  const { m, d } = parseIsoDate(iso);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "2026-08-01" -> "1 Aug 2026" — for dates far enough out (quest target/redeemed dates) that the year matters. */
export function longDate(iso) {
  const { y, m, d } = parseIsoDate(iso);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** Whole days from `isoA` to `isoB` (positive if `isoB` is later), UTC-anchored so DST never skews it. */
export function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T00:00:00Z');
  const b = new Date(isoB + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

/**
 * Relative date label used in transaction lists: "Today, D Mon",
 * "Yesterday, D Mon", or a plain "D Mon" for anything older.
 * `referenceIso` defaults to the real current date.
 */
export function dLabel(iso, referenceIso = todayIso()) {
  const diff = daysBetween(iso, referenceIso);
  if (diff === 0) return `Today, ${shortDate(iso)}`;
  if (diff === 1) return `Yesterday, ${shortDate(iso)}`;
  return shortDate(iso);
}

/** "2026-08" -> "August 2026" */
export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS_FULL[m - 1]} ${y}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Today as an ISO date string (local time), e.g. "2026-08-07". */
export function todayIso(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "YYYY-MM" key for the given date, defaulting to now. */
export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** Shift a "YYYY-MM" key by `delta` months (may be negative), rolling over years. */
export function addMonthsToKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return `${ny}-${pad2(nm + 1)}`;
}

/** Chronological comparator for "YYYY-MM" keys, like a string compare. */
export function compareMonthKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
