// Fast client-side "GTA key-art" illustration filter: a bilateral edge-preserving smooth, warm
// tonal cel-shade banding (posterize blended with original for a painted look, plus a vibrance
// lift), crisp dark ink contours (Sobel), and a subtle clean film-grain texture. Pure canvas
// ImageData pixel math — no WebGL, no external library — so it runs on photos and on the
// procedural backdrop alike, fast enough for live slider drags.

/** A fast single-pass 3x3 bilateral smooth: like a box blur, but each neighbor is weighted down the
 * further its color sits from the center pixel. This tames sensor noise and small blotchy patches
 * (the old plain box blur's muddy look) while refusing to blur across a real edge — a jawline, a
 * horizon, a building edge stays crisp because the high-contrast neighbors across it get a near-zero
 * weight, while a smooth gradient region (skin, sky) gets smoothed cleanly. */
function bilateralSmooth(src, w, h) {
  const out = new Uint8ClampedArray(src.length);
  // Range sigma: how much color distance before a neighbor's contribution falls off sharply.
  const rangeSigma2 = 2 * 24 * 24;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
      const ci = (y * w + x) * 4;
      const cr = src[ci], cg = src[ci + 1], cb = src[ci + 2];
      let sr = 0, sg = 0, sb = 0, wsum = 0;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const i = (yy * w + xx) * 4;
          const nr = src[i], ng = src[i + 1], nb = src[i + 2];
          const dr = nr - cr, dg = ng - cg, db = nb - cb;
          const distSq = dr * dr + dg * dg + db * db;
          const weight = Math.exp(-distSq / rangeSigma2);
          sr += nr * weight; sg += ng * weight; sb += nb * weight; wsum += weight;
        }
      }
      out[ci] = sr / wsum;
      out[ci + 1] = sg / wsum;
      out[ci + 2] = sb / wsum;
      out[ci + 3] = src[ci + 3];
    }
  }
  return out;
}

