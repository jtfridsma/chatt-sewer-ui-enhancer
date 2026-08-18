# Chattanooga Sewer UI Enhancer

Chrome extension that restyles the Chattanooga sewer payments portal (and related WebShare pages) to better match Chattanooga.gov, with improved accessibility and cleaner UI.

## What it does

- Injects a compiled stylesheet and bundled content script on:
    - `https://www.sewerpayments.com/chattanooga*`
    - `https://share.dwcorp.com/WebShare/*` (scoped to the Chattanooga tenant via query params)
- Uses scoped CSS (`html.csui-theme`) to avoid leaking styles outside the target pages.
- Keeps source in `src/` and compiled assets in `public/`.
- Adds an accessible in-page toggle (top-right) labeled “Chattanooga Sewer UI Enhancer”.

## Quick start (Chrome / Chromium)

1. Install dependencies: `npm install`
2. Build once: `npm run build`  
   Or watch during development: `npm run dev` (parallel CSS + JS watch)
3. Load the extension:

- Open `chrome://extensions`
- Enable “Developer mode”
- Click “Load unpacked” and select this repository folder

4. Visit a supported page and refresh to see the new styles.

Notes:

- Styles compile from `src/styles/main.scss` to `public/main.css` (Sass).
- JS bundles from `src/scripts/main.js` to `public/main.js` (esbuild).
- Compiled files in `public/` are generated locally and are not committed.
- While `npm run dev` is running, reload the target page to see updates (Chrome may require reloading the extension after JS changes).

## Project rules

- Keep it plain JavaScript. No framework, no TypeScript, no runtime abstraction layer.
- Prefer scoped CSS under `html.csui-theme` plus page-specific classes.
- Visual and structural content-script changes should be idempotent and reversible when the enhancement toggle is turned off. Injected font resources may remain loaded.
- Favor a few explicit modules over “reusable” infrastructure.

### Squarespace block contracts

The landing-page enhancements intentionally depend on specific Squarespace block IDs. They are
required integration contracts, shared by the landing-page JavaScript and Sass, because a semantic
fallback could modify the wrong content. If Squarespace regenerates them, the extension reports the
missing blocks through its existing error indicator and leaves the affected host content unchanged.

### Inactive account behavior

The modern dashboard intentionally treats a zero-due account with no payment activity for roughly
18 months as inactive, even when the portal does not explicitly mark it inactive. On initial load,
the dashboard may select a more active account instead. This opinionated behavior is intended to
foreground the account most likely to need payment activity; the account-status tooltip discloses
when the inactive label was inferred.

## Project structure

```text
.
├─ manifest.json
├─ public/
│  ├─ main.css
│  ├─ main.js
│  ├─ csui-modern-bridge.js
│  ├─ csui-consumption-chart.js
│  └─ icons/
└─ src/
   ├─ styles/            # Sass source (tokens, base, components, templates)
   └─ scripts/           # JS source (context detection, class application, toggle)
```

## Scripts

- `npm run build` — builds CSS and JS (`build:*`)
- `npm run build:css` — Sass -> `public/main.css` (compressed)
- `npm run build:js` — esbuild -> `public/main.js` (bundled, minified IIFE)
- `npm run package` — validates, builds, and creates a versioned extension ZIP in `dist/`
- `npm run dev` — watch CSS and JS in parallel
- `npm run dev:css` — watch Sass
- `npm run dev:js` — watch JS (esbuild)
- `npm run lint` — Prettier check
- `npm test` — runs focused unit and lifecycle tests with Node's test runner
- `npm run format` — Prettier write

Build toolchain:

- esbuild (`build.mjs`) bundles the main content script, MAIN-world bridge, and lazy Chart.js module
- Sass compiles `src/styles/main.scss`

## Beta packaging

Run `npm run package` to create a distributable extension archive. The command runs formatting and
tests through the production build, clears `dist/`, verifies that `manifest.json` and `package.json`
versions match, validates every manifest resource, copies only the manifest and referenced runtime
files into a clean staging directory, and writes `dist/chatt-sewer-ui-enhancer-v<VERSION>.zip`.

The ZIP contains `manifest.json` at its root and can be submitted or shared without the source tree,
development dependencies, or stale unreferenced build output.
