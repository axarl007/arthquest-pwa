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

// Log an expense so Home's monthly summary/close-to-limit have something to show, and a big
// enough one against a small-allocation category to trigger "close to your limit".
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(200);
let sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('5500');
await sheet.getByText('Choose a category', { exact: true }).click();
await page.waitForTimeout(100);
await page.getByPlaceholder('Search categories').fill('Healthcare');
await page.waitForTimeout(100);
await sheet.getByText('Healthcare', { exact: true }).click();
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);

await page.getByRole('button', { name: 'Home', exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-home-full.png', fullPage: true });
// innerText reflects CSS text-transform (the section labels use uppercase), so compare case-insensitively.
const homeBody = (await page.evaluate(() => document.body.innerText)).toLowerCase();
console.log('Home shows cumulative position:', homeBody.includes('cumulative position'));
console.log('Home shows monthly income/expense/net strip:', homeBody.includes('income') && homeBody.includes('expense') && homeBody.includes('net'));
console.log('Home shows close-to-your-limit section:', homeBody.includes('close to your limit'));
console.log('Home shows the over-budget Healthcare category:', homeBody.includes('healthcare'));

// Tap cumulative position to reveal the explanation.
await page.getByText('Cumulative position', { exact: false }).click();
await page.waitForTimeout(150);
const explainBody = await page.evaluate(() => document.body.innerText);
console.log('Cumulative explanation toggles on tap:', explainBody.includes('not a running balance'));

// Open Settings from Home's menu button.
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-settings-main.png', fullPage: true });
const settingsBody = (await page.evaluate(() => document.body.innerText)).toLowerCase();
console.log('Settings shows all 5 sections:', ['appearance', 'reminders', 'data', 'manage', 'danger zone'].every((s) => settingsBody.includes(s)));

// Toggle Vibrant theme, verify it applies immediately (page background changes to light).
await page.getByText('Vibrant', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-settings-vibrant.png' });
const rawTheme = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.theme);
console.log('Theme toggle persisted:', rawTheme === 'vibrant');
await page.getByText('Dark', { exact: true }).click();
await page.waitForTimeout(200);

// Toggle a reminder off then back on (checks the on/off visual + no crash from permission call).
await page.getByRole('switch', { name: 'Daily log reminder' }).click();
await page.waitForTimeout(100);
const afterOff = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.settingsToggles.daily);
console.log('Reminder toggle turns off:', afterOff === false);
await page.getByRole('switch', { name: 'Daily log reminder' }).click();
await page.waitForTimeout(100);
const afterOn = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.settingsToggles.daily);
console.log('Reminder toggle turns back on:', afterOn === true);

// Manage categories -> Categories screen.
await page.getByText('Manage categories', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-categories-expense-tab.png', fullPage: true });
const catBody = await page.evaluate(() => document.body.innerText);
console.log('Categories screen shows Needs/Wants/Savings groups:', ['Needs', 'Wants', 'Savings'].every((g) => catBody.includes(g)));
console.log('Categories screen shows Archive buttons:', catBody.includes('Archive'));

// Archive a category, verify opacity/label flip.
await page.getByText('Archive', { exact: true }).first().click();
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/shot-categories-archived.png' });
const archivedBody = await page.evaluate(() => document.body.innerText);
console.log('Archiving flips the button to Unarchive:', archivedBody.includes('Unarchive'));

// Income tab.
await page.getByRole('button', { name: 'Income', exact: true }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/shot-categories-income-tab.png' });
const incomeBody = await page.evaluate(() => document.body.innerText);
console.log('Income tab shows Salary:', incomeBody.includes('Salary'));

// Back to Settings, then to Home.
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);
const homeAfterBack = (await page.evaluate(() => document.body.innerText)).toLowerCase();
console.log('Back navigation returns to Home:', homeAfterBack.includes('cumulative position'));

await browser.close();
