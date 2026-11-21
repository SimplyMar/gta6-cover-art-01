// Fixed, deterministic screenshot scenes. `?shot=cover` shows only the canvas, full-bleed, in
// export mode (no selection outline); `?shot=editor` shows the full studio UI. Shared query params:
// `layout`, `size`, `grade`, `recipe`, `title`, `subtitle`, `ink`, `posterize`, `grain`. Waits for all
// 6 sample photos to decode AND document.fonts.ready before setting window.__shotReady = true, so a
// capture tool can safely wait on that flag.
const SAMPLE_NAMES = ['chopper-bay', 'coast-cruiser', 'neon-street', 'rooftop', 'boulevard', 'pier'];

export async function runShot(shot, query, applyShot) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const num = (key, fallback) => {
    const v = query.get(key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  await applyShot({
    layout: query.get('layout') ?? 'vice6',
    size: query.get('size') ?? 'widescreen',
    grade: query.get('grade') ?? 'vice-sunset',
    recipe: query.get('recipe') ?? null,
    title: query.get('title') ?? 'SUNSET PALMS',
    subtitle: query.get('subtitle') ?? 'Leonida Nights',
    inkStrength: num('ink', 0.6),
    posterizeLevels: num('posterize', 5),
    grain: num('grain', 0.25),
    exportMode: shot === 'cover',
    sampleNames: SAMPLE_NAMES,
  });

  await document.fonts.ready;
  await Promise.all(
    SAMPLE_NAMES.map(
      (name) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = `samples/${name}.jpg`;
        }),
    ),
  );
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
