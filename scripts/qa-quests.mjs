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

// Quests tab, empty state.
await page.getByText('Quests', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-quests-empty.png' });

// Create a quest with a small target so it's easy to fully fund.
await page.locator('button[aria-label="New quest"]').click();
await page.waitForTimeout(200);
let sheet = page.locator('div[style*="sheetUp"]');
await sheet.getByPlaceholder('Quest name (e.g. Goa Trip)').fill('Goa Trip');
await sheet.getByPlaceholder('Target amount').fill('5000');
await page.screenshot({ path: '/tmp/shot-new-quest-sheet.png' });
await sheet.getByText('Create Quest', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-quests-active.png' });

const bodyAfterCreate = await page.evaluate(() => document.body.innerText);
console.log('Quests screen shows the new quest:', bodyAfterCreate.includes('Goa Trip'));
console.log('Home carousel unaffected check (still on Quests tab, skip)');

// Open quest detail.
await page.getByText('Goa Trip', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-quest-detail-active.png' });

// Add a partial contribution via "Add contribution" -> LogTransactionSheet pre-scoped to this quest.
await page.getByText('Add contribution', { exact: true }).click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await page.screenshot({ path: '/tmp/shot-log-sheet-quest-prescoped.png' });
await page.getByPlaceholder('0').fill('2000');
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-quest-detail-40pct.png' });

const detailBody40 = await page.evaluate(() => document.body.innerText);
console.log('Quest detail shows 40% funded:', detailBody40.includes('40%'));
console.log('Quest detail shows "Redeem early" link:', detailBody40.includes('Redeem early'));

// Fully fund it — via the same "Add contribution" entry point (the global FAB is covered by the
// quest-detail overlay while this subscreen is open, matching "no bottom nav/FAB on subscreens").
await page.getByText('Add contribution', { exact: true }).click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('3000');
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-quest-detail-completed.png' });

const detailBodyCompleted = await page.evaluate(() => document.body.innerText);
console.log('Quest auto-completed at 100%:', detailBodyCompleted.includes('Completed'));
console.log('Redeem button shows full amount:', detailBodyCompleted.includes('Redeem ₹5,000'));

// Redeem it.
await page.getByText('Redeem ₹5,000', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-redeem-confirm.png' });
await page.getByText('Yes, redeem it', { exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-redeem-just-confirmed.png' });

const raw1 = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')));
const quest1 = raw1.data.categories.find((c) => c.name === 'Goa Trip');
console.log('Quest status is redeemed immediately after confirm:', quest1.questStatus === 'redeemed');
console.log('Quest has a redeemedDate:', !!quest1.questRedeemedDate);
const redemptionTx = raw1.data.transactions.find((t) => t.isRedemption);
console.log('Redemption transaction logged with correct amount:', redemptionTx?.amount === 5000);

await page.waitForTimeout(2300);
await page.screenshot({ path: '/tmp/shot-celebration.png' });
const bodyCelebration = await page.evaluate(() => document.body.innerText);
console.log('Celebration overlay shown:', bodyCelebration.includes('Redeemed!'));

await page.waitForTimeout(3200);
await page.screenshot({ path: '/tmp/shot-after-celebration.png' });
const bodyAfterCelebration = await page.evaluate(() => document.body.innerText);
console.log('Celebration overlay auto-dismissed:', !bodyAfterCelebration.includes('Redeemed!'));

// Back to Quests list, check Redeemed section.
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-quests-redeemed-section.png' });
const questsBody = await page.evaluate(() => document.body.innerText);
console.log('Quests screen shows Redeemed section:', questsBody.includes('Redeemed'));

// Check Home carousel no longer shows the redeemed quest (only active/completed).
await page.getByText('Home', { exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-home-no-carousel.png' });
const homeBody = await page.evaluate(() => document.body.innerText);
console.log('Home carousel hides redeemed quest:', !homeBody.includes('Goa Trip'));

// Zero-contribution quest can still be redeemed early — mirrors QuestsScreen.kt/QuestRepository,
// which have no minimum-contribution gate on Redeem (unlike the mockup's guessed rule).
await page.getByText('Quests', { exact: true }).click();
await page.waitForTimeout(200);
await page.locator('button[aria-label="New quest"]').click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await sheet.getByPlaceholder('Quest name (e.g. Goa Trip)').fill('Emergency Fund Quest');
await sheet.getByPlaceholder('Target amount').fill('20000');
await sheet.getByText('Create Quest', { exact: true }).click();
await page.waitForTimeout(300);
await page.getByText('Emergency Fund Quest', { exact: true }).click();
await page.waitForTimeout(200);
const zeroBody = await page.evaluate(() => document.body.innerText);
console.log('Redeem-early link shown even at 0% contributed:', zeroBody.includes('Redeem early'));

// Fully fund it, then redeem directly from the Quests list's "Redeem" pill (a separate tap
// target from the card's own onClick, mirroring QuestsScreen.kt's onRedeem callback).
await page.getByText('Add contribution', { exact: true }).click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await page.getByPlaceholder('0').fill('20000');
await sheet.getByText('Save transaction', { exact: true }).click();
await page.waitForTimeout(300);
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Redeem', exact: true }).click();
await page.waitForTimeout(300);
const listRedeemBody = await page.evaluate(() => document.body.innerText);
console.log('Tapping list Redeem pill opens confirmation directly:', listRedeemBody.includes('Redeem Emergency Fund Quest?'));
await page.getByText('Yes, redeem it', { exact: true }).click();
await page.waitForTimeout(300);
const rawList = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')));
const listQuest = rawList.data.categories.find((c) => c.name === 'Emergency Fund Quest');
console.log('Quest redeemed via list pill:', listQuest.questStatus === 'redeemed');
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(200);

// AddCategorySheet's Quest branch: no icon grid/requirement (Quests always use a fixed icon),
// hands off to New Quest sheet pre-filled with the typed name.
await page.getByText('Budget', { exact: true }).click();
await page.waitForTimeout(200);
await page.locator('button[aria-label="Budget actions"]').click();
await page.waitForTimeout(200);
await page.getByText('+ Add category', { exact: true }).click();
await page.waitForTimeout(200);
sheet = page.locator('div[style*="sheetUp"]');
await sheet.getByPlaceholder('Category name').fill('Wedding Fund');
await sheet.getByRole('button', { name: 'Quest', exact: true }).click();
await page.waitForTimeout(100);
await page.screenshot({ path: '/tmp/shot-addcategory-quest-no-icons.png' });
const addCatBody = await page.evaluate(() => document.body.innerText);
console.log('Icon grid hidden for Quest type:', !addCatBody.includes("Type can't be changed once created"));
await sheet.getByText('Add', { exact: true }).click();
await page.waitForTimeout(300);
const nameValue = await page.locator('input[placeholder="Quest name (e.g. Goa Trip)"]').inputValue();
console.log('New Quest sheet pre-filled with the name from AddCategorySheet:', nameValue === 'Wedding Fund');

await browser.close();
