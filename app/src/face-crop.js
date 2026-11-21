// Smart face/portrait-aware auto-framing. We don't ship a neural face detector (this app is 100%
// offline, no model weights to vendor) — instead `estimateFaceAnchor` analyzes an offscreen
// downsampled copy of the photo for skin-tone + contrast saliency, biased hard toward the upper 18-28%
// of the frame (where a head + hair + sunglasses almost always sits in a portrait or action photo), and
// returns a normalized anchor point. `anchorToOffset` then converts that anchor into the renderer's
// offsetX/offsetY pan, taking the actual panel's safe-draw box and the photo's own aspect ratio into
// account so the amount of headroom preserved is correct for how aggressively THIS panel crops the
// photo — not a flat guess. Combined with manual zoom/pan/flip per panel, this gives "auto-frame then
// fine-tune" behavior where heads and faces are never chopped off.

const SAMPLE = 64; // analysis grid resolution — small and fast enough for live editing.

// The vertical band a head is assumed to sit in for a well-framed portrait/action photo: 18%-28% down
// from the top, with 23% as the target "ideal" headroom fraction once mapped into a panel's frame.
const HEAD_BAND_MIN = 0.18;
const HEAD_BAND_MAX = 0.28;
const HEAD_BAND_TARGET = 0.23;

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
 * {x, y} in [0,1]x[0,1] biased hard toward the most face-like region in the upper 18-28% of the frame
 * (skin-tone density weighted by local contrast). Falls back to {x:0.5, y:0.23} — dead-center in the
 * target head band — if nothing scores above a trivial threshold, so an undetected face still gets
 * generous top-of-head headroom instead of a centered "chest-up" guess.
 */
export function estimateFaceAnchor(img) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return { x: 0.5, y: HEAD_BAND_TARGET };

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
    return { x: 0.5, y: HEAD_BAND_TARGET }; // tainted canvas (cross-origin) — safe fallback, never throws
  }

  // Luma grid for a cheap local-contrast estimate.
  const luma = new Float32Array(cw * ch);
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
    luma[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  let bestScore = -1;
  let bestX = cw / 2;
  let bestY = ch * HEAD_BAND_TARGET;
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
      // Hard prior for the head band: a strong peak at 18-28% down, falling off sharply outside it —
      // a skin-toned, high-contrast match well below the head band (a hand, an arm, a chest) should
      // essentially never outscore a weaker match actually inside the band.
      let positionBias;
      if (verticalFrac >= HEAD_BAND_MIN && verticalFrac <= HEAD_BAND_MAX) positionBias = 1;
      else if (verticalFrac < HEAD_BAND_MIN) positionBias = 0.5 + 0.5 * (verticalFrac / HEAD_BAND_MIN);
      else positionBias = Math.max(0.05, 1 - (verticalFrac - HEAD_BAND_MAX) * 2.2);
      const score = (contrast + 6) * positionBias;
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
      }
    }
  }

  if (bestScore <= 0) return { x: 0.5, y: HEAD_BAND_TARGET };

  // Soft-center X: a detection right at the left/right edge is the case most likely to land in a
  // slanted or rotated panel's clipped-away corner, so pull extreme horizontal matches a third of the
  // way back toward center as a safety margin, without discarding genuine off-center framing.
  const rawX = bestX / cw;
  const safeX = rawX + (0.5 - rawX) * 0.3;

  // Clamp the returned anchor itself into (a slightly widened) head band, so even a noisy detection
  // that fired outside 18-28% still reports a face position consistent with "head near the top, with
  // headroom above it" — anchorToOffset's precision then comes from the panel-aware math below.
  const rawY = bestY / ch;
  const safeY = Math.min(0.34, Math.max(0.12, rawY));
  return { x: safeX, y: safeY };
}

/**
 * Converts a normalized face anchor {x, y} into the renderer's offsetX/offsetY pan (each in [-1, 1], 0
 * = centered), aiming to land the anchor at HEAD_BAND_TARGET (23% down) inside the panel's frame.
 *
 * `box` is the panel's safe-draw box ({x, y, w, h}, from layouts.js's `photoBoxFor`) and `img` is the
 * loaded photo — together these give the real cover-fit aspect ratio, so the correction accounts for how
 * tightly THIS panel crops the photo instead of guessing with a flat constant. Both are optional; when
 * omitted this falls back to a fixed moderate-crop assumption (still biased hard toward headroom) so
 * every existing call site keeps working.
 *
 * `opts.canvasH`, when supplied alongside `box.y`/`box.h` in full canvas pixel space, lets this pull the
 * target headroom tighter (toward the top of the panel) for a tall/lower panel whose bottom edge reaches
 * into the bottom portion of the canvas where the title block renders — so a detected face in one of
 * those panels lands cleanly above the title-safe line instead of merely at the standard 23% headroom,
 * which can still dip into the title's gradient band on a panel that runs all the way to the bottom edge.
 */
export function anchorToOffset(anchor, box, img, opts = {}) {
  const offsetX = Math.min(1, Math.max(-1, (anchor.x - 0.5) * 2));

  const coverAspect = box && box.w && box.h ? box.w / box.h : null;
  const imgAspect = img && (img.naturalWidth || img.width) && (img.naturalHeight || img.height)
    ? (img.naturalWidth || img.width) / (img.naturalHeight || img.height)
    : null;

  const reachesTitleZone = opts.canvasH && box && Number.isFinite(box.y) && Number.isFinite(box.h)
    ? (box.y + box.h) / opts.canvasH > 0.78
    : false;
  const target = reachesTitleZone ? HEAD_BAND_TARGET * 0.68 : HEAD_BAND_TARGET;

  let offsetY;
  if (coverAspect && imgAspect) {
    // R = scaled-photo-height / box-height under a zoom=1 cover-fit (ph/h). No vertical cropping is
    // possible when the photo is relatively wider than the box (R clamps to 1) — in that case there is
    // nothing offsetY can do, so leave it at 0.
    const r = Math.max(coverAspect / imgAspect, 1);
    const marginFrac = (r - 1) / 2; // (ph - h) / (2h), i.e. maxOffY expressed as a fraction of h
    if (marginFrac > 0.001) {
      offsetY = (anchor.y * r - marginFrac - target) / marginFrac;
    } else {
      offsetY = 0;
    }
  } else {
    // No panel/image geometry supplied — fall back to a fixed moderate-crop assumption, still strongly
    // biased toward preserving headroom for a head detected near the top of the source photo.
    offsetY = (anchor.y - 0.42) * 2.3;
  }

  return { offsetX, offsetY: Math.min(1, Math.max(-1, offsetY)) };
}
