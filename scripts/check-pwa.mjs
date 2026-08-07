import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:4173/arthquest-pwa/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });

// Service worker takes a moment to register + activate after load.
await page
  .waitForFunction(
    async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.some((r) => r.active);
    },
    { timeout: 8000 },
  )
  .catch(() => {});

const result = await page.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  const manifestLink = document.querySelector('link[rel="manifest"]')?.href;
  let manifest = null;
  if (manifestLink) {
    const res = await fetch(manifestLink);
    manifest = await res.json();
  }
  return {
    swRegistrations: regs.map((r) => ({ scope: r.scope, active: !!r.active })),
    manifest,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
