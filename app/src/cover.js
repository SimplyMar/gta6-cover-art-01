// The full high-resolution cover renderer: drawCover(canvas, state, options) draws every panel
// (photo or procedural backdrop), the GTA-style asymmetric ink gutters and frame, the Poster Ink
// illustration filter, the cinematic color grade + sky bloom, and every lettering/overlay layer —
// shared by the live editor preview and the full-resolution PNG export, so what you see is what you
// export. Pass { exportMode: true } (or render in ?shot=cover mode) to suppress the selection outline.

import { LAYOUTS, bboxOf, borderFor, centroidOf, photoBoxFor } from './layouts.js';
import { GRADES, applyGrade, paintSkyBloom } from './grades.js';
import { applyPosterInk } from './posterize.js';
import { drawTitle, drawSubtitle, drawCalloutTag, drawHeatBar, drawSeal, drawReviewStrip, drawBillingBlock } from './typography.js';

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

  const layout = LAYOUTS[state.layout] ?? LAYOUTS.classic5;
  const panels = layout.build(w, h);
  const inkStrength = state.inkStrength ?? 0.6;
  const posterizeLevels = state.posterizeLevels ?? 5;
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

    if (panState.img) {
      drawPhoto(ctx, panState.img, pbox.x, pbox.y, pbox.w, pbox.h, panState);
    } else {
      drawProcedural(ctx, pbox.x, pbox.y, pbox.w, pbox.h, index);
    }
    applyGrade(ctx, pbox.x, pbox.y, pbox.w, pbox.h, gradeId, panState.gradeStrength ?? 0.42);
    if (inkEnabled) applyPosterInk(ctx, pbox.x, pbox.y, pbox.w, pbox.h, { inkStrength, posterizeLevels, grain });
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

  // Outer frame.
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = shortSide * 0.028;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  if (state.skyBloom !== false) paintSkyBloom(ctx, w, h, state.grade ?? state.panels[0]?.grade ?? 'vice-sunset');

  if (state.showCallouts !== false) {
    panels.forEach((panel, index) => {
      if (!panel.label) return;
      const text = state.panels[index]?.label || panel.label;
      const c = centroidOf(panel.poly);
      const box = bboxOf(panel.poly);
      const anchorY = panel.frame === 'polaroid' ? box.y + box.h * 0.84 : box.y + box.h * 0.14;
      drawCalloutTag(ctx, c.x, anchorY, text, panel.angle ?? -0.07);
    });
  }

  if (state.showHeat !== false) drawHeatBar(ctx, shortSide * 0.045, h - shortSide * 0.055, shortSide * 0.05, state.heat ?? 5);
  if (state.showSeal !== false) drawSeal(ctx, w, h, state.sealText ?? 'SUNSET PALMS EDITION');
  if (state.showReview !== false && state.reviewText) drawReviewStrip(ctx, 0, h * 0.04, w * 0.62, state.reviewText);

  drawTitleBlock(ctx, w, h, state);

  if (state.showBilling !== false && state.billingText) drawBillingBlock(ctx, w, h, state.billingText);

  ctx.restore();
}

function drawTitleBlock(ctx, w, h, state) {
  const title = (state.title ?? '').trim();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return;
  const bandH = h * (subtitle ? 0.24 : 0.16);
  const bandY = h - bandH;
  ctx.save();
  const grad = ctx.createLinearGradient(0, bandY, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.72)');
  grad.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);

  if (title) {
    drawTitle(ctx, w, h, title, {
      cx: w / 2,
      baselineY: h - bandH * (subtitle ? 0.58 : 0.4),
      maxWidth: w * 0.9,
      size: h * 0.13,
    });
  }
  if (subtitle) {
    drawSubtitle(ctx, w, h, subtitle, {
      cx: w / 2,
      y: h - bandH * 0.16,
      maxWidth: w * 0.75,
      size: h * 0.05,
    });
  }
  ctx.restore();
}
