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

  // Thick 3D dark-purple extruded drop shadow, drawn straight onto the cover canvas BEHIND the title
  // glyph layer — a short stack of darkening purple offsets meant to show past the letterforms as a
  // heroic box-art extrusion, so it's intentionally not clipped to the glyph shapes.
  const depth = Math.max(4, fitted * 0.14);
  for (let i = Math.round(depth); i > 0; i--) {
    ctx.fillStyle = `rgba(40,12,56,${0.42 + i * 0.03})`;
    ctx.fillText(str, cx + i * 0.68, baselineY + i * 0.8);
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

  // Retro horizontal sunset stripes across the lower (coral/magenta) half of the letterforms, composited
  // with 'source-atop' so a stripe can only ever land on a pixel this glyph layer already painted —
  // never bleeding square edges past the actual letter silhouettes.
  octx.save();
  octx.globalCompositeOperation = 'source-atop';
  const stripeCount = 7;
  const stripeTop = top + (obaselineY - top) * 0.52;
  const stripeBandH = obaselineY - stripeTop;
  for (let i = 0; i < stripeCount; i++) {
    const sy = stripeTop + (i / stripeCount) * stripeBandH;
    octx.globalAlpha = i % 2 === 0 ? 0.32 : 0.14;
    octx.fillStyle = i % 2 === 0 ? '#1a0a28' : '#ffffff';
    octx.fillRect(0, sy, off.width, Math.max(1, (stripeBandH / stripeCount) * 0.48));
  }
  octx.globalAlpha = 1;
  octx.restore();

  // Re-stroke a hairline ink outline on top so it stays crisp after the gradient + stripe passes, plus a
  // luminous neon-magenta outer glow composited onto the shared cover canvas (never the offscreen glyph
  // layer) so it reads as a soft halo around the whole chrome bar instead of bleeding color onto the
  // letterforms.
  octx.lineWidth = Math.max(1, fitted * 0.012);
  octx.strokeStyle = 'rgba(0,0,0,0.5)';
  octx.strokeText(str, ocx, obaselineY);

  ctx.save();
  ctx.shadowColor = 'rgba(255,46,146,0.65)';
  ctx.shadowBlur = Math.max(8, fitted * 0.2);
  ctx.drawImage(off, cx - ocx, baselineY - obaselineY);
  ctx.shadowBlur = Math.max(8, fitted * 0.2);
  ctx.drawImage(off, cx - ocx, baselineY - obaselineY);
  ctx.restore();

  // Composite the finished, strictly glyph-clipped title layer onto the cover canvas.
  ctx.drawImage(off, cx - ocx, baselineY - obaselineY);

  // 2-3 subtle 4-point chrome star glints riding the title's upper letter corners.
  const glintR = fitted * 0.055;
  drawStarGlint(ctx, cx - maxWidth * 0.3, baselineY - fitted * 0.74, glintR);
  drawStarGlint(ctx, cx + maxWidth * 0.33, baselineY - fitted * 0.58, glintR * 0.8);
  drawStarGlint(ctx, cx - maxWidth * 0.02, baselineY - fitted * 0.92, glintR * 0.65);

  return fitted;
}

/** A tiny 4-point chrome sparkle/glint (a cross plus a thinner diagonal cross), for subtle corner
 * highlights on the box-art title. */
function drawStarGlint(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.55); ctx.lineTo(r * 0.55, r * 0.55);
  ctx.moveTo(-r * 0.55, r * 0.55); ctx.lineTo(r * 0.55, -r * 0.55);
  ctx.stroke();
  ctx.restore();
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

  // Larger, more vibrant hot-pink neon brush/script: a wide soft pink halo, a tighter hot-magenta core
  // glow, then a crisp near-white fill so the brush stroke itself stays readable through the glow.
  ctx.shadowColor = 'rgba(255,20,160,0.95)';
  ctx.shadowBlur = fitted * 0.62;
  ctx.fillStyle = '#ff6fd8';
  ctx.fillText(str, 0, 0);
  ctx.shadowColor = 'rgba(255,60,220,0.95)';
  ctx.shadowBlur = fitted * 0.4;
  ctx.fillText(str, 0, 0);
  ctx.shadowColor = 'rgba(70,230,255,0.6)';
  ctx.shadowBlur = fitted * 0.22;
  ctx.fillText(str, 0, 0);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff6fb';
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

/** A sleek skewed coral-gold tagline ribbon banner (e.g. "EVERY COAST HAS A PRICE"), sized to fit its
 * own measured text, for placement just beneath the neon script subtitle. */
