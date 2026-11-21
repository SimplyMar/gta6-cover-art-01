// Wires up Sunset Palms Cover Studio: layout/size pickers, drag-and-drop + file-picker + sample
// thumbnails per panel, click-to-select with drag-to-pan and wheel-to-zoom, Poster Ink / grade /
// grain sliders, face-aware auto-recenter, swap/shuffle, undo/redo, one-click recipes, and PNG export
// at 4 sizes (plus a "download all" button). A `?shot=` query sets up a fixed scene for a
// deterministic screenshot instead (./shots.js).
import { drawCover } from './cover.js';
import { LAYOUTS, LAYOUT_IDS, bboxOf, pointInPoly, photoBoxFor } from './layouts.js';
import { GRADES, GRADE_IDS } from './grades.js';
import { estimateFaceAnchor, anchorToOffset } from './face-crop.js';
import { createHistory, RECIPES, RECIPE_IDS } from './history.js';
import { runShot } from './shots.js';

const SIZES = {
  square: { label: '1080 x 1080 Square', w: 1080, h: 1080 },
  portrait: { label: '1080 x 1350 Portrait', w: 1080, h: 1350 },
  widescreen: { label: '1920 x 1080 Widescreen', w: 1920, h: 1080 },
  story: { label: '1080 x 1920 Story', w: 1080, h: 1920 },
};

const SAMPLES = ['chopper-bay', 'boulevard', 'neon-street', 'coast-cruiser', 'rooftop', 'pier'];

const canvas = document.getElementById('cover');
const layoutSelect = document.getElementById('layout');
const sizeSelect = document.getElementById('size');
const gradeSelect = document.getElementById('grade');
const applyAllGradeBtn = document.getElementById('applyAllGrade');
const zoomSlider = document.getElementById('zoom');
const panXSlider = document.getElementById('panX');
const panYSlider = document.getElementById('panY');
const inkSlider = document.getElementById('ink');
const posterizeSlider = document.getElementById('posterize');
const grainSlider = document.getElementById('grain');
const heatSlider = document.getElementById('heat');
const flipBtn = document.getElementById('flip');
const recenterBtn = document.getElementById('recenter');
const swapBtn = document.getElementById('swap');
const shuffleBtn = document.getElementById('shuffle');
const autoFillBtn = document.getElementById('autoFill');
const photoInput = document.getElementById('photo');
const sampleThumbs = document.getElementById('sampleThumbs');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const sealInput = document.getElementById('seal');
const reviewInput = document.getElementById('review');
const billingInput = document.getElementById('billing');
const recipeSelect = document.getElementById('recipe');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');
const exportBtn = document.getElementById('export');
const exportAllBtn = document.getElementById('exportAll');
const status = document.getElementById('status');
const selectedLabel = document.getElementById('selectedLabel');
const toggleInputs = {
  showCallouts: document.getElementById('toggleCallouts'),
  showHeat: document.getElementById('toggleHeat'),
  showSeal: document.getElementById('toggleSeal'),
  showReview: document.getElementById('toggleReview'),
  showBilling: document.getElementById('toggleBilling'),
  inkEnabled: document.getElementById('toggleInk'),
};

const state = {
  layout: 'vice6',
  size: 'widescreen',
  title: 'SUNSET PALMS',
  subtitle: 'Leonida Nights',
  grade: 'vice-sunset',
  inkEnabled: true,
  inkStrength: 0.6,
  posterizeLevels: 6,
  grain: 0.25,
  heat: 5,
  sealText: 'SUNSET PALMS EDITION',
  reviewText: '★★★★★ "The boldest coast in Leonida" — Vice Weekly',
  billingText: 'SUNSET PALMS STUDIOS PRESENTS · A LEONIDA NIGHTS PRODUCTION · ORIGINAL KEY ART',
  showCallouts: true,
  showHeat: true,
  showSeal: true,
  showReview: true,
  showBilling: true,
  skyBloom: true,
  selectedPanel: 0,
  panels: [],
};

