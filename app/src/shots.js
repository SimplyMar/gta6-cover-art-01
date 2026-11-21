// Fixed, deterministic screenshot scenes. `?shot=cover` shows only the canvas, full-bleed, in
// export mode (no selection outline); `?shot=editor` shows the full studio UI. Shared query params:
// `layout`, `size`, `grade`, `recipe`, `title`, `subtitle`, `ink`, `posterize`, `grain`. Waits for all
// 6 sample photos to decode, for document.fonts.ready, AND for the three vendored font faces
// (Anton, Bebas Neue, Pacifico) to each report as actually loaded via document.fonts.load() before
// calling `finalize` — so the frame a capture tool screenshots never silently falls back to a system
// font while the real @font-face files are still decoding. Only then sets window.__shotReady = true.
const SAMPLE_NAMES = ['chopper-bay', 'boulevard', 'neon-street', 'coast-cruiser', 'rooftop', 'pier'];

export async function runShot(shot, query, applyShot, finalize) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const num = (key, fallback) => {
    const v = query.get(key);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  const exportMode = await applyShot({
    layout: query.get('layout') ?? 'vice6',
    size: query.get('size') ?? 'widescreen',
    grade: query.get('grade') ?? 'vice-sunset',
    recipe: query.get('recipe') ?? null,
    title: query.get('title') ?? 'SUNSET PALMS',
    subtitle: query.get('subtitle') ?? 'Leonida Nights',
    inkStrength: num('ink', 0.3),
    posterizeLevels: num('posterize', 10),
    grain: num('grain', 0.25),
    exportMode: shot === 'cover',
    sampleNames: SAMPLE_NAMES,
  });

  await document.fonts.ready;
  // Explicitly force each vendored font face the title/subtitle/callout layers actually use to load —
  // document.fonts.ready alone only waits on faces some earlier paint already requested, which isn't
  // guaranteed if the very first draw raced ahead of font decoding.
  await Promise.all([
    document.fonts.load("400 72px 'Anton'"),
    document.fonts.load("400 48px 'Pacifico'"),
    document.fonts.load("400 36px 'Bebas Neue'"),
  ]);
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

  finalize?.(exportMode);
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
