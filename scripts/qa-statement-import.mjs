// Visual/behavioral QA for statement import (ticket #36). Run against a preview build:
//   npm run build && npx vite preview --port 4173 &  node scripts/qa-statement-import.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';
const HEADER = 'Date,Time,Transaction Details,Transaction ID,UTR,Transaction Type,Credit/debit instrument,Amount';
const statementPath = '/tmp/qa-phonepe-statement.csv';
fs.writeFileSync(statementPath, [
  'Transaction Statement for 9000000000',
  'Duration,"01 Oct, 2026 - 31 Oct, 2026"',
  '',
  HEADER,
  '"Oct 03, 2026","09:09 am","Paid to Mr RAVI KUMAR G","TQA1","U1","DEBIT","Paid by XXXXXX0000","800"',
  '"Oct 02, 2026","05:53 pm","Paid to Home Centre","TQA2","U2","DEBIT","Paid by XXXXXX0000","1274"',
  '"Oct 02, 2026","10:00 am","Paid to Home Centre","TQA3","U3","DEBIT","Paid by XXXXXX0000","226"',
  '"Oct 01, 2026","01:05 pm","Received from Priya S","TQA4","U4","CREDIT","Credited to XXXXXX0000","5,000"',
  '',
  'This is an automatically generated statement.',
].join('\n'));
const junkPath = '/tmp/qa-not-a-statement.csv';
fs.writeFileSync(junkPath, 'hello,world\n1,2\n');

const check = (label, ok) => console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 400, height: 860 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);

// Unrecognized file → error, stays on Settings.
await page.setInputFiles('input[aria-label="Bank statement file"]', junkPath);
await page.waitForTimeout(300);
check('unrecognized file shows error', (await page.locator('body').innerText()).includes('Unrecognized file — supported: PhonePe'));

// Real statement → review screen.
await page.setInputFiles('input[aria-label="Bank statement file"]', statementPath);
await page.waitForTimeout(300);
let body = await page.locator('body').innerText();
check('review screen opens', body.includes('Review import') && body.includes('PhonePe statement · 4 new transactions'));
check('groups repeated payee', body.includes('×2 · ₹1,500'));
check('submit blocked with counter', body.includes('4 need a category'));
await page.screenshot({ path: '/tmp/shot-import-review.png' });

const groupCard = (payee) => page.locator('[data-import-group]', { hasText: payee });
const pick = async (payee, category) => {
  await groupCard(payee).getByText(/Choose a category|Mixed — tap to set all/).click();
  await page.getByPlaceholder('Search categories').fill(category);
  await page.locator('div[style*="sheetUp"]').getByText(category, { exact: true }).click();
  await page.waitForTimeout(100);
};

await pick('Home Centre', 'Shopping');
await pick('RAVI KUMAR', 'Dining Out');
body = await page.locator('body').innerText();
check('counter updates after group assignment', body.includes('1 needs a category'));
check('credit row defaults to Income', (await groupCard('Priya S').locator('button[aria-pressed="true"]').innerText()) === 'Income');
await pick('Priya S', 'Freelance');

// Override one Home Centre row and skip nothing else.
await groupCard('Home Centre').getByText('Show 2 rows').click();
await groupCard('Home Centre').locator('input[type="checkbox"]').nth(1).uncheck();
await page.waitForTimeout(100);
body = await page.locator('body').innerText();
check('skipping a row updates footer total', body.includes('Import 3 · ₹7,074'));
await page.screenshot({ path: '/tmp/shot-import-ready.png' });

await page.getByRole('button', { name: /^Import 3/ }).click();
await page.waitForTimeout(300);
let data = await stored(page);
const imported = data.transactions.filter((t) => t.externalId);
check('3 transactions imported', imported.length === 3);
const byExt = Object.fromEntries(imported.map((t) => [t.externalId, t]));
check('expense written with payee description', byExt['phonepe:TQA2']?.type === 'expense' && byExt['phonepe:TQA2'].description === 'Home Centre' && byExt['phonepe:TQA2'].amount === 1274);
check('income written to income category', byExt['phonepe:TQA4']?.type === 'income' && !!byExt['phonepe:TQA4'].incomeCategoryId && byExt['phonepe:TQA4'].categoryId === null);
check('skipped row not imported', !byExt['phonepe:TQA3']);
check('same-day order preserved via createdAt', byExt['phonepe:TQA4'].createdAt < byExt['phonepe:TQA2'].createdAt && byExt['phonepe:TQA2'].createdAt < byExt['phonepe:TQA1'].createdAt);
body = await page.locator('body').innerText();
check('lands on transactions list showing imports', body.includes('Home Centre') && body.includes('RAVI KUMAR'));
await page.screenshot({ path: '/tmp/shot-import-done.png' });

