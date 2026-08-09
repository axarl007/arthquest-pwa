import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// Finish onboarding with the default split.
await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Go to Budget tab.
await page.getByText('Budget', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-budget-empty-spend.png' });

// Log an expense against Groceries (needs group) to make it yellow/tracked.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
let sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('7000');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Groceries');
await page.waitForTimeout(100);
await sheet.getByText('Groceries', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

// Log an overspend against Shopping (wants group).
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('20000');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Shopping');
await page.waitForTimeout(100);
await sheet.getByText('Shopping', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

await page.screenshot({ path: '/tmp/shot-budget-with-spend.png', fullPage: true });

const body1 = await page.evaluate(() => document.body.innerText);
console.log('Budget shows Needs group:', body1.includes('Needs'));
console.log('Budget shows Groceries:', body1.includes('Groceries'));
console.log('Budget shows over-budget Shopping:', body1.includes('Shopping'));

// Filter to "Over budget".
await page.getByText('Over budget', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-budget-filter-over.png' });
const bodyFiltered = await page.evaluate(() => document.body.innerText);
console.log('Filtered view still shows Shopping:', bodyFiltered.includes('Shopping'));
console.log('Filtered view hides Groceries:', !bodyFiltered.includes('Groceries'));

await page.getByText('All', { exact: true }).click();
await page.waitForTimeout(200);

// Open category detail for Groceries.
await page.getByText('Groceries', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-category-detail.png' });
const detailBody = await page.evaluate(() => document.body.innerText);
console.log('Category detail shows transactions heading:', detailBody.includes("This month's transactions"));
console.log('Category detail shows the expense amount:', detailBody.includes('-₹7,000'));

// Back to Budget.
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);

// Budget actions sheet -> Add category.
await page.locator('button[aria-label="Budget actions"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-budget-actions-sheet.png' });
await page.getByText('+ Add category', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-add-category-sheet.png' });
await page.getByPlaceholder('Category name').fill('Pet Supplies');
await page.getByText('celebration', { exact: false }).first(); // no-op, just ensure grid rendered
const iconButtons = page.locator('div[style*="sheetUp"] >> div[style*="flex-wrap"] button');
await iconButtons.nth(3).click();
await page.screenshot({ path: '/tmp/shot-add-category-filled.png' });
await page.getByText('Add', { exact: true }).click();
await page.waitForTimeout(300);
const bodyAfterAdd = await page.evaluate(() => document.body.innerText);
console.log('New category "Pet Supplies" appears in Budget:', bodyAfterAdd.includes('Pet Supplies'));

// Month navigation: go to previous month, expect a locked banner and no rows (fresh state,
// allocations only seeded for current month via onboarding).
await page.locator('button[aria-label="Previous month"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-budget-prev-month.png' });
const prevBody = await page.evaluate(() => document.body.innerText);
console.log('Previous month shows locked banner:', prevBody.includes('locked'));

await browser.close();
