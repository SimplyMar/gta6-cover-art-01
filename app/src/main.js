// Wires up Vice Panels: layout/size/grade pickers, per-panel photo upload + sample art, click-to-select
// with pan/zoom, title/subtitle/emblem text, and a real PNG export at the chosen pixel size. A `?shot=`
// query sets up a fixed scene for a screenshot instead (./shots.js).
import { drawCover } from './cover.js';
import { LAYOUTS, bboxOf, pointInPoly } from './layouts.js';
import { GRADE_IDS, GRADES } from './filters.js';
import { runShot } from './shots.js';

const SIZES = {
  square: { label: '1080 x 1080 Square', w: 1080, h: 1080 },
  portrait: { label: '1080 x 1350 Portrait', w: 1080, h: 1350 },
  widescreen: { label: '1920 x 1080 Widescreen', w: 1920, h: 1080 },
};

const canvas = document.getElementById('cover');
const layoutSelect = document.getElementById('layout');
const sizeSelect = document.getElementById('size');
const gradeSelect = document.getElementById('grade');
const applyAllGradeBtn = document.getElementById('applyAllGrade');
const zoomSlider = document.getElementById('zoom');
const panXSlider = document.getElementById('panX');
const panYSlider = document.getElementById('panY');
const photoInput = document.getElementById('photo');
const sampleButtons = document.querySelectorAll('[data-sample]');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const emblemInput = document.getElementById('emblem');
const exportBtn = document.getElementById('export');
const status = document.getElementById('status');
const selectedLabel = document.getElementById('selectedLabel');

const state = {
  layout: 'classic5',
  size: 'square',
  title: 'VICE PANELS',
  subtitle: 'Coastal Noir Edition',
  emblem: 'VP',
  selectedPanel: 0,
  panels: [],
};

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
}

function redraw() {
  drawCover(canvas, state);
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

layoutSelect.addEventListener('change', () => {
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
  state.panels[state.selectedPanel].grade = gradeSelect.value;
  redraw();
});

applyAllGradeBtn.addEventListener('click', () => {
  for (const panel of state.panels) panel.grade = gradeSelect.value;
  redraw();
});

zoomSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = Number(zoomSlider.value);
  redraw();
});
panXSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].offsetX = Number(panXSlider.value);
  redraw();
});
panYSlider.addEventListener('input', () => {
  state.panels[state.selectedPanel].offsetY = Number(panYSlider.value);
  redraw();
});

photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = await loadImage(URL.createObjectURL(file));
  state.panels[state.selectedPanel].img = img;
  state.panels[state.selectedPanel].offsetX = 0;
  state.panels[state.selectedPanel].offsetY = 0;
  state.panels[state.selectedPanel].zoom = 1;
  syncControlsFromState();
  redraw();
  status.textContent = `Loaded photo into panel ${state.selectedPanel + 1}`;
});

sampleButtons.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const name = btn.dataset.sample;
    const img = await loadImage(`samples/${name}.jpg`);
    state.panels[state.selectedPanel].img = img;
    redraw();
    status.textContent = `Loaded sample "${name}" into panel ${state.selectedPanel + 1}`;
  });
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
emblemInput.addEventListener('input', () => { state.emblem = emblemInput.value; redraw(); });

exportBtn.addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    const preset = SIZES[state.size];
    a.href = URL.createObjectURL(blob);
    a.download = `vice-panels-${preset.w}x${preset.h}.png`;
    a.click();
    status.textContent = `Saved vice-panels-${preset.w}x${preset.h}.png`;
  }, 'image/png');
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

window.addEventListener('mouseup', () => { dragging = false; });

async function applyShotConfig({ layout, size, grade, title }) {
  state.layout = layout;
  state.size = size;
  state.title = title;
  ensurePanels();
  resizeCanvas();
  layoutSelect.value = layout;
  sizeSelect.value = size;
  titleInput.value = title;
  for (const panel of state.panels) panel.grade = grade;
  const samples = ['pier', 'boulevard'];
  for (let i = 0; i < state.panels.length; i++) {
    state.panels[i].img = await loadImage(`samples/${samples[i % samples.length]}.jpg`);
  }
  syncControlsFromState();
  redraw();
}

ensurePanels();
resizeCanvas();
layoutSelect.value = state.layout;
sizeSelect.value = state.size;
titleInput.value = state.title;
subtitleInput.value = state.subtitle;
emblemInput.value = state.emblem;
syncControlsFromState();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), applyShotConfig);
} else {
  redraw();
}
