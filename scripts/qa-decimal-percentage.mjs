import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.locator('input[inputmode="numeric"]').first().type('120000');
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-onboarding-integer-defaults.png' });

// Find the Housing row's percentage input (default 25%) and type a fractional value into it.
const housingRow = page.locator('div').filter({ hasText: 'Housing' }).filter({ has: page.locator('input[inputmode="decimal"]') }).last();
const pctInput = housingRow.locator('input[inputmode="decimal"]');

await pctInput.click();
await pctInput.fill(''); // clear the "25"
await pctInput.type('4.5');
await page.waitForTimeout(100);
const midTypingValue = await pctInput.inputValue();
console.log('Mid-typing shows exactly what was typed (no snap-back):', midTypingValue === '4.5');

await pctInput.blur();
await page.waitForTimeout(150);
await page.screenshot({ path: '/tmp/shot-onboarding-decimal-committed.png' });
const committedValue = await pctInput.inputValue();
console.log('Committed value after blur:', committedValue === '4.5');

// Stepper still works on top of the fractional base value.
await housingRow.locator('button').last().click(); // "+" button
await page.waitForTimeout(150);
const afterStepUp = await pctInput.inputValue();
console.log('Stepper +1 on a fractional base gives 5.5:', afterStepUp === '5.5');

// Type a trailing-dot value and confirm it commits to the integer part.
await pctInput.click();
await pctInput.fill('');
await pctInput.type('7.');
await page.waitForTimeout(100);
console.log('Trailing dot preserved while typing:', (await pctInput.inputValue()) === '7.');
await pctInput.blur();
await page.waitForTimeout(150);
console.log('Trailing dot commits to integer value:', (await pctInput.inputValue()) === '7');

// Type garbage/invalid text, confirm it sanitizes and commits to 0.
await pctInput.click();
await pctInput.fill('');
await pctInput.type('abc');
await page.waitForTimeout(100);
console.log('Non-numeric characters are stripped while typing:', (await pctInput.inputValue()) === '');
await pctInput.blur();
await page.waitForTimeout(150);
console.log('Empty input commits to 0:', (await pctInput.inputValue()) === '0');

// Typing more than 2 fractional digits gets capped while typing (not just on commit).
await pctInput.click();
await pctInput.fill('');
await pctInput.type('4.56789');
await page.waitForTimeout(100);
console.log('Fractional digits capped at 2 while typing:', (await pctInput.inputValue()) === '4.56');
await pctInput.blur();
await page.waitForTimeout(150);

// The exact regression the code-review caught: stepping a fractional base with raw float
// arithmetic drifts (1.2 - 1 === 0.19999999999999996 in IEEE-754) unless rounded on every
// mutation, not just on manual entry.
await pctInput.click();
await pctInput.fill('');
await pctInput.type('1.2');
await pctInput.blur();
await page.waitForTimeout(150);
await housingRow.locator('button').first().click(); // "-" button
await page.waitForTimeout(150);
const afterStepDown = await pctInput.inputValue();
console.log('Stepper -1 on a fractional base rounds cleanly to 0.2 (no float drift):', afterStepDown === '0.2');

// Set Housing back to a clean fractional value and check the group total + banner reflect it correctly.
await pctInput.click();
await pctInput.fill('');
await pctInput.type('25.5');
await pctInput.blur();
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shot-onboarding-group-total.png', fullPage: true });
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Banner/group totals render cleanly (no float artifacts like ".0000000001"):', !bodyText.includes('00000'));

await browser.close();
