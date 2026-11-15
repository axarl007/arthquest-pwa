#!/usr/bin/env node
/**
 * Redacts a bank/UPI statement export so it can be shared as an importer fixture without leaking
 * personal data. Zero dependencies — runs on plain Node (incl. Termux on Android).
 *
 *   node redact-statement.mjs <statement.csv|.txt> [output] [--keep=Word1,Word2]
 *
 * What it keeps, so the result still exercises a real parser:
 *   - line structure, delimiters, quoting, blank lines, BOM, line endings
 *   - dates and times (not personal on their own once amounts/payees are fake)
 *   - number *formats*: digit count, commas, decimals, leading zeros (every other digit is random)
 *   - banking/column vocabulary + common English words (see KEEP_WORDS), and anything in --keep
 *   - the handle after '@' in a UPI ID / email (ybl, okaxis, gmail.com), and a URL's scheme+host
 * Everything else — names (any script, not just ASCII), account/phone numbers, transaction ids,
 * UPI ID local parts, URL paths — is replaced by fakes of the same length. Nothing is kept because
 * of *where* it sits (e.g. "looks like a header"), only because of *what* it is. Replacements are
 * consistent and collision-free within one run (same payee/id → same fake, different → different),
 * so repeated-payee and duplicate-id cases survive redaction. Column names it doesn't know get
 * faked too; the report lists them so you can rerun with --keep.
 *
 * It is a heuristic: ALWAYS read the output before sharing it. The words it kept are printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december';

const KEEP_WORDS = new Set(
  `
  am pm hrs ist
  date dt time txn tran trans transaction transactions details detail description narration particulars
  remarks remark ref reference refno no num number chq cheque value posted posting amount amt balance bal
  closing opening debit debits credit credits dr cr withdrawal withdrawals deposit deposits type mode status
  total totals sr sl serial id utr rrn instrument category merchant payee beneficiary sender receiver
  account acct ac statement period from to duration summary page of generated on by for init br
  domestic international rewards reward points point due minimum limit available outstanding
  upi neft imps rtgs ach nach ecs atm pos nfs cash card visa mastercard rupay emi interest charges charge fee
  fees gst tax tds reversal reversed refund refunded failed success successful pending cancelled
  paid received sent transfer transferred self payment payments recharge recharged autopay mandate
  p2a p2m vpa ifsc micr branch bank wallet inr rs re mr mrs ms shri smt
  phonepe paytm gpay google pay bhim cred amazon flipkart swiggy zomato
  hdfc icici sbi axis kotak idfc indusind federal canara pnb baroda rbl hsbc citi
  ybl ibl axl okaxis okhdfcbank okicici oksbi apl
  the and or is are was this that these those in at with as an be it its not do does any all your you our
  we us please if so can should which who what when where there here into than then also
  customer customers requested immediately notify case error errors visit terms conditions privacy policy
  disclaimer confidential intended recipient specified document email emails message mistake inform ensure
  automatically computer signature required contents
  `.split(/\s+/).filter(Boolean),
);

const DATE_RES = [
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/g,
  /\b\d{1,2}[-/.]\d{1,2}[-/.](?:\d{4}|\d{2})\b/g,
  new RegExp(`\\b\\d{1,2}[- ](?:${MONTHS})\\.?[- ,]+(?:\\d{4}|\\d{2})\\b`, 'gi'),
  new RegExp(`\\b(?:${MONTHS})\\.? \\d{1,2},? \\d{4}\\b`, 'gi'),
  /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?(?![\w:])/gi,
];
// Only scheme+host is protected; the path/query is redacted like any other text.
const URL_HOST_RE = /\b(?:https?:\/\/|www\.)[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gi;
// Handle is alnum/dots only — no '-', or a hyphen-delimited narration (…@okaxis-SBIN0001234-6123…) would be kept.
const AT_RE = /[\p{L}\p{N}._-]+@[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*/gu;
// Tokens are letters/digits in any script (+ combining marks, for Indic scripts).
const TOKEN_RE = /[\p{L}\p{M}\p{N}]+/gu;

/** Numeric dates must look like a real day/month, or a ref like 123/45/6789 would be kept as a "date". */
function plausibleNumericDate(s) {
  const parts = s.split(/[-/.T ]/).map(Number);
  if (s.match(/^\d{4}-/)) return parts[1] >= 1 && parts[1] <= 12 && parts[2] >= 1 && parts[2] <= 31;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]/.test(s)) {
    const [a, b] = parts;
    return a >= 1 && b >= 1 && ((a <= 31 && b <= 12) || (a <= 12 && b <= 31));
  }
  return true;
}