const history = createHistory();

function panelCount(layoutId) {
  return LAYOUTS[layoutId].build(100, 100).length;
}

function ensurePanels() {
  const count = panelCount(state.layout);
  const existing = state.panels;
  state.panels = Array.from({ length: count }, (_, i) => existing[i] ?? {
    img: null,
    grade: GRADE_IDS[i % GRADE_IDS.length],
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    flipX: false,
    label: '',
  });
  if (state.selectedPanel >= count) state.selectedPanel = 0;
}

function resizeCanvas() {
  const preset = SIZES[state.size];
  canvas.width = preset.w;
  canvas.height = preset.h;
}

function syncControlsFromState() {
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  gradeSelect.value = panel.grade;
  zoomSlider.value = panel.zoom;
  panXSlider.value = panel.offsetX;
  panYSlider.value = panel.offsetY;
  selectedLabel.textContent = `Editing panel ${state.selectedPanel + 1} of ${state.panels.length}`;
  undoBtn.disabled = !history.canUndo();
  redoBtn.disabled = !history.canRedo();
}

function redraw() {
  drawCover(canvas, state);
}

/** The current safe-draw box for panel `index`, for passing real cover-fit geometry into
 * estimateFaceAnchor/anchorToOffset so headroom math accounts for how tightly this panel actually
 * crops a photo (rather than guessing with a flat constant). */
function panelBox(index) {
  const panels = LAYOUTS[state.layout].build(canvas.width, canvas.height);
  const panel = panels[index];
  return panel ? photoBoxFor(panel) : null;
}

function snapshot() {
  history.record(state);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function populateSelect(select, entries) {
  select.innerHTML = '';
  for (const [id, meta] of entries) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = meta.label;
    select.appendChild(opt);
  }
}

populateSelect(layoutSelect, Object.entries(LAYOUTS));
populateSelect(sizeSelect, Object.entries(SIZES));
populateSelect(gradeSelect, Object.entries(GRADES));
populateSelect(recipeSelect, [['', { label: 'Style recipes…' }], ...Object.entries(RECIPES)]);

for (const name of SAMPLES) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'thumb';
  btn.dataset.sample = name;
  const img = document.createElement('img');
  img.src = `samples/${name}.jpg`;
  img.alt = name;
  btn.appendChild(img);
  sampleThumbs.appendChild(btn);
}

layoutSelect.addEventListener('change', () => {
  snapshot();
  state.layout = layoutSelect.value;
  ensurePanels();
  syncControlsFromState();
  redraw();
});

sizeSelect.addEventListener('change', () => {
  state.size = sizeSelect.value;
  resizeCanvas();
  redraw();
});

gradeSelect.addEventListener('change', () => {
  snapshot();
  state.panels[state.selectedPanel].grade = gradeSelect.value;
  redraw();
});

applyAllGradeBtn.addEventListener('click', () => {
  snapshot();
  state.grade = gradeSelect.value;
  for (const panel of state.panels) panel.grade = gradeSelect.value;
  redraw();
});

zoomSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = Number(zoomSlider.value);
  redraw();
});
zoomSlider.addEventListener('change', snapshot);
panXSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].offsetX = Number(panXSlider.value);
  redraw();
});
panXSlider.addEventListener('change', snapshot);
panYSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].offsetY = Number(panYSlider.value);
  redraw();
});
panYSlider.addEventListener('change', snapshot);

inkSlider.addEventListener('input', () => { state.inkStrength = Number(inkSlider.value); redraw(); });
posterizeSlider.addEventListener('input', () => { state.posterizeLevels = Number(posterizeSlider.value); redraw(); });
grainSlider.addEventListener('input', () => { state.grain = Number(grainSlider.value); redraw(); });
heatSlider.addEventListener('input', () => { state.heat = Number(heatSlider.value); redraw(); });

