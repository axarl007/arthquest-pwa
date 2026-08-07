# ArthQuest

Offline-first budgeting and savings-quest tracker, installable as a PWA. Frontend is a from-scratch React app pixel-matched to the design spec; business logic (budget rules, quest lifecycle, default categories, currency formatting) is ported from the [arthquest](https://github.com/axarl007/arthquest) Android app's Kotlin domain layer. No backend — everything lives in the browser's `localStorage`.

Live at: **https://axarl007.github.io/arthquest-pwa/** (once GitHub Pages is enabled — see below).

## One-time setup to go live

This repo deploys via GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`, but GitHub Pages needs to be told to use it once:

1. Repo **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
2. Merge a PR into `main` (or push directly) — the workflow builds and deploys automatically from there.

## Development

```bash
npm install     # also generates public/pwa-icons and public/icons/twemoji (postinstall)
npm run dev     # local dev server
npm test        # vitest
npm run build   # production build to dist/
npm run preview # serve the production build locally
```

## Architecture notes

- **`src/domain/`** — pure, unit-tested logic: currency/date formatting (`format.js`), and (from ticket #2 onward) budget/quest calculations ported from the Android app.
- **`src/theme/`** — design tokens (`tokens.js`, dark/vibrant themes as `oklch()` colors) and the icon system (`icons.js` — Material Symbols "flat" style or locally-bundled Twemoji "cartoon" style, both fully offline).
- **`src/store/`** — `localStorage` persistence (`persistence.js`) behind a small React context (`StoreContext.jsx`).
- **`scripts/`** — build-time asset generation: `copy-twemoji.mjs` bundles the Twemoji SVG subset actually used, `gen-icons.mjs` rasterizes the PWA app icon from the same `oklch()` tokens as the UI (`oklch.mjs`), `screenshot*.mjs`/`check-*.mjs` are local visual-QA helpers (not run in CI).

No fake device chrome (status bar/bezel/gesture-nav) is rendered — the real OS/browser supplies that once installed. On wide viewports the app renders as a centered, phone-proportioned card; on mobile widths it's edge-to-edge with `env(safe-area-inset-*)` padding.

Work is tracked as GitHub issues (#1–#6), each a vertical slice — see the issue list for scope and acceptance criteria.
