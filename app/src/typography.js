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

  // Blazing multi-stop sunset-to-chrome gradient fill.
  const metrics = octx.measureText(str);
  const top = obaselineY - (metrics.actualBoundingBoxAscent ?? fitted * 0.78);
  const grad = octx.createLinearGradient(0, top, 0, obaselineY);
  grad.addColorStop(0, '#fff8e3');
  grad.addColorStop(0.18, '#ffe49a');
  grad.addColorStop(0.4, '#ffb14d');
  grad.addColorStop(0.62, '#ff5e62');
  grad.addColorStop(0.82, '#c23a6b');
  grad.addColorStop(1, '#e8ecff');
  octx.fillStyle = grad;
  octx.fillText(str, ocx, obaselineY);

  // Retro horizontal chrome highlight stripes, composited with 'source-atop' onto THIS offscreen
  // canvas's own glyph pixels only — never the shared cover canvas — so they can't extend past the
  // letterforms.
  octx.save();
  octx.globalCompositeOperation = 'source-atop';
  const stripeH = Math.max(2, fitted * 0.05);
  octx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = top; y < obaselineY + fitted * 0.1; y += stripeH * 2.1) {
    octx.fillRect(0, y, off.width, stripeH);
  }
  octx.fillStyle = 'rgba(0,0,0,0.12)';
  octx.fillText(str, ocx, obaselineY); // re-darken outline edges the stripes brightened
  octx.restore();

  // Re-stroke a hairline on top so the outline stays crisp after the stripe pass.
  octx.lineWidth = Math.max(1, fitted * 0.012);
  octx.strokeStyle = 'rgba(0,0,0,0.5)';
  octx.strokeText(str, ocx, obaselineY);

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

/** An angled comic role/location callout tag (e.g. "CHOPPER 1"), Bebas Neue on a tilted ink ribbon. */
export function drawCalloutTag(ctx, x, y, text, angle = -0.08) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = `400 ${Math.max(14, Math.min(26, 20))}px 'Bebas Neue'`;
  const padX = 12, padY = 6;
  const tw = ctx.measureText(str).width;
  const bw = tw + padX * 2, bh = 26;
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

/** A 5-star heat/wanted-level bar, bold ink stars with a warm gradient fill. */
export function drawHeatBar(ctx, x, y, starSize, heat = 5) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    const sx = i * starSize * 1.08;
    drawStar(ctx, sx, 0, starSize * 0.46, i < heat ? '#ffcf3f' : 'rgba(255,255,255,0.14)');
  }
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, fill) {
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
  ctx.fillStyle = fill;
  ctx.fill();
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

/** A compact critic review strip ("★★★★★ ... — Publication"). */
export function drawReviewStrip(ctx, x, y, maxWidth, text) {
  const str = (text ?? '').trim();
  if (!str) return;
  ctx.save();
  const h = Math.max(20, maxWidth * 0.045);
  ctx.fillStyle = 'rgba(5,4,10,0.72)';
  ctx.fillRect(x, y, maxWidth, h);
  ctx.fillStyle = '#ffe9b0';
  const size = fitFont(ctx, str, maxWidth - 24, 'Bebas Neue', h * 0.6);
  ctx.font = `400 ${size}px 'Bebas Neue'`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x + 12, y + h / 2 + 1);
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
