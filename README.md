# gta6-cover-art-01

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/SimplyMar/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/SimplyMar/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

**Sunset Palms Cover Studio** is a fully offline, gallery-grade, multi-panel GTA-style box-art
studio — plain HTML, CSS and ES modules, no build step, no network calls, and no borrowed logos,
wordmarks or artwork. Everything it draws (lettering, color grades, the ink/poster filter) is
original code and vendored, freely-licensed assets.

## What it does

- **6 bold asymmetric layouts** (`app/src/layouts.js`): `vice6` (iconic 6-panel box art — wide
  helicopter banner, tall hero portrait, 4 staggered action panels), `slanted5` (diagonal comic
  wedges), `heroBreakout` (panoramic backdrop + 4 side panels + a breakout hero close-up),
  `wideLoading` (16:9 cinematic split-panel loading screen), `classic5` (tall hero + 4 stacked
  panels) and `polaroids5` (tilted overlapping snapshot frames over a sunset backdrop).
- **4 canvas size presets**: 1080x1080 Square, 1080x1350 Portrait, 1920x1080 Widescreen, 1080x1920
  Story — export any one, or all four at once.
- **6 bundled sample photos** (`app/samples/`) plus multi-file drag-and-drop or a file picker onto
  any panel, and a one-click **Auto-Fill All Panels** button.
- **Face/portrait-aware auto-framing** (`app/src/face-crop.js`): analyzes each photo offscreen for
  skin-tone + contrast saliency, biased to the upper third of frame, so heads are never chopped off
  — plus manual pan/zoom/flip per panel (drag to pan, wheel to zoom, Flip Panel button).
- **Poster Ink illustration filter** (`app/src/posterize.js`): edge-preserving smoothing, warm
  tonal cel-shade banding (hue/saturation preserved, never a grey wash), crisp dark Sobel ink
  contours and a halftone-dot/film-grain texture — tunable live via Ink Strength / Posterize / Grain
  sliders.
- **6 cinematic color grades** (`app/src/grades.js`): Vice Sunset, Neon Coast, Golden Heat, Miami
  Pastel, Midnight Diner, Chrome Noir — a true 3-stop shadow/midtone/highlight grade plus a sky-bloom
  vignette glow, applied per panel or to the whole cover.
- **Iconic cover lettering** (`app/src/typography.js`), set in the vendored Anton / Bebas Neue /
  Pacifico fonts (`app/fonts/`, SIL OFL — see `app/fonts/OFL-NOTICE.txt`): a massive condensed
  sunset-to-chrome gradient title with ink outline and 3D drop shadow, a glowing neon-script
  subtitle, angled panel callout tags, a 5-star heat bar, a corner edition seal, a critic review
  strip and a movie-style billing block — every overlay toggleable and its text editable.
- **Undo/redo** (Ctrl+Z / Ctrl+Y) and **4 one-click style recipes** (`app/src/history.js`): Vice Box,
  Neon Heist, Golden Hour, Retro Loading.
- **Swap/Shuffle Panels**, global or per-panel color grade, and a real PNG export at the exact pixel
  size of every preset.

## Running it

```sh
node serve.ts
```

then open `http://localhost:8080` in a browser. Nothing is fetched from the network — every asset,
font and library is local.

## Screenshot scenes

`app/src/shots.js` reads a `?shot=` query for reproducible captures:

- `shot=cover` — canvas only, full-bleed, export mode (no selection outline).
- `shot=editor` — the full studio UI with the canvas.
- shared params: `layout`, `size`, `grade`, `recipe`, `title`, `subtitle`, `ink`, `posterize`, `grain`.

`shots.json` records the 4 scenes behind `screenshots/*.jpg`. The page sets
`window.__shotReady = true` once all 6 sample photos have decoded and the vendored fonts have
loaded.

## Building the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

copies `app/` and `screenshots/` into `out/` and writes `out/dossier.json`.
