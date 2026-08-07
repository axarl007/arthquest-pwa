import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const raw = await page.evaluate(() => localStorage.getItem('arthquest.state'));
const parsed = JSON.parse(raw);
console.log('onboarded:', parsed.data.onboarded);
console.log('categories count:', parsed.data.categories.length);
console.log('incomeCategories count:', parsed.data.incomeCategories.length);
console.log('budgetAllocations count:', parsed.data.budgetAllocations.length);
console.log('sum of allocation percentages:', parsed.data.budgetAllocations.reduce((s, a) => s + a.percentage, 0));
console.log('sum of allocation amounts:', parsed.data.budgetAllocations.reduce((s, a) => s + a.amount, 0));

// Reload and confirm it lands on Home directly (not Onboarding) since onboarded=true persisted.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Body after reload:', JSON.stringify(bodyText.slice(0, 60)));

await browser.close();