// Re-import: the three imported rows are hidden; the skipped one is still offered.
await page.locator('button[aria-label="Settings"]').click().catch(() => {});
if (!(await page.locator('body').innerText()).includes('Import bank statement')) {
  await page.getByText('Home', { exact: true }).click();
  await page.locator('button[aria-label="Settings"]').click();
}
await page.waitForTimeout(200);
await page.setInputFiles('input[aria-label="Bank statement file"]', statementPath);
await page.waitForTimeout(300);
body = await page.locator('body').innerText();
check('re-import hides already-imported rows', body.includes('3 already imported, hidden') && body.includes('1 new transaction'));
await page.getByRole('button', { name: 'Back' }).click();
await page.waitForTimeout(200);
check('back returns to Settings', (await page.locator('body').innerText()).includes('Import bank statement'));

// #37: a later statement with the same payees is prefilled from memory.
const nextMonthPath = '/tmp/qa-phonepe-statement-nov.csv';
fs.writeFileSync(nextMonthPath, [
  HEADER,
  '"Nov 02, 2026","11:00 am","Paid to HOME CENTRE","TQA5","U5","DEBIT","Paid by XXXXXX0000","999"',
  '"Nov 01, 2026","08:00 am","Paid to Ravi Kumar G","TQA6","U6","DEBIT","Paid by XXXXXX0000","120"',
  '"Nov 01, 2026","07:00 am","Paid to Brand New Shop","TQA7","U7","DEBIT","Paid by XXXXXX0000","60"',
].join('\n'));
data = await stored(page);
check('payee memory learned on submit', data.payeeCategoryMap['debit:home centre']?.type === 'expense' && !!data.payeeCategoryMap['credit:priya s']);
await page.setInputFiles('input[aria-label="Bank statement file"]', nextMonthPath);
await page.waitForTimeout(300);
body = await page.locator('body').innerText();
check('known payees prefilled, only the new one needs a category', body.includes('1 needs a category'));
check('prefilled groups say remembered', (await groupCard('HOME CENTRE').innerText()).includes('Remembered from a previous import')
  && (await groupCard('HOME CENTRE').innerText()).includes('Shopping'));
check('new payee not labelled remembered', !(await groupCard('Brand New Shop').innerText()).includes('Remembered'));
await page.screenshot({ path: '/tmp/shot-import-prefilled.png' });

// #38: undo the batch — rows tombstoned, memory restored, file importable again.
await pick('Brand New Shop', 'Groceries');
await page.getByRole('button', { name: /^Import 3/ }).click();
await page.waitForTimeout(300);
check('undo toast shown after import', (await page.getByRole('status').innerText()).includes('Imported 3 transactions'));
await page.screenshot({ path: '/tmp/shot-import-toast.png' });
data = await stored(page);
check('new payee learned before undo', !!data.payeeCategoryMap['debit:brand new shop']);
await page.getByRole('status').getByText('Undo', { exact: true }).click();
await page.waitForTimeout(300);
data = await stored(page);
const novRows = data.transactions.filter((t) => ['phonepe:TQA5', 'phonepe:TQA6', 'phonepe:TQA7'].includes(t.externalId));
check('undo tombstones the batch', novRows.length === 3 && novRows.every((t) => t.deletedAt));
check('undo leaves earlier imports alone', data.transactions.filter((t) => t.externalId && !t.deletedAt).length === 3);
check('undo clears newly learned payee', data.payeeCategoryMap['debit:brand new shop']?.categoryId === null);
check('undo keeps memory from the earlier import', data.payeeCategoryMap['debit:home centre']?.categoryId === byExt['phonepe:TQA2'].categoryId);
check('toast gone after undo', (await page.getByRole('status').count()) === 0);
body = await page.locator('body').innerText();
check('undone rows gone from list', !body.includes('Brand New Shop'));

await page.getByText('Home', { exact: true }).click();
await page.waitForTimeout(200);
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);
await page.setInputFiles('input[aria-label="Bank statement file"]', nextMonthPath);
await page.waitForTimeout(300);
check('undone rows importable again', (await page.locator('body').innerText()).includes('3 new transactions'));
await pick('Brand New Shop', 'Groceries');
await page.getByRole('button', { name: /^Import 3/ }).click();
await page.waitForTimeout(10600);
check('toast auto-dismisses after ~10s', (await page.getByRole('status').count()) === 0);

await browser.close();