flipBtn.addEventListener('click', () => {
  snapshot();
  const panel = state.panels[state.selectedPanel];
  panel.flipX = !panel.flipX;
  redraw();
});

recenterBtn.addEventListener('click', () => {
  const panel = state.panels[state.selectedPanel];
  if (!panel.img) { status.textContent = 'Load a photo into this panel first.'; return; }
  snapshot();
  const anchor = estimateFaceAnchor(panel.img);
  const { offsetX, offsetY } = anchorToOffset(anchor, panelBox(state.selectedPanel), panel.img, { canvasH: canvas.height });
  panel.offsetX = offsetX;
  panel.offsetY = offsetY;
  panXSlider.value = offsetX;
  panYSlider.value = offsetY;
  redraw();
  status.textContent = `Face-aware recenter applied to panel ${state.selectedPanel + 1}.`;
});

swapBtn.addEventListener('click', () => {
  const n = state.panels.length;
  if (n < 2) return;
  snapshot();
  const other = (state.selectedPanel + 1) % n;
  [state.panels[state.selectedPanel], state.panels[other]] = [state.panels[other], state.panels[state.selectedPanel]];
  redraw();
  status.textContent = `Swapped panel ${state.selectedPanel + 1} with panel ${other + 1}.`;
});

shuffleBtn.addEventListener('click', () => {
  snapshot();
  for (let i = state.panels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.panels[i], state.panels[j]] = [state.panels[j], state.panels[i]];
  }
  redraw();
  status.textContent = 'Shuffled all panels.';
});

autoFillBtn.addEventListener('click', async () => {
  snapshot();
  for (let i = 0; i < state.panels.length; i++) {
    const name = SAMPLES[i % SAMPLES.length];
    const img = await loadImage(`samples/${name}.jpg`);
    state.panels[i].img = img;
    const anchor = estimateFaceAnchor(img);
    const { offsetX, offsetY } = anchorToOffset(anchor, panelBox(i), img, { canvasH: canvas.height });
    state.panels[i].offsetX = offsetX;
    state.panels[i].offsetY = offsetY;
  }
  syncControlsFromState();
  redraw();
  status.textContent = 'Auto-filled every panel with face-aware framing.';
});

photoInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files ?? []);
  if (files.length === 0) return;
  snapshot();
  await loadFilesIntoPanels(files, state.selectedPanel);
  redraw();
});

sampleThumbs.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-sample]');
  if (!btn) return;
  snapshot();
  const name = btn.dataset.sample;
  const img = await loadImage(`samples/${name}.jpg`);
  const panel = state.panels[state.selectedPanel];
  panel.img = img;
  const anchor = estimateFaceAnchor(img);
  const offs = anchorToOffset(anchor, panelBox(state.selectedPanel), img);
  panel.offsetX = offs.offsetX;
  panel.offsetY = offs.offsetY;
  panXSlider.value = panel.offsetX;
  panYSlider.value = panel.offsetY;
  redraw();
  status.textContent = `Loaded sample "${name}" into panel ${state.selectedPanel + 1}`;
});

async function loadFilesIntoPanels(files, startIndex) {
  const n = state.panels.length;
  for (let i = 0; i < files.length && i < n; i++) {
    const index = (startIndex + i) % n;
    const img = await loadImage(URL.createObjectURL(files[i]));
    const anchor = estimateFaceAnchor(img);
    const offs = anchorToOffset(anchor, panelBox(index), img);
    state.panels[index].img = img;
    state.panels[index].offsetX = offs.offsetX;
    state.panels[index].offsetY = offs.offsetY;
    state.panels[index].zoom = 1;
  }
  syncControlsFromState();
  status.textContent = `Loaded ${Math.min(files.length, n)} photo(s) starting at panel ${startIndex + 1}.`;
}

