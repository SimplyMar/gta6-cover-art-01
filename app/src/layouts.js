// Panel geometry for Vice Panels. Each layout is a function(w, h) -> Panel[], where a Panel is
// { id, poly: [[x,y], ...] } in pixel space (y-down), with deliberately asymmetric panel sizes so
// the grid reads as a hand-built comic page rather than a mechanical grid. Border thickness per
// panel also varies (see `borderFor`) to keep the bold-ink, GTA-box-art feel.

function rect(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

/** 5-Panel Classic Vice: one tall hero panel on the left, four uneven stacked panels on the right. */
function classic5(w, h) {
  const split = w * 0.6;
  const rows = [0, 0.2, 0.46, 0.72, 1].map((f) => f * h);
  return [
    { id: 0, poly: rect(0, 0, split, h) },
    { id: 1, poly: rect(split, rows[0], w, rows[1]) },
    { id: 2, poly: rect(split, rows[1], w, rows[2]) },
    { id: 3, poly: rect(split, rows[2], w, rows[3]) },
    { id: 4, poly: rect(split, rows[3], w, rows[4]) },
  ];
}

/** 4-Panel Diagonal Split: two Z-diagonals carve the frame into four racing wedges. */
function diagonal4(w, h) {
  const p = (fx, fy) => [fx * w, fy * h];
  return [
    { id: 0, poly: [p(0, 0), p(0.6, 0), p(0.4, 0.5), p(0, 0.5)] },
    { id: 1, poly: [p(0.6, 0), p(1, 0), p(1, 0.5), p(0.4, 0.5)] },
    { id: 2, poly: [p(0, 0.5), p(0.4, 0.5), p(0.6, 1), p(0, 1)] },
    { id: 3, poly: [p(0.4, 0.5), p(1, 0.5), p(1, 1), p(0.6, 1)] },
  ];
}

/** 6-Panel Grid: 2 rows x 3 columns, uneven column widths and row heights for GTA asymmetry. */
function grid6(w, h) {
  const cols = [0, 0.38, 0.68, 1].map((f) => f * w);
  const rowsY = [0, 0.52, 1].map((f) => f * h);
  const panels = [];
  let id = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      panels.push({ id: id++, poly: rect(cols[c], rowsY[r], cols[c + 1], rowsY[r + 1]) });
    }
  }
  return panels;
}

export const LAYOUTS = {
  classic5: { label: '5-Panel Classic Vice', build: classic5 },
  diagonal4: { label: '4-Panel Diagonal Split', build: diagonal4 },
  grid6: { label: '6-Panel Grid', build: grid6 },
};

/** Bounding box of a polygon, for hit-testing text placement and pan clamping. */
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
  const weights = [0.026, 0.016, 0.022, 0.013, 0.019, 0.015];
  return Math.max(4, shortSide * weights[index % weights.length]);
}
