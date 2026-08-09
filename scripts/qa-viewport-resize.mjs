import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';
const TALL = { width: 390, height: 844 };  // "address bar hidden" — full height
const SHORT = { width: 390, height: 700 }; // "address bar shown" mid-session — simulates the
                                            // height Android Chrome's address-bar reveal
                                            // animation (e.g. during pull-to-refresh) produces

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: TALL });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Budget — same tall-content screen as qa-bottom-nav-pinning.mjs, so this also exercises the
// internal-scroll (flex:1/overflow:auto) path, not just a trivially short screen.
await page.getByText('Budget', { exact: true }).click();
await page.waitForTimeout(300);

async function readAppVh() {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim());
}

async function checkAtSize(label, size) {
  await page.setViewportSize(size);
  // Let the resize event fire and useViewportHeight's listener update --app-vh.
  await page.waitForTimeout(150);

  const appVh = await readAppVh();
  const fabBox = await page.locator('button[aria-label="Add"]').boundingBox();
  const docScrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const docClientHeight = await page.evaluate(() => document.documentElement.clientHeight);

  console.log(`[${label}] --app-vh reflects the new size (${appVh} ~= ${size.height}px):`, appVh === `${size.height}px`);
  console.log(`[${label}] FAB stays within the viewport (no scroll needed to reach it):`, !!fabBox && fabBox.y + fabBox.height <= size.height);
  console.log(`[${label}] No page-level overflow (scrollHeight <= clientHeight + 2):`, docScrollHeight <= docClientHeight + 2, `(scrollHeight=${docScrollHeight}, clientHeight=${docClientHeight})`);
}

// The scenario that distinguishes this bug from the earlier one: the viewport changes size
// WITHOUT a reload/remount, in both directions — this is what a real pull-to-refresh-triggered
// address-bar animation looks like, and a fresh cold start never exercises this at all.
await checkAtSize('shrink (address bar shown)', SHORT);
await checkAtSize('grow (address bar hidden again)', TALL);

await browser.close();
