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

let body = await page.evaluate(() => document.body.innerText);
console.log('Unpaired Home shows no sync indicator:', !body.includes('Not yet synced') && !body.includes('Synced'));

// Paired, never synced, pairing just happened (not stale yet) — indicator only, no nudge.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  raw.data.pairedDevice = { id: 'other-device-id', name: "Wife's Phone", pairedAt: Date.now(), lastSyncedAt: null };
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
body = await page.evaluate(() => document.body.innerText);
console.log('Paired + never synced shows "Not yet synced":', body.includes('Not yet synced'));
console.log('Freshly paired (not stale) shows no nudge banner:', !body.includes('to sync your latest changes'));

// Paired long ago, never synced, with a real pending change (an expense) — stale + pending -> nudge.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  const dayMs = 24 * 60 * 60 * 1000;
  raw.data.pairedDevice = { id: 'other-device-id', name: "Wife's Phone", pairedAt: Date.now() - 2 * dayMs, lastSyncedAt: null };
  raw.data.transactions.push({
    id: 'qa-tx-1', type: 'expense', amount: 500, date: '2026-08-01', createdAt: Date.now() - dayMs,
    categoryId: raw.data.categories.find((c) => c.type === 'budget').id, incomeCategoryId: null,
    description: 'QA expense', isRedemption: false, deletedAt: null,
  });
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-home-stale-nudge.png', fullPage: true });
body = await page.evaluate(() => document.body.innerText);
console.log('Stale + pending shows the nudge banner naming the paired device:', body.includes("Open the app on Wife's Phone to sync"));
// Pending count includes onboarding's own seeded categories/allocations (created "now", after the
// backdated pairedAt/lastSyncedAt below), not just the one injected transaction — a bare positive
// count is the correct assertion here, not a hardcoded "1".
console.log('Stale + pending shows a positive pending count in the indicator:', /Not yet synced · [1-9]\d* pending/.test(body));

// A successful sync (lastSyncedAt now covers everything) — pending clears immediately, nudge gone.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  raw.data.pairedDevice = { ...raw.data.pairedDevice, lastSyncedAt: Date.now() };
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-home-synced.png', fullPage: true });
body = await page.evaluate(() => document.body.innerText);
console.log('After a fresh sync, indicator shows "Synced just now" with no pending suffix:', body.includes('Synced just now') && !body.includes('pending'));
console.log('After a fresh sync, the nudge banner is gone:', !body.includes('to sync your latest changes'));

// Tapping the indicator navigates to the Pairing screen.
await page.getByText('Synced just now', { exact: false }).click();
await page.waitForTimeout(300);
body = await page.evaluate(() => document.body.innerText);
console.log('Tapping the sync indicator opens the Pairing screen:', body.includes('Pair a device') || body.includes("Paired with Wife's Phone"));

// Backing out of Pairing opened this way (skipping Settings entirely) must return to Home, not
// strand the user on a Settings main menu they never visited.
await page.locator('button[aria-label="Back"]').click();
await page.waitForTimeout(300);
body = await page.evaluate(() => document.body.innerText);
console.log('Backing out of Pairing (opened from Home) returns to Home, not Settings:', body.includes('CUMULATIVE POSITION') && !body.includes('Danger zone'));

await browser.close();
