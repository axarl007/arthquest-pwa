import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // Auto-grants getUserMedia and serves a synthetic video feed so the camera-scanning path can be
  // exercised without a real device/camera — this sandbox has neither.
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, permissions: ['camera'] });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.getByText('Get started', { exact: true }).click();
await page.waitForTimeout(300);

// Regression guard: ensureDeviceId's mount effect and Onboarding's category-seeding mount effect
// both fire in the same commit on a fresh install — dispatching a full stale-state snapshot from
// either one can silently clobber the other's just-written fields via the reducer's shallow
// merge. This caught exactly that bug once (categories/incomeCategories reverting to []) before
// ensureDeviceId was changed to return a minimal { deviceId } patch instead of a full state copy.
const seeded = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('arthquest.state')).data;
  return { categories: data.categories.length, incomeCategories: data.incomeCategories.length, deviceId: data.deviceId };
});
console.log('Onboarding categories survived the deviceId mount effect:', seeded.categories === 17);
console.log('Onboarding income categories survived the deviceId mount effect:', seeded.incomeCategories === 3);

await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);

const deviceId = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.deviceId);
console.log('deviceId generated and persisted:', typeof deviceId === 'string' && deviceId.length > 0);

// Not exact — this button also contains the "smartphone" icon glyph's text as a sibling node.
await page.getByText('Pair a device').click();
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shot-pairing-mine.png', fullPage: true });
let body = (await page.evaluate(() => document.body.innerText));
console.log('Pairing "My code" tab shows the short code:', /[0-9A-F]{4}-[0-9A-F]{4}/.test(body));
const qrRendered = await page.locator('img[alt="Pairing QR code"]').isVisible();
console.log('QR image rendered:', qrRendered);

// Rename this device, confirm it persists and regenerates the QR without error.
const nameInput = page.locator('input[placeholder="e.g. Axar\'s Phone"]');
await nameInput.fill('');
await nameInput.type("Axar's Phone");
await nameInput.blur();
await page.waitForTimeout(300);
const savedName = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.deviceName);
console.log('Device name saved:', savedName === "Axar's Phone");

// Switch to Scan — with the fake camera flags above, getUserMedia should resolve and the video
// element should start streaming with no permission-denied error surfaced.
await page.getByText('Scan', { exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shot-pairing-scan.png', fullPage: true });
body = await page.evaluate(() => document.body.innerText);
console.log('No camera-permission error shown:', !body.includes("Couldn't access the camera"));
const videoPlaying = await page.evaluate(() => {
  const v = document.querySelector('video');
  return !!v && v.readyState >= 2 && v.videoWidth > 0;
});
console.log('Fake camera video stream is playing:', videoPlaying);

// Directly exercise the "scanned my own code" guard via the same payload the QR itself encodes,
// by injecting jsQR's decode result path isn't reachable from outside the module — instead verify
// the parse/self-guard logic already has full unit coverage (domain/pairing.test.js) and use this
// script for what only a browser can prove: camera permission wiring + QR rendering + persistence.

// Simulate an already-paired state (a real two-device scan can't happen in this single-browser
// script) to verify the paired-device banner, Settings summary line, and unpair flow.
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('arthquest.state'));
  raw.data.pairedDevice = { id: 'other-device-id', name: "Wife's Phone", pairedAt: Date.now() };
  localStorage.setItem('arthquest.state', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('button[aria-label="Settings"]').click();
await page.waitForTimeout(200);
body = await page.evaluate(() => document.body.innerText);
console.log('Settings shows paired device name:', body.includes("Paired with Wife's Phone"));

await page.getByText("Paired with Wife's Phone").click();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-pairing-paired.png', fullPage: true });
body = await page.evaluate(() => document.body.innerText);
console.log('Pairing screen shows the paired-device banner:', body.includes('Paired with') && body.includes("Wife's Phone"));

await page.getByText('Unpair', { exact: true }).click();
await page.waitForTimeout(150);
await page.getByText('Unpair', { exact: true }).last().click();
await page.waitForTimeout(200);
const afterUnpair = await page.evaluate(() => JSON.parse(localStorage.getItem('arthquest.state')).data.pairedDevice);
console.log('Unpair clears pairedDevice:', afterUnpair === null);
body = await page.evaluate(() => document.body.innerText);
console.log('Pairing screen no longer shows the paired banner:', !body.includes('Paired with'));

await browser.close();
