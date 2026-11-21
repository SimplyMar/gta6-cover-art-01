// Iconic cover lettering, drawn with the vendored @font-face families Anton, Bebas Neue and Pacifico
// (declared in style.css, loaded from app/fonts/*.ttf — see OFL-NOTICE.txt). Everything here is pure
// canvas drawing: a massive condensed-uppercase sunset/chrome title, a tilted neon-glow script
// subtitle, and the small iconic overlays (panel callout tags, heat bar, edition seal, review strip,
// billing block) that sell the "box art" read.

function fitFont(ctx, text, maxWidth, family, startSize, weight = '400') {
  let size = startSize;
  ctx.font = `${weight} ${size}px '${family}'`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= Math.max(1, size * 0.02);
    ctx.font = `${weight} ${size}px '${family}'`;
  }
  return size;
}

/** The massive condensed-uppercase Anton title: a solid offset 3D drop shadow drawn directly behind it,
 * then a sunset-to-chrome gradient fill + retro chrome reflection stripes + thick ink outline built on
 * an isolated offscreen canvas and composited on top — so the metallic highlight stripes (added with
 * 'source-atop') can only ever land on pixels this title itself already painted, never bleeding across
 * the rest of the cover the way compositing straight onto the shared canvas would. */
export function drawTitle(ctx, w, h, text, { cx, baselineY, maxWidth, size }) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  const fitted = fitFont(ctx, str, maxWidth, 'Anton', size);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${fitted}px 'Anton'`;

  // Solid offset 3D drop shadow, drawn straight onto the cover canvas BEHIND the title glyph layer —
  // a short stack of darkening offsets that's meant to show past the letterforms, so it's intentionally
  // not clipped to the glyph shapes.
  const depth = Math.max(3, fitted * 0.1);
  for (let i = Math.round(depth); i > 0; i--) {
    ctx.fillStyle = `rgba(8,6,14,${0.4 + i * 0.03})`;
    ctx.fillText(str, cx + i * 0.6, baselineY + i * 0.75);
  }
  ctx.restore();

  // Build the glyph layer on an isolated offscreen canvas. Every composite step below (the gradient
  // fill, the 'source-atop' chrome stripes) only ever touches pixels THIS canvas already painted, so
  // the stripes stay strictly inside the letterforms no matter what's already on the main cover canvas.
  const padX = Math.max(24, fitted * 0.35);
  const padTop = Math.max(16, fitted * 0.9);
  const padBottom = Math.max(16, fitted * 0.45);
  const off = document.createElement('canvas');
  off.width = Math.ceil(maxWidth + padX * 2);
  off.height = Math.ceil(fitted + padTop + padBottom);
  const octx = off.getContext('2d');
  const ocx = off.width / 2;
  const obaselineY = off.height - padBottom;
  octx.textAlign = 'center';
  octx.textBaseline = 'alphabetic';
  octx.font = `400 ${fitted}px 'Anton'`;

  // Thick, crisp ink outline.
  octx.lineJoin = 'round';
  octx.miterLimit = 2;
  octx.lineWidth = fitted * 0.1;
  octx.strokeStyle = '#08060e';
  octx.strokeText(str, ocx, obaselineY);

  // Sleek 80s Vice-City "chrome horizon" fill: blazing cream-to-gold upper half, a crisp thin white
  // specular band riding the midline, a vibrant coral-magenta lower half, and a cool pale-cyan rim
  // bounce right at the very bottom edge — one continuous gradient read as a polished chrome bar
  // catching a sunset, rather than the old repeating dark scanline stripes.
  const metrics = octx.measureText(str);
  const top = obaselineY - (metrics.actualBoundingBoxAscent ?? fitted * 0.78);
  const grad = octx.createLinearGradient(0, top, 0, obaselineY);
  grad.addColorStop(0, '#fff8e3');
  grad.addColorStop(0.16, '#ffe49a');
  grad.addColorStop(0.36, '#ffc24d');
  grad.addColorStop(0.48, '#fffdf6'); // crisp specular highlight band across the midline
  grad.addColorStop(0.53, '#ffffff');
  grad.addColorStop(0.6, '#ff8f6b');
  grad.addColorStop(0.78, '#ff5e8a');
  grad.addColorStop(0.92, '#c23a6b');
  grad.addColorStop(1, '#bfe9ff'); // cool pale-cyan bottom rim bounce
  octx.fillStyle = grad;
  octx.fillText(str, ocx, obaselineY);

  // Re-stroke a hairline ink outline on top so it stays crisp after the gradient pass, plus a subtle
  // outer glow composited onto the shared cover canvas (never the offscreen glyph layer) so it reads
  // as a soft halo around the whole chrome bar instead of bleeding color onto the letterforms.
  octx.lineWidth = Math.max(1, fitted * 0.012);
  octx.strokeStyle = 'rgba(0,0,0,0.5)';
  octx.strokeText(str, ocx, obaselineY);

  ctx.save();
  ctx.shadowColor = 'rgba(255,170,90,0.55)';
  ctx.shadowBlur = Math.max(6, fitted * 0.14);
  ctx.drawImage(off, cx - ocx, baselineY - obaselineY);
  ctx.restore();

  // Composite the finished, strictly glyph-clipped title layer onto the cover canvas.
  ctx.drawImage(off, cx - ocx, baselineY - obaselineY);
  return fitted;
}

/** The glowing neon script subtitle (Pacifico), tilted, with a soft magenta/cyan outer glow. */
export function drawSubtitle(ctx, w, h, text, { cx, y, maxWidth, size, tilt = -0.045 }) {
  const str = (text ?? '').trim();
  if (!str) return;
  const fitted = fitFont(ctx, str, maxWidth, 'Pacifico', size);
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(tilt);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${fitted}px 'Pacifico'`;

  ctx.shadowColor = 'rgba(255,60,220,0.9)';
  ctx.shadowBlur = fitted * 0.5;
  ctx.fillStyle = '#ffeaf6';
  ctx.fillText(str, 0, 0);
  ctx.shadowColor = 'rgba(70,230,255,0.85)';
  ctx.shadowBlur = fitted * 0.32;
  ctx.fillText(str, 0, 0);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

