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
- Content-script DOM changes should be idempotent and reversible when the enhancement toggle is turned off.
- Favor a few explicit modules over “reusable” infrastructure.

## Project structure

```text
.
├─ manifest.json
├─ public/
│  ├─ main.css
│  ├─ main.js
│  └─ icons/
└─ src/
   ├─ styles/            # Sass source (tokens, base, components, templates)
   └─ scripts/           # JS source (context detection, class application, toggle)
```

## Scripts

- `npm run build` — builds CSS and JS (`build:*`)
- `npm run build:css` — Sass -> `public/main.css` (compressed)
- `npm run build:js` — esbuild -> `public/main.js` (bundled, minified IIFE)
- `npm run dev` — watch CSS and JS in parallel
- `npm run dev:css` — watch Sass
- `npm run dev:js` — watch JS (esbuild)
- `npm run lint` — Prettier check
- `npm run format` — Prettier write

Build toolchain:

- esbuild (`build.mjs`) bundles `src/scripts/main.js`
- Sass compiles `src/styles/main.scss`
