// Draws a Vice Panels cover: a set of asymmetric comic-style panels (photo or procedural fill, each
// with its own pan/zoom/grade), bold black ink borders and gutters, a title/subtitle banner, and a
// corner emblem badge. `drawCover(canvas, state)` renders at the canvas's own pixel size, so the same
// function serves the live editor preview and the full-resolution PNG export.

import { LAYOUTS, bboxOf, borderFor } from './layouts.js';
import { GRADES, paintGradeOverlay } from './filters.js';

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

/** Procedural coastal-noir filler art, so every panel looks finished before any photo is loaded. */
function drawProcedural(ctx, x, y, w, h, index) {
  const palette = PALETTES[index % PALETTES.length];
  const rand = seededRandom(index * 97 + 13);
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.55, palette[1]);
  grad.addColorStop(1, palette[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Sun / moon disc.
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

  // Horizon scanlines.
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

  // Skyline silhouette.
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

  // Palm silhouette accent on alternating panels.
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

  // Grain / noise specks for texture.
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 40; i++) {
    const gx = x + rand() * w;
    const gy = y + rand() * h;
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
}

function drawPhoto(ctx, img, x, y, w, h, panState) {
  const zoom = panState.zoom ?? 1;
  const baseScale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const pw = img.naturalWidth * baseScale;
  const ph = img.naturalHeight * baseScale;
  const maxOffX = Math.max(0, (pw - w) / 2);
  const maxOffY = Math.max(0, (ph - h) / 2);
  const offX = Math.min(maxOffX, Math.max(-maxOffX, (panState.offsetX ?? 0) * maxOffX));
  const offY = Math.min(maxOffY, Math.max(-maxOffY, (panState.offsetY ?? 0) * maxOffY));
  const dx = x + (w - pw) / 2 - offX;
  const dy = y + (h - ph) / 2 - offY;
  ctx.drawImage(img, dx, dy, pw, ph);
}

/** Renders the full cover onto `canvas` (its own width/height define the output resolution). */
export function drawCover(canvas, state) {
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

  panels.forEach((panel, index) => {
    const box = bboxOf(panel.poly);
    const panState = state.panels[index] ?? {};

    ctx.save();
    ctx.beginPath();
    panel.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.clip();

    const gradeId = panState.grade ?? 'vice-sunset';
    ctx.filter = (GRADES[gradeId] ?? GRADES['vice-sunset']).filter;
    if (panState.img) {
      drawPhoto(ctx, panState.img, box.x, box.y, box.w, box.h, panState);
    } else {
      drawProcedural(ctx, box.x, box.y, box.w, box.h, index);
    }
    ctx.filter = 'none';
    paintGradeOverlay(ctx, gradeId, box.x, box.y, box.w, box.h);
    ctx.restore();

    if (state.selectedPanel === index) {
      ctx.save();
      ctx.setLineDash([shortSide * 0.012, shortSide * 0.01]);
      ctx.lineWidth = Math.max(2, shortSide * 0.006);
      ctx.strokeStyle = '#ffe066';
      ctx.beginPath();
      panel.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  });

  // Bold black ink borders over every panel seam, asymmetric per panel.
  panels.forEach((panel, index) => {
    ctx.save();
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = borderFor(index, shortSide);
    ctx.beginPath();
    panel.poly.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });

  // Outer frame.
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = shortSide * 0.028;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  drawTitleBlock(ctx, w, h, state);
  drawEmblem(ctx, w, h, state);

  ctx.restore();
}

function fitText(ctx, text, maxWidth, startSize, weight = 800) {
  let size = startSize;
  ctx.font = `${weight} ${size}px 'Arial Black', Arial, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px 'Arial Black', Arial, sans-serif`;
  }
  return size;
}

function drawTitleBlock(ctx, w, h, state) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim();
  if (!title && !subtitle) return;

  const bandH = h * (subtitle ? 0.2 : 0.14);
  const bandY = h - bandH;
  const grad = ctx.createLinearGradient(0, bandY, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, w, bandH);

  ctx.textAlign = 'center';
  if (title) {
    const size = fitText(ctx, title, w * 0.88, h * 0.11);
    ctx.font = `800 ${size}px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = size * 0.11;
    ctx.lineJoin = 'round';
    const ty = h - bandH * (subtitle ? 0.52 : 0.38);
    ctx.strokeText(title, w / 2, ty);
    const grd = ctx.createLinearGradient(0, ty - size, 0, ty);
    grd.addColorStop(0, '#fff3c4');
    grd.addColorStop(1, '#ff5e62');
    ctx.fillStyle = grd;
    ctx.fillText(title, w / 2, ty);
  }
  if (subtitle) {
    const size = fitText(ctx, subtitle.toUpperCase(), w * 0.7, h * 0.035, 600);
    ctx.font = `600 ${size}px Arial, sans-serif`;
    ctx.fillStyle = '#ffe066';
    ctx.letterSpacing = `${size * 0.25}px`;
    ctx.fillText(subtitle.toUpperCase(), w / 2, h - bandH * 0.12);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
}

function drawEmblem(ctx, w, h, state) {
  const text = (state.emblem ?? '').trim().toUpperCase();
  if (!text) return;
  const r = Math.min(w, h) * 0.075;
  const cx = w - r * 1.4;
  const cy = r * 1.4;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, '#ffd36e');
  grad.addColorStop(1, '#ff2e92');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = r * 0.22;
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitText(ctx, text, r * 1.5, r * 0.6);
  ctx.font = `800 ${size}px 'Arial Black', Arial, sans-serif`;
  ctx.fillText(text, cx, cy + size * 0.05);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
