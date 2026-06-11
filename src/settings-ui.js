// settings-ui.js — builds the settings panel from a declarative schema.
// Every control reads/writes the store; changes apply live.

import { get, set, getSettings } from './store.js';
import { clearBars } from './bar.js';

const SCHEMA = [
  { section: 'Display' },
  { key: 'displayTime', type: 'range', label: 'Display time (seconds)', min: 5, max: 20, step: 1 },
  { key: 'scale', type: 'range', label: 'Icon scale', min: 0.5, max: 2, step: 0.1 },
  { key: 'barDirection', type: 'select', label: 'Scroll direction', options: [['rtl', 'Right → Left'], ['ltr', 'Left → Right']] },
  { key: 'iconShape', type: 'select', label: 'Icon shape', options: [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']] },

  { section: 'Bar visuals' },
  { key: 'theme', type: 'select', label: 'Theme', options: [['dark', 'Dark'], ['light', 'Light'], ['jobcolor', 'Job color']] },
  { key: 'accentColor', type: 'color', label: 'Accent color' },
  { key: 'bgColor', type: 'text', label: 'Background (hex w/ alpha)', placeholder: '#1a1a1add' },
  { key: 'showGrid', type: 'toggle', label: 'Show scrolling grid' },
  { key: 'showBeatGrid', type: 'toggle', label: 'Show GCD beat ticks' },
  { key: 'distinguishGcd', type: 'toggle', label: 'Distinguish GCD vs oGCD (size/border)' },
  { key: 'showLabels', type: 'toggle', label: 'Show skill name labels' },
  { key: 'showTooltips', type: 'toggle', label: 'Hover tooltips' },

  { section: 'Tracking' },
  { key: 'showAutoAttacks', type: 'toggle', label: 'Show auto-attacks' },
  { key: 'showPetActions', type: 'toggle', label: 'Show pet actions' },
  { key: 'checkPositionals', type: 'toggle', label: 'Check positional misses' },
  { key: 'validatePetActions', type: 'toggle', label: 'Validate pet actions (ghosts)' },
  { key: 'trackClipping', type: 'toggle', label: 'Track GCD clipping / drift' },
  { key: 'showDots', type: 'toggle', label: 'Show DoT / debuff timers' },
  { key: 'dotWarnThreshold', type: 'range', label: 'DoT refresh warning (sec left)', min: 1, max: 10, step: 1 },

  { section: 'Meter' },
  { key: 'meterMetric', type: 'select', label: 'Top-right metric', options: [['dps', 'Personal DPS'], ['hps', 'Healing /s'], ['dtps', 'Damage taken /s'], ['rdps', 'Raid DPS'], ['off', 'Off']] },

  { section: 'Language' },
  { key: 'lang', type: 'select', label: 'Language', options: [['JP', '日本語'], ['EN', 'English'], ['FR', 'Français'], ['CN', '中文']] },
];

export function buildSettings(onChange) {
  const root = document.getElementById('settings');
  root.innerHTML = '';

  const head = el('div', 'settings-head');
  head.innerHTML = `<span>Grim Skill Display — settings</span>`;
  const close = el('i', 'material-icons iconbutton'); close.textContent = 'close';
  close.onclick = () => toggleSettings(false);
  head.appendChild(close);
  root.appendChild(head);

  for (const row of SCHEMA) {
    if (row.section) { const s = el('div', 'settings-section'); s.textContent = row.section; root.appendChild(s); continue; }
    root.appendChild(control(row, onChange));
  }

  const footer = el('div', 'settings-footer');
  const reset = el('button', 'reset-btn'); reset.textContent = 'Reset all settings';
  reset.onclick = () => { localStorage.removeItem('grim-skill-display'); location.reload(); };
  footer.appendChild(reset);
  const ver = el('div', 'version'); ver.textContent = 'Grim v1.0 · data current to live patch';
  footer.appendChild(ver);
  root.appendChild(footer);
}

function control(row, onChange) {
  const wrap = el('label', 'control');
  const name = el('span', 'control-label'); name.textContent = row.label;
  wrap.appendChild(name);
  const apply = (v) => { set(row.key, v); clearBars(); onChange?.(row.key, v); };

  if (row.type === 'toggle') {
    const inp = el('input'); inp.type = 'checkbox'; inp.className = 'toggle';
    inp.checked = !!get(row.key);
    inp.onchange = () => apply(inp.checked);
    wrap.appendChild(inp);
  } else if (row.type === 'range') {
    const val = el('span', 'range-val'); val.textContent = get(row.key);
    const inp = el('input'); inp.type = 'range'; inp.min = row.min; inp.max = row.max; inp.step = row.step;
    inp.value = get(row.key);
    inp.oninput = () => { val.textContent = inp.value; apply(parseFloat(inp.value)); };
    wrap.appendChild(val); wrap.appendChild(inp);
  } else if (row.type === 'select') {
    const sel = el('select');
    for (const [v, t] of row.options) { const o = el('option'); o.value = v; o.textContent = t; if (get(row.key) === v) o.selected = true; sel.appendChild(o); }
    sel.onchange = () => apply(sel.value);
    wrap.appendChild(sel);
  } else if (row.type === 'color') {
    const inp = el('input'); inp.type = 'color'; inp.value = (get(row.key) || '#ff7b00').slice(0, 7);
    inp.oninput = () => apply(inp.value);
    wrap.appendChild(inp);
  } else if (row.type === 'text') {
    const inp = el('input'); inp.type = 'text'; inp.value = get(row.key) || ''; inp.placeholder = row.placeholder || '';
    inp.onchange = () => apply(inp.value.trim());
    wrap.appendChild(inp);
  }
  return wrap;
}

export function toggleSettings(force) {
  const panel = document.getElementById('settings');
  const main = document.getElementById('main');
  const show = force ?? panel.classList.contains('hide');
  panel.classList.toggle('hide', !show);
  main.classList.toggle('dimmed', show);
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
