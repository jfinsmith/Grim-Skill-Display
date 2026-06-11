// settings-ui.js — settings panel built from a declarative schema.
// All controls are CLICK-based (custom dropdowns, +/- steppers, colour swatches) because
// OverlayPlugin's embedded browser doesn't render native <select>/<input type=color>
// popups and hijacks drag gestures (sliders/scrollbars) to move the overlay window.

import { get, set } from './store.js';
import { clearBars } from './bar.js';

// help text shown as a tooltip on each control (the ? and the label)
const HELP = {
  displayTime: 'How many seconds of history the bar shows. Lower = faster scroll.',
  scale: 'Master size multiplier for all skill icons.',
  barDirection: 'Which way skills travel across the bar.',
  iconShape: 'Corner style of the skill icons.',
  theme: 'Overall colour scheme. "Job color" tints the accent to your current job.',
  accentColor: 'Highlight colour: GCD borders, meter, DoT bars, beat ticks.',
  bgColor: 'Bar background. Use an 8-digit hex (#RRGGBBAA) for transparency. Lock the overlay first to type.',
  showGrid: 'The scrolling music-staff grid behind the icons.',
  showBeatGrid: 'Faint vertical ticks marking a rough GCD rhythm.',
  distinguishGcd: 'Draw GCDs larger with an accent border and oGCDs smaller, so weaves are obvious.',
  showLabels: 'Print each skill\'s name under its icon (black background, bold white text).',
  labelScale: 'Size of the skill-name labels.',
  showTooltips: 'Hover an icon to see its name (and these help tips). Tips appear pinned in the top-left.',
  castMode: 'Button hit = one icon when you press a skill (hard casts show a cast bar). Cast + complete = show the cast AND the moment it lands (two icons).',
  aaIntervalScale: 'Size of the seconds-between-auto-attacks number (your effective attack speed).',
  showAutoAttacks: 'Show auto-attacks in their own small top lane. Each shows the seconds since the last one (your effective attack speed).',
  showPetActions: 'Show your pet/summon actions in the bottom lane.',
  checkPositionals: 'For melee with rear/flank skills (MNK/DRG/NIN/SAM/RPR): marks a skill with a red ✖ when you hit it from the wrong side, and tracks a miss % in the header.',
  validatePetActions: 'For pet jobs (SMN/SCH): flags a pet action that got "ghosted" (cancelled because the pet de-summoned or the target died before it landed), and tracks a ghost %.',
  trackClipping: 'Watches the gap between your GCDs. It learns your fastest clean GCD, then counts any GCD that came late (you clipped/drifted) — shown as "clips: x/y" in the header. Lower is better.',
  showDots: 'Live countdown pips (top-left) for every DoT / damage-debuff you apply. They turn red and flash when about to expire.',
  dotWarnThreshold: 'How many seconds of remaining time triggers the red refresh flash.',
  dotAlert: 'Extra alert when a DoT is about to expire: a screen-edge flash, a beep, or nothing (the pip always flashes regardless).',
  highlightBuffs: 'Tint the bar gold while a party damage-up buff is on you (Divination, Brotherhood, Embolden, etc.) so you can see your burst window.',
  showDeathMarkers: 'Drop a marker on the timeline when you die.',
  showGcdUptime: 'Show your estimated GCD uptime % in the header (how much of the fight your GCD was rolling). The single best optimization metric.',
  showSummary: 'When combat ends, show a card summarizing GCDs, uptime, clips, positionals, deaths, and DoT uptime.',
  openerCountdown: 'Show a big 5→1 countdown synced to the in-game pull countdown (/countdown).',
  meterMetric: 'What the top-right number shows. Also click the meter itself to cycle.',
  lang: 'Interface language.',
};