/** An angled comic role/location callout tag (e.g. "CHOPPER 1"), Bebas Neue on a tilted ink ribbon.
 * `(x, y)` is the tag's BOTTOM-LEFT anchor point (before rotation) — callers always pin these to the
 * bottom-left corner of a panel so tags never climb into the top-of-frame review strip / edition seal. */
export function drawCalloutTag(ctx, x, y, text, angle = -0.08) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  ctx.save();
  ctx.font = `400 ${Math.max(14, Math.min(26, 20))}px 'Bebas Neue'`;
  const padX = 12, padY = 6;
  const tw = ctx.measureText(str).width;
  const bw = tw + padX * 2, bh = 26;
  // Translate so the tag's own bottom-left corner lands at (x, y), then rotate about its center.
  ctx.translate(x + bw / 2, y - bh / 2);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(5,4,10,0.86)';
  ctx.strokeStyle = '#ffd36e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-bw / 2, -bh / 2, bw, bh);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe9b0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, 1);
  ctx.restore();
}

/** A 5-star heat/wanted-level bar: active stars glow luminous gold, inactive stars stay dim ink. */
export function drawHeatBar(ctx, x, y, starSize, heat = 5) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    const sx = i * starSize * 1.08;
    drawStar(ctx, sx, 0, starSize * 0.46, i < heat);
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, active) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const innerA = outerA + Math.PI / 5;
    const ox = Math.cos(outerA) * r, oy = Math.sin(outerA) * r;
    const ix = Math.cos(innerA) * r * 0.44, iy = Math.sin(innerA) * r * 0.44;
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  if (active) {
    // Bright luminous gold fill with a warm amber outer glow.
    ctx.shadowColor = 'rgba(255,183,59,0.95)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffd54f';
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
  }
  ctx.fill();
  // Re-fill once more so the glow-softened gold reads fully opaque and luminous, not washed out.
  if (active) ctx.fill();
  // Crisp dark ink outline, drawn after the glow is cleared so the stroke itself stays sharp.
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.strokeStyle = '#000';
  ctx.stroke();
  ctx.restore();
}

/** A corner "Edition Seal" ribbon/badge (e.g. "SUNSET PALMS EDITION"). Sized and tucked tight into the
 * very corner (not just scaled off the short side) — the top-right panel of every fixed layout is a
 * photo panel with a face anchored with generous headroom near its top edge, so an oversized or
 * loosely-inset seal here reads as the badge "cutting off" that face's head. */
export function drawSeal(ctx, w, h, text) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  const r = Math.min(w, h) * 0.062;
  const cx = w - r * 1.08, cy = r * 1.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.14);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.55, '#ffb14d');
  grad.addColorStop(1, '#c23a6b');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = '#05040a';
  ctx.stroke();
  // scalloped inner ring
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = r * 0.86 + (i % 2 === 0 ? r * 0.035 : 0);
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(5,4,10,0.55)';
  ctx.lineWidth = r * 0.04;
  ctx.stroke();

  ctx.fillStyle = '#05040a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = str.split(' ');
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [str];
  const fsize = Math.max(9, r * 0.22);
  ctx.font = `400 ${fsize}px 'Bebas Neue'`;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * fsize * 1.05);
  });
  ctx.restore();
}

/** A compact critic review strip ("★★★★★ ... — Publication"), sized to fit its own measured text
 * (plus padding, capped at `maxWidth`) rather than stretched to fill the caller's whole box — so it
 * never spans across panel gutters — with a crisp gold left accent bar. */
export function drawReviewStrip(ctx, x, y, maxWidth, text) {
  const str = (text ?? '').trim();
  if (!str) return;
  ctx.save();
  const accentW = 5;
  const padL = 14, padR = 16;
  const h = Math.max(20, maxWidth * 0.1, 30);
  const size = fitFont(ctx, str, maxWidth - accentW - padL - padR, 'Bebas Neue', h * 0.6);
  ctx.font = `400 ${size}px 'Bebas Neue'`;
  const textW = ctx.measureText(str).width;
  const stripW = Math.min(maxWidth, accentW + padL + textW + padR);

  ctx.fillStyle = 'rgba(5,4,10,0.76)';
  ctx.fillRect(x, y, stripW, h);
  ctx.fillStyle = '#ffd36e';
  ctx.fillRect(x, y, accentW, h);

  ctx.fillStyle = '#ffe9b0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x + accentW + padL, y + h / 2 + 1);
  ctx.restore();
}

/** A compact movie-style billing block at the bottom edge (small print, studio-poster convention). */
export function drawBillingBlock(ctx, w, h, text) {
  const str = (text ?? '').trim();
  if (!str) return;
  ctx.save();
  const fsize = Math.max(7, h * 0.012);
  ctx.font = `400 ${fsize}px 'Bebas Neue'`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, w / 2, h - h * 0.012);
  ctx.restore();
}