canvas.addEventListener('dragover', (e) => { e.preventDefault(); canvas.classList.add('drag-over'); });
canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  canvas.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) return;
  snapshot();
  const { x, y } = canvasPoint(e);
  const panels = LAYOUTS[state.layout].build(canvas.width, canvas.height);
  const hit = panels.find((p) => pointInPoly(p.poly, x, y));
  await loadFilesIntoPanels(files, hit ? hit.id : 0);
  redraw();
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
sealInput.addEventListener('input', () => { state.sealText = sealInput.value; redraw(); });
reviewInput.addEventListener('input', () => { state.reviewText = reviewInput.value; redraw(); });
billingInput.addEventListener('input', () => { state.billingText = billingInput.value; redraw(); });

for (const [key, input] of Object.entries(toggleInputs)) {
  if (!input) continue;
  input.addEventListener('change', () => { state[key] = input.checked; redraw(); });
}

recipeSelect.addEventListener('change', () => {
  const recipe = RECIPES[recipeSelect.value];
  if (!recipe) return;
  snapshot();
  Object.assign(state, recipe);
  ensurePanels();
  resizeCanvas();
  layoutSelect.value = state.layout;
  gradeSelect.value = state.grade;
  for (const panel of state.panels) panel.grade = state.grade;
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  inkSlider.value = state.inkStrength;
  posterizeSlider.value = state.posterizeLevels;
  grainSlider.value = state.grain;
  heatSlider.value = state.heat;
  syncControlsFromState();
  redraw();
  status.textContent = `Applied the "${recipe.label}" recipe.`;
  recipeSelect.value = '';
});

function restoreSnapshot(snap) {
  if (!snap) return;
  Object.assign(state, snap);
  resizeCanvas();
  layoutSelect.value = state.layout;
  sizeSelect.value = state.size;
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  inkSlider.value = state.inkStrength;
  posterizeSlider.value = state.posterizeLevels;
  grainSlider.value = state.grain;
  heatSlider.value = state.heat;
  syncControlsFromState();
  redraw();
}

undoBtn.addEventListener('click', () => restoreSnapshot(history.undo(state)));
redoBtn.addEventListener('click', () => restoreSnapshot(history.redo(state)));
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); restoreSnapshot(history.undo(state)); }
  else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); restoreSnapshot(history.redo(state)); }
});

function exportPng(sizeId) {
  return new Promise((resolve) => {
    const preset = SIZES[sizeId];
    const off = document.createElement('canvas');
    off.width = preset.w;
    off.height = preset.h;
    drawCover(off, state, { exportMode: true });
    off.toBlob((blob) => resolve({ blob, preset }), 'image/png');
  });
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

exportBtn.addEventListener('click', async () => {
  const { blob, preset } = await exportPng(state.size);
  downloadBlob(blob, `sunset-palms-${preset.w}x${preset.h}.png`);
  status.textContent = `Saved sunset-palms-${preset.w}x${preset.h}.png`;
});

exportAllBtn.addEventListener('click', async () => {
  for (const sizeId of ['square', 'portrait', 'widescreen', 'story']) {
    const { blob, preset } = await exportPng(sizeId);
    downloadBlob(blob, `sunset-palms-${preset.w}x${preset.h}.png`);
  }
  status.textContent = 'Saved all 4 export sizes.';
});

function canvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (evt.clientX - rect.left) * scaleX, y: (evt.clientY - rect.top) * scaleY };
}

let dragging = false;
let dragStart = null;
let dragOrigin = null;

canvas.addEventListener('mousedown', (evt) => {
  const { x, y } = canvasPoint(evt);
  const panels = LAYOUTS[state.layout].build(canvas.width, canvas.height);
  const hit = panels.find((p) => pointInPoly(p.poly, x, y));
  if (!hit) return;
  state.selectedPanel = hit.id;
  syncControlsFromState();
  dragging = true;
  dragStart = { x, y };
  dragOrigin = {
    offsetX: state.panels[hit.id].offsetX,
    offsetY: state.panels[hit.id].offsetY,
    box: bboxOf(hit.poly),
  };
  redraw();
});