const SCHEMA = [
  { section: 'Display' },
  { key: 'displayTime', type: 'stepper', label: 'Display time (sec)', min: 4, max: 20, step: 1 },
  { key: 'scale', type: 'stepper', label: 'Icon scale', min: 0.5, max: 2.5, step: 0.1, dp: 1 },
  { key: 'barDirection', type: 'dropdown', label: 'Scroll direction', options: [['rtl', 'Right → Left'], ['ltr', 'Left → Right']] },
  { key: 'iconShape', type: 'dropdown', label: 'Icon shape', options: [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']] },

  { section: 'Bar visuals' },
  { key: 'theme', type: 'dropdown', label: 'Theme', options: [['dark', 'Dark'], ['light', 'Light'], ['jobcolor', 'Job color']] },
  { key: 'accentColor', type: 'swatches', label: 'Accent color', colors: ['#ff7b00', '#ffd500', '#4fc3f7', '#7c4dff', '#26c281', '#ff4d6d', '#ffffff'] },
  { key: 'bgColor', type: 'bg', label: 'Background', presets: ['#1a1a1add', '#000000bb', '#3f3f3f82', '#10131aee', '#00000000'] },
  { key: 'showGrid', type: 'toggle', label: 'Scrolling grid' },
  { key: 'showBeatGrid', type: 'toggle', label: 'GCD beat ticks' },
  { key: 'distinguishGcd', type: 'toggle', label: 'Distinguish GCD vs oGCD' },
  { key: 'showLabels', type: 'toggle', label: 'Skill name labels' },
  { key: 'labelScale', type: 'stepper', label: 'Label text size', min: 0.7, max: 2, step: 0.1, dp: 1 },
  { key: 'showTooltips', type: 'toggle', label: 'Hover tooltips' },

  { section: 'Tracking' },
  { key: 'castMode', type: 'dropdown', label: 'Cast display', options: [['press', 'Button hit (one icon)'], ['both', 'Cast + complete']] },
  { key: 'showAutoAttacks', type: 'toggle', label: 'Auto-attacks (+ interval)' },
  { key: 'aaIntervalScale', type: 'stepper', label: 'Auto-attack text size', min: 0.7, max: 2.5, step: 0.1, dp: 1 },
  { key: 'showPetActions', type: 'toggle', label: 'Pet actions' },
  { key: 'checkPositionals', type: 'toggle', label: 'Check positional misses' },
  { key: 'validatePetActions', type: 'toggle', label: 'Validate pet actions (ghosts)' },
  { key: 'trackClipping', type: 'toggle', label: 'Track GCD clipping' },
  { key: 'showDots', type: 'toggle', label: 'DoT / debuff timers' },
  { key: 'dotWarnThreshold', type: 'stepper', label: 'DoT refresh warning (sec)', min: 1, max: 12, step: 1 },
  { key: 'dotAlert', type: 'dropdown', label: 'DoT expiry alert', options: [['off', 'Off'], ['flash', 'Screen flash'], ['sound', 'Beep']] },

  { section: 'Analysis' },
  { key: 'showGcdUptime', type: 'toggle', label: 'GCD uptime % (header)' },
  { key: 'highlightBuffs', type: 'toggle', label: 'Highlight raid-buff windows' },
  { key: 'showDeathMarkers', type: 'toggle', label: 'Death markers on bar' },
  { key: 'openerCountdown', type: 'toggle', label: 'Opener countdown' },
  { key: 'showSummary', type: 'toggle', label: 'Pull summary card' },

  { section: 'Meter' },
  { key: 'meterMetric', type: 'dropdown', label: 'Top-right metric', options: [['dps', 'Personal DPS'], ['hps', 'Healing /s'], ['dtps', 'Damage taken /s'], ['rdps', 'Raid DPS'], ['off', 'Off']] },

  { section: 'Language' },
  { key: 'lang', type: 'dropdown', label: 'Language', options: [['JP', '日本語'], ['EN', 'English'], ['FR', 'Français'], ['CN', '中文']] },
];

let onChangeCb = null;

export function buildSettings(onChange) {
  onChangeCb = onChange;
  const root = document.getElementById('settings');
  root.innerHTML = '';
  enableDragScroll(root);

  const head = el('div', 'settings-head');
  const h = el('span'); h.textContent = 'Grim — settings';
  head.appendChild(h);
  const close = el('i', 'material-icons iconbutton'); close.textContent = 'close';
  close.setAttribute('data-tip', 'Close settings');
  close.onclick = () => toggleSettings(false);
  head.appendChild(close);
  root.appendChild(head);

  const note = el('div', 'settings-note');
  note.textContent = '🔒 Tip: lock the overlay in OverlayPlugin before typing in text fields.';
  root.appendChild(note);

  for (const row of SCHEMA) {
    if (row.section) { const s = el('div', 'settings-section'); s.textContent = row.section; root.appendChild(s); continue; }
    root.appendChild(control(row));
  }

  const footer = el('div', 'settings-footer');
  const reset = el('button', 'reset-btn'); reset.textContent = 'Reset all settings';
  reset.onclick = () => { localStorage.removeItem('grim-skill-display'); location.reload(); };
  footer.appendChild(reset);
  const ver = el('div', 'version'); ver.textContent = 'Grim v1.1 · data current to live patch';
  footer.appendChild(ver);
  root.appendChild(footer);
}

function apply(key, v) { set(key, v); clearBars(); onChangeCb?.(key, v); }

// Drag anywhere in the panel to scroll it, instead of OverlayPlugin moving the whole overlay.
// (When the overlay is unlocked, the plugin captures drags as window-moves; we intercept here.)
function enableDragScroll(root) {
  let dragging = false, startY = 0, startTop = 0, moved = false;
  root.addEventListener('mousedown', (e) => {
    e.stopPropagation();                       // stop the overlay window-drag
    if (e.target.closest('button, input, .dropdown, .swatch, .toggle')) return; // let controls work
    dragging = true; moved = false; startY = e.clientY; startTop = root.scrollTop;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    root.scrollTop = startTop - (e.clientY - startY);
    if (Math.abs(e.clientY - startY) > 3) moved = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  root.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
}

function control(row) {
  const wrap = el('div', 'control');
  const name = el('span', 'control-label'); name.textContent = row.label;
  if (HELP[row.key]) { name.setAttribute('data-tip', HELP[row.key]); wrap.setAttribute('data-tip', HELP[row.key]); }
  wrap.appendChild(name);

  if (row.type === 'toggle') wrap.appendChild(toggle(row));
  else if (row.type === 'stepper') wrap.appendChild(stepper(row));
  else if (row.type === 'dropdown') wrap.appendChild(dropdown(row));
  else if (row.type === 'swatches') wrap.appendChild(swatches(row));
  else if (row.type === 'bg') wrap.appendChild(bgControl(row));
  return wrap;
}

function toggle(row) {
  const inp = el('input'); inp.type = 'checkbox'; inp.className = 'toggle';
  inp.checked = !!get(row.key);
  inp.onchange = () => apply(row.key, inp.checked);
  return inp;
}

function stepper(row) {
  const box = el('div', 'stepper');
  const minus = el('button', 'step-btn'); minus.textContent = '−';
  const val = el('span', 'step-val');
  const plus = el('button', 'step-btn'); plus.textContent = '+';
  const fmt = (n) => (row.dp ? n.toFixed(row.dp) : String(n));
  const paint = () => { val.textContent = fmt(get(row.key)); };
  const clamp = (n) => Math.min(row.max, Math.max(row.min, Math.round(n / row.step) * row.step));
  minus.onclick = () => { apply(row.key, clamp(get(row.key) - row.step)); paint(); };
  plus.onclick = () => { apply(row.key, clamp(get(row.key) + row.step)); paint(); };
  paint();
  box.append(minus, val, plus);
  return box;
}

function dropdown(row) {
  const box = el('div', 'dropdown');
  const btn = el('button', 'dropdown-btn');
  const list = el('div', 'dropdown-list hide');
  const labelFor = (v) => (row.options.find((o) => o[0] === v) || ['', v])[1];
  const paint = () => { btn.innerHTML = `${labelFor(get(row.key))} <span class="caret">▾</span>`; };
  btn.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.dropdown-list').forEach((l) => { if (l !== list) l.classList.add('hide'); });
    list.classList.toggle('hide');
  };
  for (const [v, label] of row.options) {
    const opt = el('div', 'dropdown-opt'); opt.textContent = label;
    if (get(row.key) === v) opt.classList.add('sel');
    opt.onclick = (e) => {
      e.stopPropagation();
      apply(row.key, v);
      list.querySelectorAll('.dropdown-opt').forEach((o) => o.classList.remove('sel'));
      opt.classList.add('sel');
      list.classList.add('hide'); paint();
    };
    list.appendChild(opt);
  }
  document.addEventListener('click', () => list.classList.add('hide'));
  paint();
  box.append(btn, list);
  return box;
}

function swatches(row) {
  const box = el('div', 'swatches');
  const paint = () => box.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.c.toLowerCase() === String(get(row.key)).toLowerCase()));
  for (const c of row.colors) {
    const s = el('button', 'swatch'); s.dataset.c = c; s.style.background = c;
    s.setAttribute('data-tip', c);
    s.onclick = () => { apply(row.key, c); paint(); };
    box.appendChild(s);
  }
  paint();
  return box;
}

function bgControl(row) {
  const box = el('div', 'bg-control');
  const sw = el('div', 'swatches');
  const paint = () => sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.c.toLowerCase() === String(get(row.key)).toLowerCase()));
  for (const c of row.presets) {
    const s = el('button', 'swatch'); s.dataset.c = c; s.style.background = c.endsWith('00') ? 'repeating-conic-gradient(#777 0% 25%, #444 0% 50%) 50%/8px 8px' : c;
    s.setAttribute('data-tip', c === '#00000000' ? 'Transparent' : c);
    s.onclick = () => { apply(row.key, c); txt.value = c; paint(); };
    sw.appendChild(s);
  }
  const txt = el('input', 'hex-input'); txt.type = 'text'; txt.value = get(row.key) || ''; txt.placeholder = '#RRGGBBAA';
  txt.setAttribute('data-tip', HELP.bgColor);
  txt.onchange = () => { const v = normalizeHex(txt.value.trim()); if (v) { apply(row.key, v); txt.value = v; paint(); } };
  box.append(sw, txt);
  return box;
}

function normalizeHex(c) {
  if (!c) return null;
  if (c[0] !== '#') c = '#' + c;
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c) ? c : null;
}

export function toggleSettings(force) {
  const panel = document.getElementById('settings');
  const main = document.getElementById('main');
  const show = force ?? panel.classList.contains('hide');
  panel.classList.toggle('hide', !show);
  main.classList.toggle('dimmed', show);
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
