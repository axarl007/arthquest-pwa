import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

const NEW_ICON_NAMES = [
  'bolt', 'account_balance', 'shield', 'health_and_safety', 'trending_up', 'umbrella', 'savings', 'redeem',
  'key', 'cleaning_services', 'smartphone', 'handyman', 'car_repair', 'interests', 'subscriptions',
  'autorenew', 'real_estate_agent', 'help',
];

// Onboarding's own FAB opens AddCategorySheet directly, no need to finish onboarding first.
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(300);

const iconButtonCount = await page.locator('div[style*="flex-wrap"] button').count();
console.log(`Icon picker renders all ${iconButtonCount} ICON_OPTIONS entries (default Cartoon style):`, iconButtonCount === 53);

// Cartoon style: every icon button's <img> must actually load (not a 404'd broken image).
const brokenCartoonImgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img')).filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.src));
console.log('No broken Twemoji <img> sources in Cartoon style:', brokenCartoonImgs.length === 0, brokenCartoonImgs);

await page.screenshot({ path: '/tmp/shot-icon-picker-cartoon.png', fullPage: true });

// Switch to Flat style mid-session and confirm every new icon name still resolves to a rendered glyph.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  raw.data.iconStyle = 'flat';
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('button[aria-label="Add"]').click();
await page.waitForTimeout(300);

const glyphTexts = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.material-symbols-outlined')).map((el) => el.textContent.trim()));
const allNewIconsPresent = NEW_ICON_NAMES.every((name) => glyphTexts.includes(name));
console.log('Every new icon name renders as a Material Symbols glyph in Flat style:', allNewIconsPresent);

await page.screenshot({ path: '/tmp/shot-icon-picker-flat.png', fullPage: true });

await browser.close();
