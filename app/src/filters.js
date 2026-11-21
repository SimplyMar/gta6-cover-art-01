// Color grade presets for Vice Panels. Each grade is a CSS canvas `filter` string (applied while the
// panel's content is drawn) plus a tint overlay drawn afterwards with a blend mode, so photos and
// procedural fills alike pick up a consistent coastal-noir color story.

export const GRADES = {
  'vice-sunset': {
    label: 'Vice Sunset',
    filter: 'saturate(1.35) contrast(1.08) brightness(1.03) sepia(0.12)',
    overlay: ['rgba(255,94,98,0.28)', 'rgba(255,170,60,0.05)', 'rgba(60,20,90,0.35)'],
    blend: 'overlay',
  },
  'neon-noir': {
    label: 'Neon Noir',
    filter: 'contrast(1.3) saturate(1.5) brightness(0.82) hue-rotate(260deg)',
    overlay: ['rgba(20,10,60,0.55)', 'rgba(0,255,210,0.08)', 'rgba(255,0,180,0.18)'],
    blend: 'hard-light',
  },
  'chrome-heat': {
    label: 'Chrome Heat',
    filter: 'contrast(1.25) saturate(1.6) brightness(1.02)',
    overlay: ['rgba(255,60,20,0.3)', 'rgba(255,200,0,0.1)', 'rgba(140,0,40,0.3)'],
    blend: 'overlay',
  },
  'palm-pastel': {
    label: 'Palm Pastel',
    filter: 'saturate(0.85) brightness(1.12) contrast(0.95)',
    overlay: ['rgba(120,220,200,0.25)', 'rgba(255,210,230,0.2)', 'rgba(255,255,255,0.05)'],
    blend: 'soft-light',
  },
};

export const GRADE_IDS = Object.keys(GRADES);

/** Paints a grade's tint gradient over the rect (x, y, w, h) already clipped to the active panel. */
export function paintGradeOverlay(ctx, gradeId, x, y, w, h) {
  const grade = GRADES[gradeId] ?? GRADES['vice-sunset'];
  const grad = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  grad.addColorStop(0, grade.overlay[0]);
  grad.addColorStop(0.55, grade.overlay[1]);
  grad.addColorStop(1, grade.overlay[2]);
  ctx.save();
  ctx.globalCompositeOperation = grade.blend;
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
