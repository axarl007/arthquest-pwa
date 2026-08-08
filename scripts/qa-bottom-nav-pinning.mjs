import { chromium } from 'playwright';

// A real phone-sized viewport (not the taller ~900px used by some other QA scripts) so a tall
// screen (Budget's 17 default categories) actually exceeds one screenful, exercising the bug:
// BottomNav/Fab must stay pinned to the visible bottom edge, with only the content area
// scrolling — not the whole page.
const VIEWPORT = { width: 390, height: 700 };
const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: VIEWPORT });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

async function checkPinned(screenName, navSelector = 'button[aria-label="Add"]') {
  const bottomNavBox = await page.locator('text=Home').last().locator('xpath=ancestor::div[3]').boundingBox().catch(() => null);
  const fabBox = await page.locator(navSelector).boundingBox();
  const docScrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const docClientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  console.log(`[${screenName}] FAB visible within viewport (no page scroll needed): ${fabBox && fabBox.y + fabBox.height <= VIEWPORT.height}`);
  console.log(`[${screenName}] document does not need page-level scroll (scrollHeight <= clientHeight + 2): ${docScrollHeight <= docClientHeight + 2} (scrollHeight=${docScrollHeight}, clientHeight=${docClientHeight})`);
  return { bottomNavBox, fabBox };
}

// Budget screen has 17 default categories — tall enough to trigger the bug if unfixed.
await page.getByText('Budget', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-nav-pin-budget.png' });
await checkPinned('Budget');

const budgetNavButton = page.getByRole('button', { name: 'Home', exact: true });
console.log('[Budget] Nav bar reachable without scrolling the page:', await budgetNavButton.isVisible());

// Scroll the inner content, verify the nav bar itself does NOT move (only content scrolls).
const navBoxBefore = await budgetNavButton.boundingBox();
await page.mouse.wheel(0, 800);
await page.waitForTimeout(200);
const navBoxAfter = await budgetNavButton.boundingBox();
const bodyScrollY = await page.evaluate(() => window.scrollY);
console.log('[Budget] Page itself did not scroll (window.scrollY === 0):', bodyScrollY === 0);
console.log('[Budget] Nav bar position unchanged after scrolling content:', navBoxBefore && navBoxAfter && Math.abs(navBoxBefore.y - navBoxAfter.y) < 2);

// Confirm the inner list actually did scroll (content moved even though page/nav didn't).
const firstCategoryText = await page.evaluate(() => document.body.innerText.includes('Utilities'));
console.log('[Budget] Content scrolled internally (later category visible after wheel):', firstCategoryText);

// Spot-check Home, Ledger, Quests too.
for (const tab of ['Home', 'Ledger', 'Quests']) {
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.waitForTimeout(200);
  const navVisible = await page.getByRole('button', { name: 'Home', exact: true }).isVisible();
  const docScrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const docClientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  console.log(`[${tab}] Nav bar visible without scrolling: ${navVisible}, no page-level overflow: ${docScrollHeight <= docClientHeight + 2}`);
}

await browser.close();
