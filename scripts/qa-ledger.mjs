import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// Finish onboarding quickly with the default 100% split.
await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Go to Ledger tab.
await page.getByText('Ledger', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-ledger-empty.png' });

// Open the Add Transaction sheet via FAB, log an expense against Groceries.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
await page.getByPlaceholder('0').fill('850');
await page.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Groceries');
await page.waitForTimeout(100);
await page.getByText('Groceries', { exact: true }).click();
await page.getByPlaceholder('Description (optional)').fill('Morning grocery run');
await page.waitForTimeout(100);
await page.screenshot({ path: '/tmp/shot-log-sheet-filled.png' });
await page.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-ledger-with-tx.png' });

const bodyAfterSave = await page.evaluate(() => document.body.innerText);
console.log('Ledger after save contains "Groceries":', bodyAfterSave.includes('Groceries'));
console.log('Ledger after save contains "-₹850":', bodyAfterSave.includes('-₹850'));
console.log('Ledger after save contains "Morning grocery run":', bodyAfterSave.includes('Morning grocery run'));

// Log an income transaction too, to check the summary strip + filter.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
const sheet = page.locator('div[style*="sheetUp"]');
await sheet.getByRole('button', { name: 'Income', exact: true }).click();
await page.getByPlaceholder('0').fill('120000');
await page.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByText('Salary', { exact: true }).click();
await page.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-ledger-with-income.png' });

const raw = await page.evaluate(() => localStorage.getItem('arthquest.state'));
const parsed = JSON.parse(raw);
console.log('transactions count:', parsed.data.transactions.length);

// Delete the expense transaction via tx-actions sheet.
await page.getByText('Groceries', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-tx-actions.png' });
await page.getByText('Delete transaction', { exact: true }).click();
await page.waitForTimeout(300);
const bodyAfterDelete = await page.evaluate(() => document.body.innerText);
console.log('Ledger after delete still contains "Groceries":', bodyAfterDelete.includes('Groceries'));
await page.screenshot({ path: '/tmp/shot-ledger-after-delete.png' });

await browser.close();