/** Returns sorted, non-overlapping [start, end, kind] spans of a line that must not be redacted. */
function protectedSpans(line) {
  const spans = [];
  for (const re of DATE_RES) {
    for (const m of line.matchAll(re)) {
      if (/^\d/.test(m[0]) && /[-/.]/.test(m[0]) && !plausibleNumericDate(m[0])) continue;
      spans.push([m.index, m.index + m[0].length, 'keep']);
    }
  }
  for (const m of line.matchAll(URL_HOST_RE)) spans.push([m.index, m.index + m[0].length, 'url']);
  for (const m of line.matchAll(AT_RE)) spans.push([m.index, m.index + m[0].length, 'at']);
  spans.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] < last[1]) continue; // overlapping: the earlier/longer span wins
    merged.push(s);
  }
  return merged;
}

const FIELD_SPLIT = /[,\t;|~]/; // ~ and ~|~ are HDFC credit card exports
const isHeaderCandidate = (line) => !/\p{N}/u.test(line) && line.split(FIELD_SPLIT).filter((f) => f.trim()).length >= 3;
const spansHaveDate = (line, spans) => spans.some(([s, e, kind]) => kind === 'keep' && !/^\d{1,2}:\d{2}/.test(line.slice(s, e)));

export function redactStatement(text, { keep = [], rng = Math.random } = {}) {
  const keepSet = new Set([...KEEP_WORDS, ...keep.map((w) => w.toLowerCase())]);
  const fakes = new Map();
  const usedFakes = new Set();
  const report = { headerWordsReplaced: new Set(), urls: new Set(), keptWords: new Set(), replaced: 0 };

  const randInt = (n) => Math.floor(rng() * n);
  const randLetter = (upper) => String.fromCharCode((upper ? 65 : 97) + randInt(26));
  const fakeChar = (ch, i, chars) => {
    if (ch === 'X' || ch === 'x' || ch === '*') return ch; // existing masking stays masking
    if (/\p{N}/u.test(ch)) {
      const leadingZero = ch === '0' && chars.slice(0, i).every((c) => c === '0');
      if (leadingZero) return '0';
      const firstSignificant = chars.slice(0, i).every((c) => c === '0' || !/\p{N}/u.test(c));
      return String(firstSignificant ? 1 + randInt(9) : randInt(10));
    }
    if (/\p{Lu}/u.test(ch)) return randLetter(true);
    if (/[\p{L}\p{M}]/u.test(ch)) return randLetter(false); // non-ASCII letters/marks → ASCII
    return ch;
  };
  // Consistent per original (case-insensitive), distinct across originals where the shape allows it,
  // and each occurrence keeps its own case pattern.
  const fakeOf = (token) => {
    // Lowercase per code point, keeping one char each, so the key/fake stay index-aligned with the
    // token even for letters whose lowercase is longer (e.g. 'İ' → 'i̇').
    const chars = [...token].map((ch) => [...ch.toLowerCase()][0]);
    const key = chars.join('');
    if (!fakes.has(key)) {
      let fake;
      for (let attempt = 0; attempt < 50; attempt++) {
        fake = chars.map(fakeChar).join('');
        if (!usedFakes.has(fake) && fake !== key) break;
      }
      usedFakes.add(fake);
      fakes.set(key, fake);
    }
    const fake = [...fakes.get(key)];
    report.replaced++;
    return [...token].map((ch, i) => (/\p{Lu}/u.test(ch) ? fake[i].toUpperCase() : fake[i])).join('');
  };

  let headerLine = false;
  const redactToken = (token) => {
    if (keepSet.has(token.toLowerCase())) {
      if (/\p{L}/u.test(token)) report.keptWords.add(token.toLowerCase());
      return token;
    }
    if (headerLine) report.headerWordsReplaced.add(token);
    // Mixed id like T2610…/UPI123…: keep a 1–2 letter or known prefix (format markers), fake the rest.
    const prefix = token.match(/^[A-Za-z]+/)?.[0] ?? '';
    const rest = token.slice(prefix.length);
    if (prefix && /^\d/.test(rest) && (prefix.length <= 2 || keepSet.has(prefix.toLowerCase()))) {
      return prefix + fakeOf(rest);
    }
    return fakeOf(token);
  };
  const redactPlain = (s) => s.replace(TOKEN_RE, redactToken);

  const parts = text.split(/(\r\n|\r|\n)/); // odd indices are the original line endings
  const spans = parts.map((p, i) => (i % 2 === 0 ? protectedSpans(p) : null));
  // A digit-free, multi-field line just above a dated row is probably the column header; any word in
  // it we fake gets reported so the user can --keep real column names. It is NOT kept verbatim.
  const likelyHeader = new Set();
  let nextNonBlank = -1;
  for (let i = parts.length - 1 - ((parts.length - 1) % 2); i >= 0; i -= 2) {
    if (nextNonBlank >= 0 && isHeaderCandidate(parts[i]) && spansHaveDate(parts[nextNonBlank], spans[nextNonBlank])) likelyHeader.add(i);
    if (parts[i].trim()) nextNonBlank = i;
  }

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    headerLine = likelyHeader.has(i);
    let out = '';
    let pos = 0;
    for (const [s, e, kind] of spans[i]) {
      out += redactPlain(line.slice(pos, s));
      const seg = line.slice(s, e);
      if (kind === 'url') report.urls.add(seg);
      if (kind === 'at') {
        const at = seg.indexOf('@');
        out += seg.slice(0, at).replace(TOKEN_RE, fakeOf) + seg.slice(at);
      } else {
        out += seg;
      }
      pos = e;
    }
    parts[i] = out + redactPlain(line.slice(pos));
  }
  headerLine = false;
  return { text: parts.join(''), report };
}