function lumaOf(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

/** Lifts saturation around a pixel's own luma-neutral axis by `amount` (e.g. 0.14 = +14%), strongest
 * in midtones and tapering toward black/white so shadows and blown highlights don't clip into neon. */
function liftVibrance(r, g, b, l, amount) {
  const midtoneWeight = 1 - Math.abs(l / 255 - 0.5) * 1.6;
  const k = 1 + amount * Math.max(0, Math.min(1, midtoneWeight));
  return [
    l + (r - l) * k,
    l + (g - l) * k,
    l + (b - l) * k,
  ];
}

/**
 * Applies the Poster Ink filter in place to the canvas region (x, y, w, h) — a smooth painted GTA
 * key-art look, not blotchy flat gray quantization. `opts`:
 *   inkStrength      0..1, how dark/thick the Sobel contour lines render (0 = none).
 *   posterizeLevels  2..8, how many tonal bands the cel-shade quantizes color into (default 6).
 *   grain            0..1, subtle clean film-grain opacity (no halftone dots).
 */
export function applyPosterInk(ctx, x, y, w, h, opts = {}) {
  const inkStrength = opts.inkStrength ?? 0.6;
  const levels = Math.max(2, Math.min(8, Math.round(opts.posterizeLevels ?? 6)));
  const grain = opts.grain ?? 0.25;
  const iw = Math.max(1, Math.round(w));
  const ih = Math.max(1, Math.round(h));
  if (iw < 2 || ih < 2) return;

  let imageData;
  try {
    imageData = ctx.getImageData(x, y, iw, ih);
  } catch {
    return; // tainted canvas (cross-origin photo) — leave the region untouched rather than throw
  }
  const src = imageData.data;
  // Edge-preserving bilateral smooth instead of a plain box blur: neighbors are weighted down by how
  // far their color sits from the center pixel, so a real edge (jawline, horizon, building line) stays
  // crisp while a smooth region (skin, sky) blends cleanly without the old blotchy muddy patches.
  const smoothed = bilateralSmooth(src, iw, ih);

  const luma = new Float32Array(iw * ih);
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) luma[i] = lumaOf(smoothed[p], smoothed[p + 1], smoothed[p + 2]);

  const step = 255 / (levels - 1);
  const out = imageData.data;
  const seed = (iw * 7919 + ih * 104729) >>> 0;
  let rngState = seed || 1;
  const rand = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  for (let yy = 0; yy < ih; yy++) {
    for (let xx = 0; xx < iw; xx++) {
      const i = yy * iw + xx;
      const p = i * 4;
      const origR = smoothed[p], origG = smoothed[p + 1], origB = smoothed[p + 2];

      // Posterize the LUMINANCE into tonal bands but rescale r/g/b by the same ratio, so hue and
      // saturation are preserved — a true cel-shade band, never a grey/sepia wash. A small warm
      // push in shadows and cool lift in highlights keeps skin tones flattering at the seams.
      const band = Math.max(8, Math.round(luma[i] / step) * step);
      const bandT = band / 255;
      const origLuma = Math.max(1, luma[i]);
      const scale = band / origLuma;
      const qR = origR * scale + (bandT < 0.4 ? 8 : 0);
      const qG = origG * scale;
      const qB = origB * scale + (bandT < 0.4 ? -5 : bandT > 0.8 ? 6 : 0);

      // Soft cel-shade: blend the quantized bands with the smooth original luminance rather than
      // committing fully to flat bands, so the paint reads as graded, soft-shaded key art instead of
      // a harsh poster cutout — then lift vibrance a touch in the midtones so sunset skies and faces
      // glow warmly instead of turning muddy gray.
      let r = qR * 0.55 + origR * 0.45;
      let g = qG * 0.55 + origG * 0.45;
      let b = qB * 0.55 + origB * 0.45;
      const blendedLuma = lumaOf(r, g, b);
      [r, g, b] = liftVibrance(r, g, b, blendedLuma, 0.14);

      // Sobel edge magnitude from the luma grid, clamped to the region's border.
      const xm = Math.max(0, xx - 1), xp = Math.min(iw - 1, xx + 1);
      const ym = Math.max(0, yy - 1), yp = Math.min(ih - 1, yy + 1);
      const gx =
        -luma[ym * iw + xm] - 2 * luma[yy * iw + xm] - luma[yp * iw + xm] +
        luma[ym * iw + xp] + 2 * luma[yy * iw + xp] + luma[yp * iw + xp];
      const gy =
        -luma[ym * iw + xm] - 2 * luma[ym * iw + xx] - luma[ym * iw + xp] +
        luma[yp * iw + xm] + 2 * luma[yp * iw + xx] + luma[yp * iw + xp];
      const mag = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 420);
      // Raised from 0.12 so fine, low-contrast texture (facial skin pores, beard stubble) stays clean
      // rather than breaking into noisy black speckles — only genuine structural silhouettes (jawlines,
      // building edges, vehicle outlines) clear this higher bar, and the remaining response is rescaled
      // smoothly (not just re-clamped) so the ink that does render still ramps in cleanly at its edge.
      const inkThreshold = 0.2;
      const ink = mag > inkThreshold ? Math.pow((mag - inkThreshold) / (1 - inkThreshold), 0.85) * inkStrength * 1.8 : 0;
      if (ink > 0) {
        const k = Math.min(1, ink);
        r *= 1 - k; g *= 1 - k; b *= 1 - k;
      }

      // Subtle, clean film grain only — no 3px polka-dot halftone screen (which turned faces/beards
      // into noisy black speckle under the raised ink threshold above).
      if (grain > 0) {
        const noise = (rand() - 0.5) * 255 * grain * 0.1;
        r += noise; g += noise; b += noise;
      }

      out[p] = Math.min(255, Math.max(0, r));
      out[p + 1] = Math.min(255, Math.max(0, g));
      out[p + 2] = Math.min(255, Math.max(0, b));
      out[p + 3] = src[p + 3];
    }
  }
  ctx.putImageData(imageData, x, y);
}
