import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const incomeInput = page.locator('input[inputmode="numeric"]');
await incomeInput.click();
await incomeInput.type('120000');
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/shot-onboarding-income.png' });

const inputValue = await incomeInput.inputValue();
console.log('income input value after typing 120000:', JSON.stringify(inputValue));

// bump Housing up by 2, then back down by 2 — net zero, stays at exactly 100% allocated,
// exercising both +/- handlers while keeping the finish button enabled for the next step.
const housingRow = page.getByText('Housing', { exact: true }).locator('xpath=ancestor::div[2]');
await housingRow.getByRole('button').nth(1).click();
await housingRow.getByRole('button').nth(1).click();
await page.waitForTimeout(100);
await page.screenshot({ path: '/tmp/shot-onboarding-adjusted.png' });
await housingRow.getByRole('button').nth(0).click();
await housingRow.getByRole('button').nth(0).click();
await page.waitForTimeout(100);

const finishBtn = page.getByText('Get started', { exact: true });
console.log('Get started disabled attr:', await finishBtn.getAttribute('disabled'));
await finishBtn.click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-after-finish.png' });
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Body after finish:', JSON.stringify(bodyText.slice(0, 200)));

const raw = await page.evaluate(() => localStorage.getItem('arthquest.state'));
const parsed = JSON.parse(raw);
console.log('onboarded:', parsed.data.onboarded);
console.log('budgetAllocations count:', parsed.data.budgetAllocations.length);
console.log('sum of allocation percentages:', parsed.data.budgetAllocations.reduce((s, a) => s + a.percentage, 0));
console.log('sum of allocation amounts:', parsed.data.budgetAllocations.reduce((s, a) => s + a.amount, 0));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const afterReload = await page.evaluate(() => document.body.innerText);
console.log('Body after reload (should stay on Home, not Onboarding):', JSON.stringify(afterReload.slice(0, 60)));

await browser.close();