function sniffBinary(buf) {
  const head = buf.subarray(0, 4).toString('latin1');
  if (head.startsWith('%PDF')) return 'PDF';
  if (head.startsWith('PK')) return 'XLSX (zip)';
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return 'XLS (legacy Excel)';
  return null;
}

/** UTF-8 by default; UTF-16 (Excel's "Unicode Text") via its BOM. Refuses anything else with NULs. */
export function decodeText(buf) {
  if ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)) {
    if (buf.length % 2) throw new Error('UTF-16 file has an odd byte count — it looks truncated. Re-export it.');
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  if (buf.subarray(0, 4096).includes(0)) throw new Error('File contains NUL bytes — unknown encoding (UTF-16 without BOM?). Re-export as UTF-8 CSV.');
  return buf.toString('utf8');
}

const USAGE = 'Usage: node redact-statement.mjs <statement.csv|.txt> [output] [--keep=Word1,Word2]';

export function parseArgs(argv) {
  const keep = [];
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--keep' || a.startsWith('--keep=')) {
      const value = a === '--keep' ? argv[++i] : a.slice('--keep='.length);
      if (!value) throw new Error('--keep needs a value, e.g. --keep=Narration,Withdrawal');
      keep.push(...value.split(',').map((w) => w.trim()).filter(Boolean));
    } else if (a.startsWith('-')) {
      throw new Error(`Unknown option ${a}`);
    } else {
      files.push(a);
    }
  }
  if (files.length < 1 || files.length > 2) throw new Error('Expected an input file and an optional output file.');
  return { input: files[0], output: files[1], keep };
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.error(USAGE);
    process.exit(0);
  }
  const { input, keep } = args;
  const ext = path.extname(input);
  const output = args.output ?? path.join(path.dirname(input), `${path.basename(input, ext)}.redacted${ext || '.txt'}`);
  if (path.resolve(output) === path.resolve(input)) {
    console.error('Refusing to overwrite the original statement — pick a different output path.');
    process.exit(2);
  }
  const buf = fs.readFileSync(input);
  const binary = sniffBinary(buf);
  if (binary) {
    console.error(`${input} is a ${binary} file, not text. Convert it to CSV/text first (see the Termux steps), then rerun.`);
    process.exit(2);
  }
  let decoded;
  try {
    decoded = decodeText(buf);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  const { text, report } = redactStatement(decoded, { keep });
  fs.writeFileSync(output, text);

  const err = (s = '') => console.error(s);
  err(`Wrote ${output}  (${report.replaced} tokens replaced)`);
  err();
  if (report.headerWordsReplaced.size) {
    err('Words FAKED in what looks like the column-header line. If these are column names (not a person),');
    err('rerun with them kept so the fixture has the real header:');
    err(`  --keep=${[...report.headerWordsReplaced].join(',')}`);
    err();
  }
  if (report.urls.size) {
    err('URL hosts kept (paths were redacted):');
    for (const u of report.urls) err(`  ${u}`);
    err();
  }
  err('Words kept as-is (built-in banking/common words + --keep). Make sure none is a name:');
  err(`  ${[...report.keptWords].sort().join(', ')}`);
  err();
  err('Dates and times are kept unchanged. Read the output file fully before sharing it.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
