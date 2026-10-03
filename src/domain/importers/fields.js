import { halfUpRound } from '../money.js';

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** 1-12 for any 3+ letter prefix of a month name in any case ("Sep", "Sept", "SEPTEMBER"), else 0 —
 * PhonePe itself writes September as the 4-letter "Sept". */
export function monthNumber(name) {
  const token = name.replace(/\.$/, '').toLowerCase();
  if (token.length < 3) return 0;
  return MONTH_NAMES.findIndex((m) => m.startsWith(token)) + 1;
}

/** ISO "YYYY-MM-DD" from parts, or null when the month name or day is out of range. */
export function isoDate(year, monthName, day) {
  const month = monthNumber(monthName);
  const d = Number(day);
  if (!month || d < 1 || d > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "09:09 am" / "2:18 PM" / "12:15 am" → 24h "HH:MM", or null if unreadable. */
export function parseTime12h(value) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i.exec(value.trim());
  if (!m) return null;
  let hour = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') hour += 12;
  return `${String(hour).padStart(2, '0')}:${m[2]}`;
}

/** "2,500.50" / "₹800" / "₹2,69,748.04" → number rounded to paise, or null unless a positive amount. */
export function parseAmount(value) {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const amount = halfUpRound(Number(cleaned), 2);
  return amount > 0 ? amount : null;
}