export function drawTaglineRibbon(ctx, w, h, text, { cx, y, maxWidth, size }) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  ctx.save();
  const fitted = fitFont(ctx, str, maxWidth * 0.86, 'Bebas Neue', size);
  ctx.font = `400 ${fitted}px 'Bebas Neue'`;
  const textW = ctx.measureText(str).width;
  const padX = fitted * 0.9, padY = fitted * 0.4;
  const rw = Math.min(maxWidth, textW + padX * 2);
  const rh = fitted + padY * 2;
  const skew = rh * 0.3;
  ctx.translate(cx, y);
  ctx.rotate(-0.02);
  const grad = ctx.createLinearGradient(-rw / 2, 0, rw / 2, 0);
  grad.addColorStop(0, '#ffcf7a');
  grad.addColorStop(0.5, '#ff8a6b');
  grad.addColorStop(1, '#c23a6b');
  ctx.beginPath();
  ctx.moveTo(-rw / 2 + skew, -rh / 2);
  ctx.lineTo(rw / 2 + skew, -rh / 2);
  ctx.lineTo(rw / 2 - skew, rh / 2);
  ctx.lineTo(-rw / 2 - skew, rh / 2);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#05040a';
  ctx.lineWidth = Math.max(1, fitted * 0.06);
  ctx.stroke();
  ctx.fillStyle = '#1a0b22';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, 0, fitted * 0.04);
  ctx.restore();
}

/** An angled comic role/location callout tag (e.g. "CHOPPER 1"), Bebas Neue on a tilted ink ribbon.
 * `(x, y)` is the tag's BOTTOM-LEFT anchor point (before rotation) — callers always pin these to the
 * bottom-left corner of a panel so tags never climb into the top-of-frame review strip / edition seal. */
export function drawCalloutTag(ctx, x, y, text, angle = -0.08) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  ctx.save();
  ctx.font = `400 20px 'Bebas Neue'`;
  const padX = 13, padY = 6;
  const accentW = 6;
  const tw = ctx.measureText(str).width;
  const bw = tw + padX * 2 + accentW, bh = 26;
  const skew = bh * 0.32;
  // Translate so the tag's own bottom-left corner lands at (x, y), then rotate about its center.
  ctx.translate(x + bw / 2, y - bh / 2);
  ctx.rotate(angle);

  // Sharp skewed dark-navy plate (a parallelogram, not a plain rect).
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + skew, -bh / 2);
  ctx.lineTo(bw / 2 + skew, -bh / 2);
  ctx.lineTo(bw / 2 - skew, bh / 2);
  ctx.lineTo(-bw / 2 - skew, bh / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,14,32,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(231,182,92,0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bright gold left accent slash, sharing the plate's own skew.
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + skew, -bh / 2);
  ctx.lineTo(-bw / 2 + skew + accentW, -bh / 2);
  ctx.lineTo(-bw / 2 - skew + accentW, bh / 2);
  ctx.lineTo(-bw / 2 - skew, bh / 2);
  ctx.closePath();
  ctx.fillStyle = '#ffd36e';
  ctx.fill();

  ctx.fillStyle = '#ffe9b0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, accentW * 0.5, 1);
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
export function drawSeal(ctx, w, h, text, topInset = 0) {
  const str = (text ?? '').trim().toUpperCase();
  if (!str) return;
  const r = Math.min(w, h) * 0.062;
  const cx = w - r * 1.08, cy = topInset + r * 1.08;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);

  // Crisp multi-point serrated gold-foil sunburst outer edge (alternating long points / short valleys)
  // in place of the old flat circular badge.
  const points = 16;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, '#fff3c4');
  grad.addColorStop(0.55, '#ffb14d');
  grad.addColorStop(1, '#9c3a63');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = '#05040a';
  ctx.stroke();

  // Dark inner ring.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(5,4,10,0.85)';
  ctx.lineWidth = r * 0.07;
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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The dedicated dark-plum cinema HEADER strip, reserved ABOVE the photo mosaic — so it can never
 * overlap any panel (the helicopter banner included). Draws luminous gold heat stars + a crisp critic
 * review pull-quote on the left, and a sharp gold-bordered "VOL. 1" pill on the right. */
