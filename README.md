# gta6-cover-art-01

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/SimplyMar/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/SimplyMar/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

**Vice Panels** is a fully offline, multi-panel coastal-noir cover art studio in the spirit of bold
comic-style box art — built from plain HTML, CSS and ES modules, with no network calls, no build
step, and no borrowed logos or artwork.

## What it does

- **Three panel layouts**: 5-Panel Classic Vice (hero + stacked column), 4-Panel Diagonal Split
  (Z-diagonal wedges), and 6-Panel Grid (uneven 2x3 grid) — see `app/src/layouts.js`.
- **Three canvas size presets**: 1080x1080 Square, 1080x1350 Portrait, 1920x1080 Widescreen.
- **Per-panel content**: upload your own photo, drop in a bundled sample
  (`app/samples/boulevard.jpg`, `app/samples/pier.jpg`), or leave the panel on its procedural
  vector/gradient fill (sun, skyline, palms, scanlines) generated in `app/src/cover.js` so every
  panel looks finished before any photo is loaded.
- **Click-panel-to-select**, then drag to pan, or use the Pan X / Pan Y / Zoom sliders.
- **Four color grade presets** (`app/src/filters.js`): Vice Sunset, Neon Noir, Chrome Heat, Palm
  Pastel — apply per panel or to the whole cover at once.
- **Editable title, subtitle, and a corner emblem badge**, rendered as bold ink-outlined type over
  a gradient banner.
- **Real PNG export** at the exact pixel size of the selected canvas preset.

## Running it

```sh
node serve.ts
```

then open `http://localhost:8080` in a browser. Nothing is fetched from the network — every asset
is local.

## Screenshot scenes

`app/src/shots.js` reads a `?shot=` query for reproducible captures:

- `shot=cover` — canvas only, full-bleed.
- `shot=editor` — the full studio UI with the canvas.
- shared params: `layout`, `size`, `grade`, `title`.

The page sets `window.__shotReady = true` once the scene has finished painting.

## Building the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

copies `app/` and `screenshots/` into `out/` and writes `out/dossier.json`.
