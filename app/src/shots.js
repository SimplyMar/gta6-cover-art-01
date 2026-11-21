// Fixed scenes for screenshots. `?shot=cover` shows only the canvas, full-bleed; `?shot=editor` shows
// the full studio UI. Shared query params: `layout` (classic5|diagonal4|grid6), `size` (square|portrait
// |widescreen), `grade` (vice-sunset|neon-noir|chrome-heat|palm-pastel), `title`. window.__shotReady is
// set true once the scene has painted and settled, so a capture tool can wait on it.
export async function runShot(shot, query, applyShot) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await applyShot({
    layout: query.get('layout') ?? 'classic5',
    size: query.get('size') ?? 'square',
    grade: query.get('grade') ?? 'vice-sunset',
    title: query.get('title') ?? 'VICE PANELS',
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