window.addEventListener('mousemove', (evt) => {
  if (!dragging) return;
  const { x, y } = canvasPoint(evt);
  const dx = x - dragStart.x;
  const dy = y - dragStart.y;
  const panel = state.panels[state.selectedPanel];
  const box = dragOrigin.box;
  panel.offsetX = Math.min(1, Math.max(-1, dragOrigin.offsetX - dx / (box.w * 0.6)));
  panel.offsetY = Math.min(1, Math.max(-1, dragOrigin.offsetY - dy / (box.h * 0.6)));
  panXSlider.value = panel.offsetX;
  panYSlider.value = panel.offsetY;
  redraw();
});

window.addEventListener('mouseup', () => {
  if (dragging) snapshot();
  dragging = false;
});

canvas.addEventListener('wheel', (evt) => {
  const { x, y } = canvasPoint(evt);
  const panels = LAYOUTS[state.layout].build(canvas.width, canvas.height);
  const hit = panels.find((p) => pointInPoly(p.poly, x, y));
  if (!hit) return;
  evt.preventDefault();
  const panel = state.panels[hit.id];
  panel.zoom = Math.min(3, Math.max(1, (panel.zoom ?? 1) + (evt.deltaY < 0 ? 0.06 : -0.06)));
  if (state.selectedPanel === hit.id) zoomSlider.value = panel.zoom;
  redraw();
}, { passive: false });

async function applyShotConfig(cfg) {
  state.layout = cfg.layout;
  state.size = cfg.size;
  state.title = cfg.title;
  state.subtitle = cfg.subtitle;
  state.grade = cfg.grade;
  state.inkStrength = cfg.inkStrength;
  state.posterizeLevels = cfg.posterizeLevels;
  state.grain = cfg.grain;
  if (cfg.recipe && RECIPES[cfg.recipe]) Object.assign(state, RECIPES[cfg.recipe]);
  ensurePanels();
  resizeCanvas();
  layoutSelect.value = state.layout;
  sizeSelect.value = state.size;
  gradeSelect.value = state.grade;
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  for (let i = 0; i < state.panels.length; i++) {
    const panel = state.panels[i];
    panel.grade = state.grade;
    const img = await loadImage(`samples/${cfg.sampleNames[i % cfg.sampleNames.length]}.jpg`);
    panel.img = img;
    const anchor = estimateFaceAnchor(img);
    const offs = anchorToOffset(anchor, panelBox(i), img, { canvasH: canvas.height });
    panel.offsetX = offs.offsetX;
    panel.offsetY = offs.offsetY;
  }
  syncControlsFromState();
  redraw();
  return cfg.exportMode;
}

ensurePanels();
resizeCanvas();
layoutSelect.value = state.layout;
sizeSelect.value = state.size;
gradeSelect.value = state.grade;
titleInput.value = state.title;
subtitleInput.value = state.subtitle;
sealInput.value = state.sealText;
reviewInput.value = state.reviewText;
billingInput.value = state.billingText;
syncControlsFromState();

const shotParam = new URLSearchParams(location.search).get('shot');
if (shotParam) {
  // `finalize` runs only after shots.js has confirmed every vendored font face (Anton, Bebas Neue,
  // Pacifico) is actually decoded and ready — not just after the initial applyShotConfig() draw, which
  // can land before font load finishes and silently fall back to a system font in the captured frame.
  runShot(
    shotParam,
    new URLSearchParams(location.search),
    (cfg) => applyShotConfig(cfg),
    (exportMode) => drawCover(canvas, state, { exportMode }),
  );
} else {
  redraw();
  // Safety net for the interactive editor too: the very first redraw() above can land before the
  // vendored @font-face files finish decoding, which would silently bake in a system-font fallback
  // until something else triggers a repaint. Re-draw once fonts are confirmed ready.
  document.fonts.ready.then(() => redraw());
}
