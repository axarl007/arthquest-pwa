import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);

// Force iconStyle to 'flat' directly in persisted state (Settings UI is ticket #6) and reload.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  raw.data.iconStyle = 'flat';
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-flat-style.png' });
console.log('Saved /tmp/shot-flat-style.png');

await browser.close();
