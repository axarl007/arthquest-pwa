import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, acceptDownloads: true });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Log a transaction so there's something to export/lose on reset.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
let sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('1200');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Groceries');
await page.waitForTimeout(100);
await sheet.getByText('Groceries', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);

// Export JSON, capture the download.
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export as JSON/ }).click(),
]);
const jsonPath = '/tmp/qa-arthquest-backup.json';
await download.saveAs(jsonPath);
const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log('Export includes categories/transactions/settings:', !!exported.categories && !!exported.transactions && !!exported.settings);
console.log('Export uses Android-schema uppercase enums:', exported.categories[0].type === 'BUDGET');

// Export CSV too, just confirm it downloads with the right header.
const [csvDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Export as CSV/ }).click(),
]);
const csvPath = '/tmp/qa-arthquest-transactions.csv';
await csvDownload.saveAs(csvPath);
const csv = fs.readFileSync(csvPath, 'utf8');
console.log('CSV export has the right header:', csv.startsWith('Date,Type,Category,Description,Amount'));

// Reset all data: two-step confirmation.
await page.getByRole('button', { name: /Reset all data/ }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-reset-step1.png' });
const step1Body = await page.evaluate(() => document.body.innerText);
console.log('Reset step 1 shows first warning:', step1Body.includes('Reset all data?'));
await page.getByText('Continue', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-reset-step2.png' });
const step2Body = await page.evaluate(() => document.body.innerText);
console.log('Reset step 2 shows final warning:', step2Body.includes('Are you absolutely sure?'));
await page.getByText('Yes, erase everything', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-after-reset.png' });

const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data);
// categories re-populate immediately because landing back on Onboarding re-seeds the defaults
// (the same seedDefaultsIfNeeded() a real first-run hits) — transactions/budgetAllocations don't
// get any such re-seed, so they're the definitive "the old data is actually gone" signal.
console.log('Reset clears transactions and allocations:', afterReset.transactions.length === 0 && afterReset.budgetAllocations.length === 0);
console.log('Reset preserves theme:', afterReset.theme === 'dark');
console.log('Reset navigates back to onboarding:', afterReset.onboarded === false);
const onboardingBody = await page.evaluate(() => document.body.innerText);
console.log('Onboarding screen shown after reset:', onboardingBody.includes("Let’s plan your money") || onboardingBody.includes('plan your money'));

// Re-onboard, then import the earlier JSON backup and verify it restores everything.
await page.locator('input[inputmode="numeric"]').first().type('50000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);
await page.locator('button:has-text("Import JSON backup")').click();
await page.setInputFiles('input[type="file"]', jsonPath);
await page.waitForTimeout(400);
const afterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data);
console.log('Import restores transaction count:', afterImport.transactions.length === exported.transactions.length);
console.log('Import restores category colors:', afterImport.categories.every((c) => !!c.color));

await browser.close();
