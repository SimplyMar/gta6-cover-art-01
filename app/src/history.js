// Undo/redo history stack (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z) plus 4 one-click style recipes that set
// layout, grade and ink/title parameters together in a single click.

/** Shallow-clones state for the history stack: panel objects are copied, but each panel's `img`
 * (an HTMLImageElement) is kept by reference — it never changes in place, so sharing it across
 * history entries is safe and avoids re-decoding or cloning image data. */
function cloneState(state) {
  return {
    ...state,
    panels: state.panels.map((p) => ({ ...p })),
  };
}

export function createHistory(limit = 60) {
  let undoStack = [];
  let redoStack = [];
  return {
    /** Records `state` as the point to return to on the next undo. Call after a committed change
     * (slider release, text commit, panel load) — not on every keystroke/drag tick. */
    record(state) {
      undoStack.push(cloneState(state));
      if (undoStack.length > limit) undoStack.shift();
      redoStack = [];
    },
    undo(current) {
      if (undoStack.length === 0) return null;
      redoStack.push(cloneState(current));
      return undoStack.pop();
    },
    redo(current) {
      if (redoStack.length === 0) return null;
      undoStack.push(cloneState(current));
      return redoStack.pop();
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}

/** 4 one-click style recipes: layout + grade + ink/title parameters, applied together. */
export const RECIPES = {
  'vice-box': {
    label: 'Vice Box',
    layout: 'vice6', grade: 'vice-sunset',
    inkStrength: 0.62, posterizeLevels: 5, grain: 0.22,
    title: 'SUNSET PALMS', subtitle: 'Leonida Nights', heat: 5,
  },
  'neon-heist': {
    label: 'Neon Heist',
    layout: 'slanted5', grade: 'neon-coast',
    inkStrength: 0.72, posterizeLevels: 4, grain: 0.3,
    title: 'SUNSET PALMS', subtitle: 'Midnight Score', heat: 4,
  },
  'golden-hour': {
    label: 'Golden Hour',
    layout: 'heroBreakout', grade: 'golden-heat',
    inkStrength: 0.5, posterizeLevels: 6, grain: 0.18,
    title: 'SUNSET PALMS', subtitle: 'Golden Hour', heat: 3,
  },
  'retro-loading': {
    label: 'Retro Loading',
    layout: 'wideLoading', grade: 'chrome-noir',
    inkStrength: 0.45, posterizeLevels: 4, grain: 0.35,
    title: 'SUNSET PALMS', subtitle: 'Now Loading', heat: 2,
  },
};

export const RECIPE_IDS = Object.keys(RECIPES);
