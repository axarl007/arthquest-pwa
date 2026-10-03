import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Push Groceries close to its allocated budget (₹9,600) to populate the "Close to your limit"
// list + its progress bar.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
let sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('9000');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Groceries');
await page.waitForTimeout(100);
await sheet.getByText('Groceries', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

// Log a quest contribution too, so "Saved (Quests)" is nonzero and distinct from Expenses.
await page.getByText('Quests', { exact: true }).click();
await page.waitForTimeout(300);
await page.locator('button:has(span:text("add"))').first().click();
await page.waitForTimeout(200);
await page.getByPlaceholder('Quest name (e.g. Goa Trip)').fill('Goa Trip');
await page.getByPlaceholder('Target amount').fill('50000');
await page.getByText('Create Quest', { exact: true }).click();
await page.waitForTimeout(300);

await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await sheet.getByRole('button', { name: 'Quest', exact: true }).click();
await page.getByPlaceholder('0').fill('5000');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await sheet.getByText('Goa Trip', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

await page.getByText('Home', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-home-hero.png', fullPage: true });

// innerText applies CSS text-transform, so headings styled uppercase come back upper-cased —
// compare case-insensitively rather than hardcoding the rendered case.
const body = (await page.evaluate(() => document.body.innerText)).toLowerCase();
console.log('Monthly summary is the primary hero:', body.includes('monthly summary'));
console.log('Hero shows Saved (Quests):', body.includes('saved (quests)'));
console.log('Hero shows Net leftover:', body.includes('net leftover'));
console.log('Cumulative position renders as a secondary card:', body.includes('cumulative position'));
console.log('Close to your limit section renders:', body.includes('close to your limit'));

const barWidth = await page.evaluate(() => {
  const heading = Array.from(document.querySelectorAll('div')).find((d) => d.textContent.trim() === 'Close to your limit');
  const bar = heading?.parentElement.querySelector('div[style*="border-radius: 3px"] > div');
  return bar ? bar.style.width : null;
});
console.log('Near-limit row renders a progress bar with a nonzero width:', barWidth, barWidth !== '0%');

await browser.close();
