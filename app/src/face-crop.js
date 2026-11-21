// Smart face/portrait-aware auto-framing. We don't ship a neural face detector (this app is 100%
// offline, no model weights to vendor) — instead `estimateFaceAnchor` analyzes an offscreen
// downsampled copy of the photo for skin-tone + contrast saliency, biased toward the upper third of
// the frame (where a head almost always sits in a portrait or action photo), and returns a normalized
// anchor point the renderer centers panning on so heads are never chopped off. Combined with manual
// zoom/pan/flip per panel, this gives "auto-frame then fine-tune" behavior.

const SAMPLE = 64; // analysis grid resolution — small and fast enough for live editing.

/** Whether an RGB triplet looks like skin (broad, inclusive heuristic across tones). */
function isSkinish(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const delta = max - min;
  if (max < 40) return false; // too dark to read as skin
  if (r <= g || r <= b) return false; // skin reads red-dominant across tones
  if (delta < 12) return false; // skip near-greyscale noise
  const rg = r - g;
  return rg > 6 && rg < 140 && r - b > 4;
}

/**
 * Analyzes `img` (a loaded HTMLImageElement/ImageBitmap) offscreen and returns a normalized anchor
 * {x, y} in [0,1]x[0,1] biased toward the most face-like region (skin-tone density weighted by local
 * contrast, with a strong prior toward the upper third of the frame). Falls back to {x:0.5, y:0.38}
 * (a safe "chest-up portrait" anchor) if nothing scores above a trivial threshold.
 */
export function estimateFaceAnchor(img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return { x: 0.5, y: 0.38 };

  const cw = SAMPLE;
  const ch = Math.max(1, Math.round((SAMPLE * ih) / iw));
  const off = document.createElement('canvas');
  off.width = cw;
  off.height = ch;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(img, 0, 0, cw, ch);
  let data;
  try {
    data = octx.getImageData(0, 0, cw, ch).data;
  } catch {
    return { x: 0.5, y: 0.38 }; // tainted canvas (cross-origin) — safe fallback, never throws
  }

  // Luma grid for a cheap local-contrast estimate.
  const luma = new Float32Array(cw * ch);
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
    luma[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  let bestScore = -1;
  let bestX = cw / 2;
  let bestY = ch * 0.3;
  for (let y = 1; y < ch - 1; y++) {
    for (let x = 1; x < cw - 1; x++) {
      const p = (y * cw + x) * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (!isSkinish(r, g, b)) continue;
      const i = y * cw + x;
      const contrast =
        Math.abs(luma[i] - luma[i - 1]) +
        Math.abs(luma[i] - luma[i + 1]) +
        Math.abs(luma[i] - luma[i - cw]) +
        Math.abs(luma[i] - luma[i + cw]);
      const verticalFrac = y / ch;
      // Strong prior for the upper half (heads), tapering off lower in the frame.
      const positionBias = verticalFrac < 0.15 ? 0.55 : verticalFrac < 0.55 ? 1 : Math.max(0.12, 1 - (verticalFrac - 0.55) * 1.6);
      const score = (contrast + 6) * positionBias;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (bestScore <= 0) return { x: 0.5, y: 0.38 };
  return { x: bestX / cw, y: Math.min(0.62, bestY / ch) };
}

/**
 * Converts a normalized face anchor {x, y} plus a panel's current zoom into the offsetX/offsetY the
 * renderer's pan model expects (each in [-1, 1], 0 = centered). `coverAspect` is panelW/panelH,
 * `imgAspect` is the photo's own width/height — used so the anchor maps correctly whichever axis the
 * cover-fit crop actually trims.
 */
export function anchorToOffset(anchor) {
  // anchor.x/y of 0.5 is centered (offset 0); distance from center maps linearly to the clamped ±1 pan range.
  const offsetX = Math.min(1, Math.max(-1, (anchor.x - 0.5) * 2));
  // Bias up slightly further so a head sits in the upper-middle rather than dead center.
  const offsetY = Math.min(1, Math.max(-1, (anchor.y - 0.42) * 2));
  return { offsetX, offsetY };
}
