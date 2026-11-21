// Fast client-side "GTA key-art" illustration filter: gentle edge-preserving smoothing, warm
// tonal cel-shade banding (posterize), crisp dark ink contours (Sobel), and a subtle halftone
// dot / film-grain texture. Pure canvas ImageData pixel math — no WebGL, no external library —
// so it runs on photos and on the procedural backdrop alike, fast enough for live slider drags.

/** Cheap 3x3 box blur in place, one pass — enough to tame single-pixel noise before quantizing. */
function boxBlur(src, w, h) {
  const out = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) sum += src[(yy * w + xx) * 4 + c];
        out[(y * w + x) * 4 + c] = sum / 9;
      }
      out[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3];
    }
  }
  return out;
}

function lumaOf(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

/**
 * Applies the Poster Ink filter in place to the canvas region (x, y, w, h). `opts`:
 *   inkStrength      0..1, how dark/thick the Sobel contour lines render (0 = none).
 *   posterizeLevels  2..8, how many tonal bands the cel-shade quantizes color into.
 *   grain            0..1, halftone dot + film grain texture opacity.
 */
export function applyPosterInk(ctx, x, y, w, h, opts = {}) {
  const inkStrength = opts.inkStrength ?? 0.6;
  const levels = Math.max(2, Math.min(8, Math.round(opts.posterizeLevels ?? 5)));
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
  const smoothed = boxBlur(src, iw, ih);

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
      const l = luma[i] / 255;
      let r = smoothed[p], g = smoothed[p + 1], b = smoothed[p + 2];

      // Posterize the LUMINANCE into tonal bands but rescale r/g/b by the same ratio, so hue and
      // saturation are preserved — a true cel-shade band, never a grey/sepia wash. A small warm
      // push in shadows and cool lift in highlights keeps skin tones flattering at the seams.
      const band = Math.max(8, Math.round(luma[i] / step) * step);
      const bandT = band / 255;
      const origLuma = Math.max(1, luma[i]);
      const scale = band / origLuma;
      r = r * scale + (bandT < 0.4 ? 8 : 0);
      g = g * scale;
      b = b * scale + (bandT < 0.4 ? -5 : bandT > 0.8 ? 6 : 0);

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
      const ink = Math.max(0, mag - 0.12) * inkStrength * 2.2;
      if (ink > 0) {
        const k = Math.min(1, ink);
        r *= 1 - k; g *= 1 - k; b *= 1 - k;
      }

      // Halftone dot screen: a soft rosette threshold on the luma value, strongest in midtones.
      if (grain > 0) {
        const cell = 3;
        const cx = (xx % cell) - cell / 2, cy = (yy % cell) - cell / 2;
        const dot = Math.sqrt(cx * cx + cy * cy) / (cell * 0.75);
        const dotMask = dot < 1 - l ? 1 : 0;
        const dotStrength = grain * 0.35 * (1 - Math.abs(l - 0.5) * 1.4);
        if (dotStrength > 0) {
          r -= dotMask * 255 * dotStrength * 0.25;
          g -= dotMask * 255 * dotStrength * 0.25;
          b -= dotMask * 255 * dotStrength * 0.25;
        }
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
