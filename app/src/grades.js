// Six cinematic Vice-City color grades. Each is a 3-stop shadow/midtone/highlight LUT applied as a
// per-pixel multiply-and-blend pass (applyGrade) so skin tones stay warm and flattering — never a
// flat hue-rotate that turns faces green — plus a soft sky-bloom vignette glow (paintSkyBloom) drawn
// once over the whole cover for a warm cinematic haze near the top of frame.

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset',
    shadow: hex('#2a1240'), mid: hex('#ff7a59'), highlight: hex('#ffe6a8'),
    bloom: 'rgba(255,150,90,0.35)',
  },
  'neon-coast': {
    label: 'Neon Coast',
    shadow: hex('#0c1f3d'), mid: hex('#2fd0e0'), highlight: hex('#ff4fd8'),
    bloom: 'rgba(90,220,255,0.3)',
  },
  'golden-heat': {
    label: 'Golden Heat',
    shadow: hex('#3a1708'), mid: hex('#e8842a'), highlight: hex('#ffe9b0'),
    bloom: 'rgba(255,190,90,0.38)',
  },
  'miami-pastel': {
    label: 'Miami Pastel',
    shadow: hex('#2f2340'), mid: hex('#ff9ac2'), highlight: hex('#aef4e6'),
    bloom: 'rgba(255,200,230,0.26)',
  },
  'midnight-diner': {
    label: 'Midnight Diner',
    shadow: hex('#0a0a1c'), mid: hex('#6a4fb8'), highlight: hex('#ff6bd0'),
    bloom: 'rgba(130,100,255,0.28)',
  },
  'chrome-noir': {
    label: 'Chrome Noir',
    shadow: hex('#111417'), mid: hex('#7c8a94'), highlight: hex('#f3f6ff'),
    bloom: 'rgba(200,220,255,0.2)',
  },
};

export const GRADE_IDS = Object.keys(GRADES);

function mixStop(orig, stop, amount) {
  return orig * (1 - amount) + stop * amount;
}

/**
 * Applies a 3-stop shadow/midtone/highlight grade to the canvas region (x, y, w, h), in place.
 * Each pixel's luma places it on the shadow->mid->highlight curve; the stop color is screened in at
 * `strength` while the original luma is kept (so detail and skin tone never flatten to a swatch).
 */
export function applyGrade(ctx, x, y, w, h, gradeId, strength = 0.36) {
  const grade = GRADES[gradeId] ?? GRADES['vice-sunset'];
  const iw = Math.max(1, Math.round(w));
  const ih = Math.max(1, Math.round(h));
  if (iw < 2 || ih < 2) return;
  let imageData;
  try {
    imageData = ctx.getImageData(x, y, iw, ih);
  } catch {
    return;
  }
  const d = imageData.data;
  const [sr, sg, sb] = grade.shadow;
  const [mr, mg, mb] = grade.mid;
  const [hr, hg, hb] = grade.highlight;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    let tr, tg, tb;
    if (l < 0.5) {
      const t = l / 0.5;
      tr = sr + (mr - sr) * t; tg = sg + (mg - sg) * t; tb = sb + (mb - sb) * t;
    } else {
      const t = (l - 0.5) / 0.5;
      tr = mr + (hr - mr) * t; tg = mg + (hg - mg) * t; tb = mb + (hb - mb) * t;
    }
    // Screen the stop color in rather than replace, keeping warm skin tones legible at any strength.
    const screen = (base, tint) => 255 - (255 - base) * (255 - tint) / 255;
    d[i] = mixStop(r, screen(r, tr), strength);
    d[i + 1] = mixStop(g, screen(g, tg), strength);
    d[i + 2] = mixStop(b, screen(b, tb), strength);
  }
  ctx.putImageData(imageData, x, y);
}

/** A soft warm radial bloom/vignette glow over the whole cover's upper half, per grade. */
export function paintSkyBloom(ctx, w, h, gradeId) {
  const grade = GRADES[gradeId] ?? GRADES['vice-sunset'];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.18, 0, w * 0.5, h * 0.18, Math.max(w, h) * 0.65);
  glow.addColorStop(0, grade.bloom);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.3, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(255,255,255,1)');
  vignette.addColorStop(1, 'rgba(60,40,70,0.82)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