export function drawCinemaHeader(ctx, w, stripH, { reviewText, volText = 'VOL. 1', heat = 5 } = {}) {
  ctx.save();
  ctx.fillStyle = '#1c0f26';
  ctx.fillRect(0, 0, w, stripH);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, stripH - Math.max(1, stripH * 0.05), w, Math.max(1, stripH * 0.05));

  const midY = stripH * 0.52;
  const starR = stripH * 0.2;
  const padX = stripH * 0.5;
  let sx = padX + starR;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, sx, midY, starR, i < Math.round(heat));
    sx += starR * 2.1;
  }

  // Gold-bordered VOL. pill, right side — measured first so the review quote's max width can never
  // reach far enough right to collide with it.
  const pillH = stripH * 0.62;
  const pillPadX = pillH * 0.42;
  ctx.font = `400 ${pillH * 0.5}px 'Bebas Neue'`;
  const volW = ctx.measureText(volText.toUpperCase()).width;
  const pillW = volW + pillPadX * 2;
  const pillX = w - pillW - stripH * 0.5;
  const pillY = (stripH - pillH) / 2;

  const str = (reviewText ?? '').trim();
  if (str) {
    const quoteMaxW = Math.max(40, pillX - (sx + starR * 0.5) - stripH * 0.3);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const fsize = fitFont(ctx, str, quoteMaxW, 'Bebas Neue', stripH * 0.4);
    ctx.font = `400 ${fsize}px 'Bebas Neue'`;
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(str, sx + starR * 0.5, midY);
  }

  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH * 0.5);
  ctx.fillStyle = 'rgba(5,4,10,0.92)';
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, stripH * 0.035);
  ctx.strokeStyle = '#e7b65c';
  ctx.stroke();
  ctx.font = `400 ${pillH * 0.5}px 'Bebas Neue'`;
  ctx.fillStyle = '#ffd36e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(volText.toUpperCase(), pillX + pillW / 2, pillY + pillH / 2 + 1);
  ctx.restore();
}

/** A high-contrast retail-style UPC barcode on crisp white paper, with serial digits printed below —
 * a deterministic pseudo-random bar pattern seeded from the serial string, so it is reproducible but
 * reads as a real symbol rather than a uniform striped placeholder. */
function drawBarcode(ctx, x, y, w, h, serial) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  const barsX = x + w * 0.06, barsW = w * 0.88;
  const barsY = y + h * 0.1, barsH = h * 0.6;
  let seed = 0;
  for (const ch of serial) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  ctx.fillStyle = '#000000';
  const unit = barsW / 70;
  let bx = barsX;
  while (bx < barsX + barsW - unit) {
    const wUnits = 1 + Math.floor(rand() * 3);
    if (rand() > 0.42) ctx.fillRect(bx, barsY, wUnits * unit * 0.8, barsH);
    bx += wUnits * unit;
  }

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${h * 0.2}px 'Bebas Neue'`;
  ctx.fillText(serial, x + w / 2, y + h * 0.96);
  ctx.restore();
}

/** The dedicated dark-plum cinema FOOTER strip, reserved BELOW the photo mosaic. Left: a "RATED HEAT"
 * 5-star badge block (or a "COMING SOON" gold-rule block when the heat badge is switched off). Center:
 * a clean readable 2-line movie billing block. Right: a crisp high-contrast retail UPC barcode with
 * serial digits on white paper. */
export function drawCinemaFooter(ctx, w, stripY, stripH, { heat = 5, showHeat = true, billingLine1, billingLine2, barcodeSerial } = {}) {
  ctx.save();
  ctx.fillStyle = '#1c0f26';
  ctx.fillRect(0, stripY, w, stripH);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, stripY, w, Math.max(1, stripH * 0.05));

  const midY = stripY + stripH * 0.5;
  const padX = stripH * 0.5;

  if (showHeat) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${stripH * 0.24}px 'Bebas Neue'`;
    ctx.fillStyle = '#ffd36e';
    ctx.fillText('RATED HEAT', padX, stripY + stripH * 0.32);
    const starR = stripH * 0.15;
    let sx = padX + starR;
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, sx, stripY + stripH * 0.64, starR, i < heat);
      sx += starR * 2.1;
    }
  } else {
    ctx.strokeStyle = '#e7b65c';
    ctx.lineWidth = Math.max(1, stripH * 0.028);
    const ruleW = stripH * 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, midY); ctx.lineTo(padX + ruleW, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padX + ruleW * 2.05, midY); ctx.lineTo(padX + ruleW * 3.05, midY);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${stripH * 0.28}px 'Bebas Neue'`;
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText('COMING SOON', padX + ruleW * 1.52, midY);
  }

  if (billingLine1 || billingLine2) {
    ctx.textAlign = 'center';
    const l1 = (billingLine1 ?? '').toUpperCase();
    const l2 = (billingLine2 ?? '').toUpperCase();
    if (l1) {
      ctx.textBaseline = 'middle';
      const size1 = fitFont(ctx, l1, w * 0.3, 'Bebas Neue', stripH * 0.22);
      ctx.font = `400 ${size1}px 'Bebas Neue'`;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fillText(l1, w / 2, stripY + stripH * 0.36);
    }
    if (l2) {
      ctx.textBaseline = 'middle';
      const size2 = fitFont(ctx, l2, w * 0.32, 'Bebas Neue', stripH * 0.17);
      ctx.font = `400 ${size2}px 'Bebas Neue'`;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(l2, w / 2, stripY + stripH * 0.58);
    }
  }

  const bcW = stripH * 2.3, bcH = stripH * 0.72;
  drawBarcode(ctx, w - bcW - padX, stripY + stripH * 0.14, bcW, bcH, barcodeSerial ?? '8 41100 00000 5');
  ctx.restore();
}
