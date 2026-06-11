// store.js — settings state, persistence, theming. Single source of truth.

import { Data } from './data.js';

const KEY = 'grim-skill-display';
let settings = {};
const listeners = new Set();

export const getSettings = () => settings;
export const get = (k) => settings[k];

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function notify(changedKey) { listeners.forEach((fn) => fn(settings, changedKey)); }

export function loadSettings() {
  const defaults = Data.settings;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    // merge so new fields added in updates get their defaults
    settings = { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    settings = { ...defaults };
  }
  save();
  applyTheme();
  return settings;
}

export function set(key, value) {
  settings[key] = value;
  save();
  if (['theme', 'bgColor', 'accentColor', 'scale', 'iconShape'].includes(key)) applyTheme();
  notify(key);
}

function save() { localStorage.setItem(KEY, JSON.stringify(settings)); }

// Theme = CSS custom properties on :root, so all styling reacts instantly.
export function applyTheme() {
  const r = document.documentElement.style;
  const themes = {
    dark: { fg: '#f2f2f2', grid: 'rgba(255,255,255,0.18)', panel: '#202024' },
    light: { fg: '#1b1b1b', grid: 'rgba(0,0,0,0.18)', panel: '#f3f3f3' },
    jobcolor: { fg: '#ffffff', grid: 'rgba(255,255,255,0.18)', panel: '#1c1c20' },
  };
  const t = themes[settings.theme] || themes.dark;
  r.setProperty('--grim-bg', settings.bgColor || '#1a1a1add');
  r.setProperty('--grim-accent', settings.accentColor || '#ff7b00');
  r.setProperty('--grim-fg', t.fg);
  r.setProperty('--grim-grid', t.grid);
  r.setProperty('--grim-panel', t.panel);
  r.setProperty('--grim-scale', settings.scale || 1);
  const radius = { square: '0px', rounded: '6px', circle: '50%' }[settings.iconShape] || '6px';
  r.setProperty('--grim-icon-radius', radius);
}

// Per-job accent (used when theme = jobcolor). Rough role-based palette.
const JOB_COLORS = {
  PLD: '#a8d2e6', WAR: '#cf2621', DRK: '#d126cc', GNB: '#796d30',
  WHM: '#fff0dc', SCH: '#8657ff', AST: '#ffe74a', SGE: '#80a0f0',
  MNK: '#d5a823', DRG: '#4164cd', NIN: '#af1964', SAM: '#e46d04', RPR: '#965a90', VPR: '#108210',
  BRD: '#91ba5e', MCH: '#6ee1d6', DNC: '#e2b0af',
  BLM: '#a579d6', SMN: '#2d9b78', RDM: '#e87b7b', PCT: '#fc92e1', BLU: '#2459ff',
};
export function jobAccent(job) { return JOB_COLORS[job] || (settings.accentColor || '#ff7b00'); }
