// Panel geometry for Sunset Palms Cover Studio. Each layout is a function(w, h) -> Panel[], where a
// Panel is { id, poly: [[x,y], ...], frame: 'ink'|'polaroid', calloutAngle } in pixel space (y-down).
// Layouts are deliberately asymmetric — a hand-built comic page, not a mechanical grid — and a few
// panels use rotated rectangles (polaroids5) rather than axis-aligned ones; pointInPoly and bboxOf
// work the same either way, so the rest of the renderer never needs to know the difference.

function rect(x0, y0, x1, y1, frame = 'ink') {
  return { poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], frame };
}

/** A rectangle of half-size (hw, hh) centered at (cx, cy), rotated by `angle` radians. */
function rotRect(cx, cy, hw, hh, angle) {
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const c = Math.cos(angle), s = Math.sin(angle);
  return corners.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function fp(w, h, fx, fy) { return [fx * w, fy * h]; }

/** vice6 — iconic 6-panel box art: wide helicopter banner top-left, tall hero portrait left, 4 staggered panels. */
function vice6(w, h) {
  const c1 = 0.42, c2 = 0.68;
  const r = (x0, y0, x1, y1) => rect(x0 * w, y0 * h, x1 * w, y1 * h);
  return [
    { id: 0, ...r(0, 0, c1, 0.30), label: 'CHOPPER 1' },
    { id: 1, ...r(0, 0.30, c1, 1), label: 'LEONIDA' },
    { id: 2, ...r(c1, 0, c2, 0.56), label: 'OCEAN DR' },
    { id: 3, ...r(c1, 0.56, c2, 1), label: 'NIGHT SHIFT' },
    { id: 4, ...r(c2, 0, 1, 0.40), label: 'HEAT LEVEL' },
    { id: 5, ...r(c2, 0.40, 1, 1), label: 'VICE SQUAD' },
  ];
}

/** slanted5 — dynamic diagonal comic wedges: 5 tilted parallelogram strips with angled ink dividers. */
function slanted5(w, h) {
  const slant = w * 0.1;
  const b = [0, 0.18, 0.4, 0.62, 0.82, 1].map((f) => f * w);
  const labels = ['SUNSET', 'BOULEVARD', 'HEAT', 'NIGHT RUN', 'OCEAN DR'];
  return b.slice(0, 5).map((x0, i) => {
    const x1 = b[i + 1];
    const topL = i === 0 ? 0 : x0 + slant;
    const botR = i === 4 ? w : x1 - slant;
    return {
      id: i,
      poly: [[topL, 0], [x1 + slant, 0], [botR, h], [x0 - slant, h]],
      frame: 'ink',
      label: labels[i],
    };
  });
}

/** heroBreakout — panoramic sunset backdrop, 4 stacked side panels, a large framed hero close-up breaking out. */
function heroBreakout(w, h) {
  const r = (x0, y0, x1, y1) => rect(x0 * w, y0 * h, x1 * w, y1 * h);
  const sideRows = [0.38, 0.535, 0.69, 0.845, 1];
  const labels = ['LEONIDA SUNSET', 'STRIP LIFE', 'CHOPPER 2', 'JOYRIDE', 'MIDNIGHT'];
  const panels = [{ id: 0, ...r(0, 0, 1, 0.38), label: labels[0] }];
  for (let i = 0; i < 4; i++) {
    panels.push({ id: i + 1, ...r(0, sideRows[i], 0.3, sideRows[i + 1]), label: labels[i + 1] });
  }
  panels.push({ id: 5, ...r(0.34, 0.44, 0.98, 0.97), label: 'LEONIDA NIGHTS', frame: 'hero' });
  return panels;
}

/** wideLoading — 16:9 cinematic split-panel widescreen loading-screen composition: uneven vertical columns. */
function wideLoading(w, h) {
  const b = [0, 0.2, 0.38, 0.6, 0.8, 1].map((f) => f * w);
  const labels = ['OCEAN DR', 'STRIP', 'MIDNIGHT', 'CHOPPER 3', 'HEAT WAVE'];
  const panels = [];
  for (let i = 0; i < 5; i++) {
    panels.push({ id: i, ...rect(b[i], 0, b[i + 1], h), label: labels[i] });
  }
  return panels;
}

/** classic5 — tall hero panel left, four uneven stacked panels right. */
function classic5(w, h) {
  const split = w * 0.6;
  const rows = [0, 0.2, 0.46, 0.72, 1].map((f) => f * h);
  const labels = ['LEONIDA NIGHTS', 'OCEAN DR', 'HEAT LEVEL', 'NIGHT SHIFT', 'VICE SQUAD'];
  return [
    { id: 0, ...rect(0, 0, split, h), label: labels[0] },
    { id: 1, ...rect(split, rows[0], w, rows[1]), label: labels[1] },
    { id: 2, ...rect(split, rows[1], w, rows[2]), label: labels[2] },
    { id: 3, ...rect(split, rows[2], w, rows[3]), label: labels[3] },
    { id: 4, ...rect(split, rows[3], w, rows[4]), label: labels[4] },
  ];
}

/** polaroids5 — tilted overlapping snapshot frames (crisp white/black borders) over a vibrant sunset backdrop. */
function polaroids5(w, h) {
  const backdrop = { id: 0, ...rect(0, 0, w, h), label: '', frame: 'ink' };
  const spots = [
    { cx: 0.24, cy: 0.3, s: 0.34, a: -0.12, label: 'OCEAN DR' },
    { cx: 0.64, cy: 0.22, s: 0.3, a: 0.09, label: 'CHOPPER 4' },
    { cx: 0.78, cy: 0.62, s: 0.36, a: -0.07, label: 'NIGHT SHIFT' },
    { cx: 0.33, cy: 0.72, s: 0.32, a: 0.14, label: 'LEONIDA' },
  ];
  const panels = spots.map((s, i) => {
    const cx = s.cx * w, cy = s.cy * h;
    const hw = s.s * Math.min(w, h) * 0.5, hh = hw * 1.18;
    return { id: i + 1, poly: rotRect(cx, cy, hw, hh, s.a), frame: 'polaroid', label: s.label, angle: s.a };
  });
  return [backdrop, ...panels];
}

export const LAYOUTS = {
  vice6: { label: 'Vice 6-Panel Box Art', build: vice6 },
  slanted5: { label: 'Slanted Comic Wedges', build: slanted5 },
  heroBreakout: { label: 'Hero Breakout', build: heroBreakout },
  wideLoading: { label: 'Widescreen Loading Split', build: wideLoading },
  classic5: { label: 'Classic Vice (Hero + 4)', build: classic5 },
  polaroids5: { label: 'Sunset Polaroids', build: polaroids5 },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

/** Bounding box of a polygon (works for rotated rectangles too), for hit-testing and pan clamping. */
export function bboxOf(poly) {
  const xs = poly.map((pt) => pt[0]);
  const ys = poly.map((pt) => pt[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Even/odd point-in-polygon test, for click-to-select. */
export function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Asymmetric border weight per panel index, scaled to the canvas's shortest side. */
export function borderFor(index, shortSide) {
  const weights = [0.03, 0.018, 0.024, 0.015, 0.021, 0.017];
  return Math.max(4, shortSide * weights[index % weights.length]);
}

/** The centroid of a polygon (for callout tag / label placement). */
export function centroidOf(poly) {
  let x = 0, y = 0;
  for (const [px, py] of poly) { x += px; y += py; }
  return { x: x / poly.length, y: y / poly.length };
}
