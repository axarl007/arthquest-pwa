// Generates src/domain/importers/fixtures/gpay-sample.pdf — a synthetic Google Pay "Transaction
// statement" in the real layout (ticket #45): per-page header/footer, three-line transactions,
// a payee long enough to wrap, a credit, two pages. Never commit a real statement (public repo).
//   node scripts/gen-gpay-fixture.mjs
import { chromium } from 'playwright';
import path from 'node:path';

const TXNS = [
  ['01 Sep, 2026', '10:47 AM', 'Paid to Myntra', '₹5,920', '600000000001', 'Paid by Example Bank 0000'],
  ['02 Sep, 2026', '05:28 PM', 'Paid to EKART', '₹3,499', '600000000002', 'Paid by Example Bank 0000'],
  ['04 Sep, 2026', '02:38 PM', 'Received from Google Play', '₹3.09', '600000000003', 'Paid to Example Bank 0000'],
  ['09 Sep, 2026', '02:44 PM', 'Paid to ADYAR ANANDA BHAVAN SWEETS INDIA PRIVATE LIMITED BRANCH OFFICE', '₹999', '600000000004', 'Paid by Example Bank 0000'],
  ['30 Sep, 2026', '12:05 AM', 'Paid to SHADOWFAX TECHNOLOGIES LIMITED', '₹1,83,250.50', '600000000005', 'Paid by Example Bank 0000'],
];
const PAGES = [TXNS.slice(0, 3), TXNS.slice(3)];

const header = (first) => `
  <div class="r" style="top:28px">Transaction statement</div>
  <div class="r small" style="top:46px">9000000000, someone@example.com</div>
  ${first ? `
  <div style="top:120px;left:24px">Transaction statement period</div>
  <div style="top:138px;left:24px">01 September 2026 - 30 September 2026</div>
  <div style="top:120px;left:349px">Sent</div><div style="top:138px;left:328px">₹1,93,668.50</div>
  <div style="top:120px;left:496px">Received</div><div style="top:138px;left:489px">₹3.09</div>` : ''}
  <div style="top:${first ? 200 : 100}px;left:24px">Date &amp; time</div>
  <div style="top:${first ? 200 : 100}px;left:135px">Transaction details</div>
  <div style="top:${first ? 200 : 100}px;left:536px">Amount</div>`;
const footer = (n) => `
  <div class="small" style="top:1040px;left:24px">Note: This statement reflects payments made by you on the Google Pay app. Self transfer payments are not included in the total money paid and</div>
  <div class="small" style="top:1052px;left:24px">received. Any payments transactions and activity deleted from your Google Account will not show up in this statement.</div>
  <div class="small" style="top:1090px;left:540px">Page ${n} of ${PAGES.length}</div>`;
const txn = ([date, time, desc, amount, id, instrument], top) => `
  <div style="top:${top}px;left:24px">${date}</div><div style="top:${top + 16}px;left:24px">${time}</div>
  <div style="top:${top}px;left:135px;width:330px">${desc}</div>
  <div style="top:${top + 34}px;left:135px">UPI Transaction ID: ${id}</div>
  <div style="top:${top + 50}px;left:152px">${instrument}</div>
  <div style="top:${top}px;left:530px">${amount}</div>`;

const html = `<!doctype html><html><head><style>
  @page { size: 595px 1123px; margin: 0 }
  body { margin: 0; font: 11px 'DejaVu Sans' }
  .page { position: relative; width: 595px; height: 1123px; page-break-after: always }
  .page div { position: absolute; white-space: normal }
  .r { left: 448px } .small { font-size: 8px }
</style></head><body>${PAGES.map((txns, i) => `<section class="page">${header(i === 0)}${
  txns.map((t, j) => txn(t, (i === 0 ? 240 : 140) + j * 90)).join('')}${footer(i + 1)}</section>`).join('')}</body></html>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.setContent(html);
const out = path.join(import.meta.dirname, '../src/domain/importers/fixtures/gpay-sample.pdf');
await page.pdf({ path: out, width: '595px', height: '1123px', printBackground: false });
await browser.close();
console.log('wrote', out);
