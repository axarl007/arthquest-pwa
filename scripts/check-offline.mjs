import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // let SW finish precaching

const context = page.context();
await context.setOffline(true);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Offline reload body text snippet:', JSON.stringify(bodyText.slice(0, 120)));
await page.screenshot({ path: '/tmp/shot-offline.png' });
await browser.close();
