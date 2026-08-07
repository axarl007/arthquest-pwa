import { chromium } from 'playwright';

const url = process.argv[2];
const out = process.argv[3];
const selector = process.argv[4];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator(selector).scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
await page.screenshot({ path: out });
console.log('Saved', out);
await browser.close();
