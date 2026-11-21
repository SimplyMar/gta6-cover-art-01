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

/** The massive condensed-uppercase Anton title: sunset-to-chrome gradient fill, retro reflection
 * stripes, thick black ink outline, and a deep offset 3D drop shadow. */
export function drawTitle(ctx, w, h, text, { cx, baselineY, maxWidth, size }) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  const fitted = fitFont(ctx, str, maxWidth, 'Anton', size);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${fitted}px 'Anton'`;

  // Deep offset 3D drop shadow: a short stack of darkening offsets behind the letterforms.
  const depth = Math.max(3, fitted * 0.1);
  for (let i = Math.round(depth); i > 0; i--) {
    ctx.fillStyle = `rgba(10,4,20,${0.14 + i * 0.01})`;
    ctx.fillText(str, cx + i * 0.6, baselineY + i * 0.75);
  }

  // Thick black ink outline.
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = fitted * 0.1;
  ctx.strokeStyle = '#05040a';
  ctx.strokeText(str, cx, baselineY);

  // Blazing multi-stop sunset-to-chrome gradient fill.
  const metrics = ctx.measureText(str);
  const top = baselineY - (metrics.actualBoundingBoxAscent ?? fitted * 0.78);
  const grad = ctx.createLinearGradient(0, top, 0, baselineY);
  grad.addColorStop(0, '#fff8e3');
  grad.addColorStop(0.18, '#ffe49a');
  grad.addColorStop(0.4, '#ffb14d');
  grad.addColorStop(0.62, '#ff5e62');
  grad.addColorStop(0.82, '#c23a6b');
  grad.addColorStop(1, '#e8ecff');
  ctx.fillStyle = grad;
  ctx.fillText(str, cx, baselineY);

  // Retro horizontal reflection stripes, clipped to the glyph shapes.
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const stripeH = Math.max(2, fitted * 0.05);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = top; y < baselineY + fitted * 0.1; y += stripeH * 2.1) {
    ctx.fillRect(cx - maxWidth, y, maxWidth * 2, stripeH);
  }
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillText(str, cx, baselineY); // re-darken outline edges the stripes brightened
  ctx.restore();

  // Re-stroke a hairline on top so the outline stays crisp after the stripe pass.
  ctx.lineWidth = Math.max(1, fitted * 0.012);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeText(str, cx, baselineY);
  ctx.restore();
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

/** A corner "Edition Seal" ribbon/badge (e.g. "SUNSET PALMS EDITION"). */
export function drawSeal(ctx, w, h, text) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  const r = Math.min(w, h) * 0.085;
  const cx = w - r * 1.3, cy = r * 1.3;
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
