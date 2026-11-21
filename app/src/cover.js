// The full high-resolution cover renderer: drawCover(canvas, state, options) draws every panel
// (photo or procedural backdrop), the GTA-style asymmetric ink gutters and frame, the Poster Ink
// illustration filter, the cinematic color grade + sky bloom, and every lettering/overlay layer —
// shared by the live editor preview and the full-resolution PNG export, so what you see is what you
// export. Pass { exportMode: true } (or render in ?shot=cover mode) to suppress the selection outline.

import { LAYOUTS, bboxOf, borderFor, photoBoxFor } from './layouts.js';
import { GRADES, applyGrade, paintSkyBloom } from './grades.js';
import { applyPosterInk } from './posterize.js';
import { drawTitle, drawSubtitle, drawTaglineRibbon, drawCalloutTag, drawSeal, drawCinemaHeader, drawCinemaFooter } from './typography.js';

// Dedicated cinema poster frame: a crisp dark-plum header strip and a dedicated billing footer strip,
// both OUTSIDE the multi-panel photo mosaic, so neither ever collides with a panel photo.
const HEADER_FRAC = 0.06;
const FOOTER_FRAC = 0.095;

/** The mosaic's own y-bounds within a `w` x `h` canvas, after reserving the header/footer strips. */
export function mosaicBounds(w, h) {
  const y0 = h * HEADER_FRAC;
  const y1 = h - h * FOOTER_FRAC;
  return { y0, y1, h: y1 - y0 };
}

/** Builds `layoutId`'s panels against the shrunk mosaic height, then offsets every polygon down by the
 * header strip's height — the single source of panel geometry shared by drawCover's own render pass and
 * every click-hit-test / drag-pan / face-anchor call site in main.js, so they always agree. */
export function buildMosaicPanels(layoutId, w, h) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.classic5;
  const { y0, h: mosaicH } = mosaicBounds(w, h);
  return layout.build(w, mosaicH).map((p) => ({ ...p, poly: p.poly.map(([px, py]) => [px, py + y0]) }));
}

