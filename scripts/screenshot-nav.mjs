import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';
const width = Number(process.argv[3] || 430);
const height = Number(process.argv[4] || 900);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width, height } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

for (const label of ['Ledger', 'Budget', 'Quests']) {
  await page.getByText(label, { exact: true }).click();
  await page.waitForTimeout(200);
  const out = `/tmp/shot-${label.toLowerCase()}-${width}.png`;
  await page.screenshot({ path: out });
  console.log('Saved', out);
}
await browser.close();
