// QA for Google Pay PDF statement import (ticket #45), against a preview build:
//   npm run build && npx vite preview --port 4173 &  node scripts/qa-gpay-pdf-import.mjs
// Imports the synthetic fixture (scripts/gen-gpay-fixture.mjs) through Settings — fully offline,
// after the service worker has precached pdf.js's worker.
import { chromium } from 'playwright';
import path from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';
const fixture = path.join(import.meta.dirname, '../src/domain/importers/fixtures/gpay-sample.pdf');
const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: 400, height: 860 } });
const page = await context.newPage();
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
// Let the service worker install and precache everything (incl. the pdf.js worker).
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.reload({ waitUntil: 'networkidle' });

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(400);

const reviewText = async () => {
  await page.getByText('Review import').waitFor({ timeout: 15000 });
  const body = await page.locator('body').innerText();
  return body.slice(body.indexOf('Review import'));
};

await context.setOffline(true);
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(300);
await page.setInputFiles('input[aria-label="Bank statement file"]', fixture);
const text = await reviewText();
check('offline: PDF opens the review screen as Google Pay', text.includes('Google Pay statement · 5 new transactions'));
check('no unreadable rows', !text.includes("couldn't be read"));
check('wrapped payee joined', text.includes('ADYAR ANANDA BHAVAN SWEETS INDIA PRIVATE LIMITED BRANCH OFFICE'));
check('credit shown as income', text.includes('+₹3'));
check('amount with Indian grouping', text.includes('₹1,83,251'));
await page.screenshot({ path: '/tmp/shot-gpay-review.png' });

const pick = async (payee, category) => {
  await page.locator('[data-import-group]', { hasText: payee }).getByText('Choose a category').click();
  await page.getByPlaceholder('Search categories').fill(category);
  await page.locator('div[style*="sheetUp"]').getByText(category, { exact: true }).click();
};
for (const payee of ['Myntra', 'EKART', 'ADYAR', 'SHADOWFAX']) await pick(payee, 'Shopping');
await pick('Google Play', 'Other Income');
await page.getByRole('button', { name: /^Import 5/ }).click();
await page.waitForTimeout(300);
const data = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data);
const imported = data.transactions.filter((t) => t.externalId?.startsWith('gpay:'));
check('5 GPay transactions imported with gpay: externalIds', imported.length === 5);
check('paise preserved', imported.some((t) => t.amount === 183250.5) && imported.some((t) => t.amount === 3.09 && t.type === 'income'));

// A PDF that isn't a readable statement → a readable error, no review screen.
await page.getByText('Home', { exact: true }).click();
await page.locator('button[aria-label="Settings"]').click();
await page.setInputFiles('input[aria-label="Bank statement file"]', { name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 not really') });
await page.waitForTimeout(1500);
check('broken PDF shows a readable error', (await page.locator('body').innerText()).includes("Couldn't read that PDF"));

await browser.close();