const PALETTES = [
  ['#ff5e62', '#2b1838', '#ffb347'],
  ['#1de9b6', '#0f2027', '#ff2e92'],
  ['#ffd36e', '#3a0ca3', '#ff5e62'],
  ['#2bd9fe', '#120024', '#ff9f1c'],
  ['#ff2e92', '#1a1a2e', '#ffd36e'],
  ['#3ddc97', '#2b1838', '#ff5e62'],
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Procedural Leonida sunset filler art, so every panel looks finished before any photo is loaded. */
function drawProcedural(ctx, x, y, w, h, index) {
  const palette = PALETTES[index % PALETTES.length];
  const rand = seededRandom(index * 97 + 13);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.55, palette[1]);
  grad.addColorStop(1, palette[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  const sunR = Math.min(w, h) * (0.18 + rand() * 0.08);
  const sunX = x + w * (0.3 + rand() * 0.4);
  const sunY = y + h * (0.32 + rand() * 0.18);
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  sunGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
  sunGrad.addColorStop(0.6, palette[2]);
  sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.006);
  const horizonY = y + h * 0.58;
  for (let i = 0; i < 5; i++) {
    const ly = horizonY + i * h * 0.07;
    const inset = w * 0.08 * i * 0.6;
    ctx.beginPath();
    ctx.moveTo(x + inset, ly);
    ctx.lineTo(x + w - inset, ly);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(10,8,20,0.75)';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  let cx = x;
  let toggle = index % 2;
  while (cx < x + w) {
    const bw = w * (0.06 + rand() * 0.07);
    const bh = h * (0.12 + rand() * (toggle ? 0.26 : 0.16));
    ctx.lineTo(cx, horizonY - bh);
    ctx.lineTo(cx + bw, horizonY - bh);
    cx += bw;
    toggle = 1 - toggle;
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  if (index % 3 !== 2) {
    const px = x + w * (index % 2 === 0 ? 0.14 : 0.86);
    const baseY = y + h;
    const trunkH = h * 0.42;
    ctx.strokeStyle = 'rgba(5,5,10,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.018);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, baseY);
    ctx.quadraticCurveTo(px + w * 0.04, baseY - trunkH * 0.6, px + w * 0.02, baseY - trunkH);
    ctx.stroke();
    const frondBase = { x: px + w * 0.02, y: baseY - trunkH };
    ctx.fillStyle = 'rgba(5,5,10,0.85)';
    for (let f = 0; f < 6; f++) {
      const angle = (-Math.PI / 2) + (f - 2.5) * 0.45;
      const len = Math.min(w, h) * 0.26;
      ctx.beginPath();
      ctx.moveTo(frondBase.x, frondBase.y);
      ctx.quadraticCurveTo(
        frondBase.x + Math.cos(angle) * len * 0.6,
        frondBase.y + Math.sin(angle) * len * 0.6 - len * 0.15,
        frondBase.x + Math.cos(angle) * len,
        frondBase.y + Math.sin(angle) * len,
      );
      ctx.lineWidth = Math.max(2, w * 0.03);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 40; i++) {
    const gx = x + rand() * w;
    const gy = y + rand() * h;
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
}

/** Draws a photo cover-fit into (x, y, w, h), honoring zoom/pan (each ±1) and a horizontal flip. */
function drawPhoto(ctx, img, x, y, w, h, panState) {
  const zoom = panState.zoom ?? 1;
  const baseScale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * baseScale;
  const ph = img.naturalHeight * baseScale;
  const maxOffX = Math.max(0, (pw - w) / 2);
  const maxOffY = Math.max(0, (ph - h) / 2);
  const offX = Math.min(maxOffX, Math.max(-maxOffX, (panState.offsetX ?? 0) * maxOffX));
  const offY = Math.min(maxOffY, Math.max(-maxOffY, (panState.offsetY ?? 0) * maxOffY));
  const dx = (w - pw) / 2 - offX;
  const dy = (h - ph) / 2 - offY;
  ctx.save();
  ctx.translate(x, y);
  if (panState.flipX) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

function clipPoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.clip();
}

function strokePoly(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.stroke();
}

/** Renders the full cover onto `canvas` (its own width/height define the output resolution). */
export function drawCover(canvas, state, options = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const shortSide = Math.min(w, h);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#05040a';
  ctx.fillRect(0, 0, w, h);

  // Reserve the top 6% / bottom 9.5% cinema header + billing footer strips OUTSIDE the photo mosaic —
  // see buildMosaicPanels/mosaicBounds, shared with main.js so click-hit-testing, drag-pan, and
  // face-anchor math always agree with what's actually drawn here.
  const { y0: mosaicY0, y1: mosaicY1, h: mosaicH } = mosaicBounds(w, h);
  const headerH = mosaicY0;
  const footerH = h - mosaicY1;
  const panels = buildMosaicPanels(state.layout, w, h);
  const inkStrength = state.inkStrength ?? 0.3;
  const posterizeLevels = state.posterizeLevels ?? 10;
  const grain = state.grain ?? 0.25;
  const inkEnabled = state.inkEnabled !== false;

  panels.forEach((panel, index) => {
    const box = bboxOf(panel.poly);
    const panState = state.panels[index] ?? {};
    const gradeId = panState.grade ?? state.grade ?? 'vice-sunset';

    ctx.save();
    clipPoly(ctx, panel.poly);

    if (panel.frame === 'polaroid') {
      // Crisp white polaroid card behind the photo, so the clipped photo reads as a tilted snapshot.
      ctx.fillStyle = '#f7f4ec';
      ctx.fillRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
    }
    const pbox = photoBoxFor(panel);
    // Render this panel's art, grade, and Poster Ink onto a dedicated offscreen canvas sized to the
    // panel's full bbox (`box`), not the narrower inner `pbox`. applyGrade/applyPosterInk read and write
    // raw pixels via getImageData/putImageData, which ignore the active polygon clip entirely — confining
    // them to the narrower pbox on a slanted panel left the sliver between pbox and the panel's own
    // diagonal cut edges completely ungraded and un-inked, which read as a stray vertical seam right next
    // to the clip. Painting the art and running the full grade + ink pass over the ENTIRE offscreen
    // canvas, then compositing that single finished layer through the clip, guarantees even coverage all
    // the way to the slanted seam with nothing escaping into neighboring panels.
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.ceil(box.w));
    off.height = Math.max(1, Math.ceil(box.h));
    const octx = off.getContext('2d');
    const drawBoxSrc = (panel.leftSlant || panel.rightSlant) ? box : pbox;
    const drawBox = { x: drawBoxSrc.x - box.x, y: drawBoxSrc.y - box.y, w: drawBoxSrc.w, h: drawBoxSrc.h };

    if (panState.img) {
      drawPhoto(octx, panState.img, drawBox.x, drawBox.y, drawBox.w, drawBox.h, panState);
    } else {
      drawProcedural(octx, drawBox.x, drawBox.y, drawBox.w, drawBox.h, index);
    }
    applyGrade(octx, 0, 0, off.width, off.height, gradeId, panState.gradeStrength ?? 0.36);
    if (inkEnabled) applyPosterInk(octx, 0, 0, off.width, off.height, { inkStrength, posterizeLevels, grain });
    ctx.drawImage(off, box.x, box.y);
    ctx.restore();

    if (state.selectedPanel === index && !options.exportMode) {
      ctx.save();
      ctx.setLineDash([shortSide * 0.012, shortSide * 0.01]);
      ctx.lineWidth = Math.max(2, shortSide * 0.006);
      ctx.strokeStyle = '#ffe066';
      strokePoly(ctx, panel.poly);
      ctx.restore();
    }
  });

  // Bold black ink borders over every panel seam, asymmetric per panel; polaroids get a thin black
  // frame close to the card edge instead of a heavy comic gutter.
  panels.forEach((panel, index) => {
    ctx.save();
    ctx.lineJoin = 'miter';
    if (panel.frame === 'polaroid') {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, shortSide * 0.004);
    } else if (panel.frame === 'hero') {
      ctx.strokeStyle = '#ffd36e';
      ctx.lineWidth = borderFor(index, shortSide) * 1.3;
      strokePoly(ctx, panel.poly);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = borderFor(index, shortSide) * 0.55;
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = borderFor(index, shortSide);
    }
    strokePoly(ctx, panel.poly);
    ctx.restore();
  });

  // vice6's inner seams get a crisp white/cream 2px hairline nested inside the thick dark gutter, drawn
  // right on top of the black border stroke above (the black is wider, so the cream line reads as a
  // crisp accent centered within it) so the mosaic pops with dynamic crime-epic energy.
  if (state.layout === 'vice6') {
    panels.forEach((panel) => {
      if (panel.frame === 'polaroid') return;
      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = 'rgba(245,240,225,0.92)';
      ctx.lineWidth = Math.max(1.5, shortSide * 0.002);
      strokePoly(ctx, panel.poly);
      ctx.restore();
    });
  }

  // Sharp 1.5px warm-gold outer keyline border framing the photo mosaic — distinct from the header and
  // footer strips, which sit outside it.
  ctx.save();
  ctx.strokeStyle = '#e7b65c';
  ctx.lineWidth = Math.max(1.5, shortSide * 0.0014);
  ctx.strokeRect(ctx.lineWidth / 2, mosaicY0 + ctx.lineWidth / 2, w - ctx.lineWidth, mosaicH - ctx.lineWidth);
  ctx.restore();

  if (state.skyBloom !== false) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, mosaicY0, w, mosaicH);
    ctx.clip();
    paintSkyBloom(ctx, w, h, state.grade ?? state.panels[0]?.grade ?? 'vice-sunset');
    ctx.restore();
  }

  if (state.showCallouts !== false) {
    // Every callout tag is pinned to the bottom-left corner of its own panel, inset by a fixed margin —
    // never the top (where the edition seal lives) and never low enough to collide with the title
    // block's actual rendered glyphs (which rise well above its gradient band — see titleSafeTop), both
    // of which sit flush to the mosaic's own bottom edge (not the whole canvas, now that the billing
    // footer strip is reserved separately). Clamp each tag's y upward, clearing whichever it would overlap.
    const inset = Math.max(10, shortSide * 0.012);
    const safeTop = titleSafeTop(w, mosaicY1, state);

    panels.forEach((panel, index) => {
      if (!panel.label) return;
      const text = state.panels[index]?.label || panel.label;
      const box = bboxOf(panel.poly);
      const tagX = box.x + inset;
      let tagY = box.y + box.h - inset;
      if (Number.isFinite(safeTop)) tagY = Math.min(tagY, safeTop - inset);
      tagY = Math.max(tagY, box.y + inset + 20); // never climb above its own panel's top edge
      drawCalloutTag(ctx, tagX, tagY, text, panel.angle ?? -0.07);
    });
  }

  if (state.showSeal !== false) drawSeal(ctx, w, h, state.sealText ?? 'SUNSET PALMS EDITION', mosaicY0);

  drawTitleBlock(ctx, w, mosaicY1, state);

  // The dedicated cinema header + footer strips are drawn LAST, on top of everything else (mosaic,
  // frame, title) — they occupy their own reserved bands outside the mosaic, so nothing above can ever
  // bleed into or collide with them.
  drawCinemaHeader(ctx, w, headerH, { reviewText: state.showReview !== false ? state.reviewText : '', heat: state.heat ?? 5 });
  drawCinemaFooter(ctx, w, mosaicY1, footerH, {
    heat: state.heat ?? 5,
    showHeat: state.showHeat !== false,
    billingLine1: state.showBilling !== false ? 'SUNSET PALMS PICTURES PRESENTS' : '',
    billingLine2: state.showBilling !== false ? state.billingText : '',
    barcodeSerial: state.barcodeSerial,
  });

  // Final outer black frame, traced over the whole poster (header + mosaic + footer) last, so the
  // cinema box-cover silhouette reads as one crisp, continuous edge. Deliberately much thinner than the
  // comic-gutter borders inside the mosaic — the header/footer strips are only 6%/9.5% of the canvas
  // height, and the old heavy 0.028-weight frame ate visibly into their stars/pill/barcode content.
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(2, shortSide * 0.007);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  ctx.restore();
}

/** How far the bottom title block's actual rendered glyphs reach above `floorY` (the bottom of the
 * photo mosaic, not necessarily the whole canvas) — the Anton title's ascenders (plus its drop shadow)
 * rise well above its own semi-transparent gradient band, so panel callout tags need to clear THIS
 * line, not just the band's nominal top edge. Returns Infinity when no title/subtitle is set (nothing
 * to clear). Mirrors drawTitleBlock's own baselineY/size math. */
function titleSafeTop(w, floorY, state) {
  const title = (state.title ?? '').trim();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return Infinity;
  if (title) {
    const baselineY = floorY - floorY * 0.17;
    return baselineY - floorY * 0.182 * 0.95; // Anton ascent (~0.78 of size) plus a safety margin
  }
  const subY = floorY - floorY * 0.105;
  return subY - floorY * 0.065 * 1.3; // Pacifico's glow + ascent, centered on subY
}

/** Draws the heroic title/subtitle/tagline block, anchored to `floorY` — the bottom of the photo
 * mosaic — rather than the full canvas height, so it always sits over the photo mosaic itself and never
 * intrudes into the dedicated billing footer strip below it. */
function drawTitleBlock(ctx, w, floorY, state) {
  const title = (state.title ?? '').trim();
  const subtitle = (state.subtitle ?? '').trim();
  const tagline = (state.tagline ?? 'EVERY COAST HAS A PRICE').trim();
  if (!title && !subtitle) return;
  const bandH = floorY * (tagline ? 0.38 : subtitle ? 0.28 : 0.2);
  const bandY = floorY - bandH;
  ctx.save();
  const grad = ctx.createLinearGradient(0, bandY, 0, floorY);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.72)');
  grad.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);

  if (title) {
    // Bold condensed display, ~1.4x bigger than the original box-art title, anchored across the
    // lower-center with zero face collisions (clamped against titleSafeTop by the callout-tag logic).
    drawTitle(ctx, w, floorY, title, {
      cx: w / 2,
      baselineY: floorY - floorY * 0.17,
      maxWidth: w * 0.94,
      size: floorY * 0.182,
    });
  }
  if (subtitle) {
    drawSubtitle(ctx, w, floorY, subtitle, {
      cx: w / 2,
      y: floorY - floorY * 0.105,
      maxWidth: w * 0.8,
      size: floorY * 0.065,
    });
  }
  if (tagline) {
    drawTaglineRibbon(ctx, w, floorY, tagline, {
      cx: w / 2,
      y: floorY - floorY * 0.032,
      maxWidth: w * 0.56,
      size: floorY * 0.026,
    });
  }
  ctx.restore();
}
