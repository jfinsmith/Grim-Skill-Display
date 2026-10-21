// settings-ui.js — the settings modal. It covers the whole overlay window (not just the bar),
// is tabbed, and every row carries its own explanation. All controls are CLICK-based
// (toggles, +/- steppers, segmented buttons, colour swatches) because OverlayPlugin's embedded
// browser doesn't render native <select>/<input type=color> popups and hijacks drag gestures
// (sliders/scrollbars) to move the overlay window. Normally this panel is shown as its own page
// (settings.html) in the user's real browser; inside the overlay it is only the fallback.

import { get, set, subscribe } from './store.js';
import { clearBars } from './bar.js';
import { Data } from './data.js';

const TABS = [
  { id: 'layout', label: 'Layout', rows: [
    { key: 'displayTime', type: 'stepper', label: 'Display time', unit: 's', min: 4, max: 20, step: 1,
      help: 'How many seconds a skill takes to cross the bar. Lower = faster scroll and less history on screen.' },
    { key: 'scale', type: 'stepper', label: 'Icon scale', min: 0.5, max: 2.5, step: 0.1, dp: 1,
      help: 'Size multiplier for the skill icons. Icons also grow with the bar\'s height.' },
    { key: 'barDirection', type: 'seg', label: 'Scroll direction', options: [['rtl', 'Right → Left'], ['ltr', 'Left → Right']],
      help: 'Which way skills travel across the bar.' },
    { key: 'pinHeader', type: 'toggle', label: 'Always show header',
      help: 'Keep the title bar (job, timer, meter, buttons) visible. Off = it fades out and only appears when you hover the bar.' },
  ] },
  { id: 'look', label: 'Look', rows: [
    { key: 'theme', type: 'seg', label: 'Theme', options: [['dark', 'Dark'], ['light', 'Light'], ['jobcolor', 'Job color']],
      help: 'Overall colour scheme. "Job color" tints the accent to the job you are playing.' },
    { key: 'accentColor', type: 'swatches', label: 'Accent color', colors: ['#ff7b00', '#ffd500', '#4fc3f7', '#7c4dff', '#26c281', '#ff4d6d', '#ffffff'],
      help: 'Highlight colour: GCD borders, meter, DoT bars, timer. Ignored by the Job color theme.' },
    { key: 'bgColor', type: 'bg', label: 'Background', presets: ['#1a1a1add', '#000000bb', '#3f3f3f82', '#10131aee', '#00000000'],
      help: 'Bar background. The last swatch is fully transparent. Type any #RRGGBB or #RRGGBBAA hex (lock the overlay in OverlayPlugin first so the keyboard reaches the field).' },
    { key: 'iconShape', type: 'seg', label: 'Icon shape', options: [['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']],
      help: 'Corner style of the skill icons.' },
    { key: 'distinguishGcd', type: 'toggle', label: 'Distinguish GCD vs oGCD',
      help: 'Draw GCDs larger with an accent border and oGCDs smaller on top, so weaves and your rotation\'s rhythm are obvious.' },
    { key: 'showGrid', type: 'toggle', label: 'Scrolling grid',
      help: 'The moving music-staff grid behind the icons.' },
    { key: 'showBeatGrid', type: 'toggle', label: 'GCD beat ticks',
      help: 'Faint vertical ticks marking a rough GCD rhythm.' },
    { key: 'showLabels', type: 'toggle', label: 'Skill name labels',
      help: 'Print each skill\'s name under its icon.' },
    { key: 'labelScale', type: 'stepper', label: 'Label text size', min: 0.7, max: 2, step: 0.1, dp: 1,
      help: 'Size of the skill-name labels (when enabled).' },
    { key: 'showTooltips', type: 'toggle', label: 'Hover tooltips',
      help: 'Hover an icon to see its name. Tips appear pinned at the top-center of the overlay.' },
    { key: 'showFps', type: 'toggle', label: 'Overlay FPS',
      help: 'Show this overlay\'s own render frame-rate in the header (a health check for the overlay, not the game\'s FPS).' },
  ] },
  { id: 'tracking', label: 'Tracking', rows: [
    { key: 'castMode', type: 'seg', label: 'Hard casts', options: [['press', 'One icon'], ['both', 'Cast + land']],
      help: 'One icon = a single icon with a cast bar when you start casting. Cast + land = a second icon when the spell actually resolves.' },
    { key: 'showAutoAttacks', type: 'toggle', label: 'Auto-attacks',
      help: 'Show auto-attacks in their own small lane at the top, each with the seconds since the previous one (your effective attack speed).' },
    { key: 'aaIntervalScale', type: 'stepper', label: 'Auto-attack text size', min: 0.7, max: 2.5, step: 0.1, dp: 1,
      help: 'Size of the seconds-between-auto-attacks number.' },
    { key: 'showPetActions', type: 'toggle', label: 'Pet / familiar actions',
      help: 'Show your pet\'s actions (SMN, SCH, BST familiar) in the bottom lane.' },
    { key: 'validatePetActions', type: 'toggle', label: 'Flag ghosted pet actions',
      help: 'Marks a pet action that never landed (pet de-summoned or target died first) with a red ✖ and tracks a ghost % in the header.' },
    { key: 'checkPositionals', type: 'toggle', label: 'Check positionals',
      help: 'For every rear/flank skill (MNK, DRG, NIN, SAM, RPR, VPR): a red ✖ when hit from the wrong side, and a miss % in the header.' },
    { key: 'trackClipping', type: 'toggle', label: 'Track GCD clipping',
      help: 'Learns your fastest clean GCD and counts every GCD that came late (clipped / drifted) as "clips: x/y" in the header. Lower is better.' },
  ] },
  { id: 'dots', label: 'DoTs & buffs', rows: [
    { key: 'showDots', type: 'toggle', label: 'DoT / debuff timers',
      help: 'Live countdown pips (top-left of the bar) for every DoT and damage-debuff you apply, one per target. Works for every job automatically.' },
    { key: 'dotWarnThreshold', type: 'stepper', label: 'Refresh warning', unit: 's', min: 1, max: 12, step: 1,
      help: 'Seconds of remaining time at which a pip turns red and flashes.' },
    { key: 'dotAlert', type: 'seg', label: 'Expiry alert', options: [['off', 'Off'], ['flash', 'Screen flash'], ['sound', 'Beep']],
      help: 'Extra alert when a DoT is about to fall off (the pip itself always flashes).' },
    { key: 'highlightBuffs', type: 'toggle', label: 'Highlight raid-buff windows',
      help: 'Pulse the bar gold while a party damage buff is on you (Divination, Brotherhood, Embolden, Technical Finish, …) so you can see your burst window. List: resources/data/raidbuffs.json.' },
  ] },
  { id: 'analysis', label: 'Analysis', rows: [
    { key: 'showGcdUptime', type: 'toggle', label: 'GCD uptime % in header',
      help: 'Estimated share of the fight your GCD was rolling — the single best optimisation metric.' },
    { key: 'showDeathMarkers', type: 'toggle', label: 'Death & downtime markers',
      help: 'Drop a red KO marker on the timeline when you die, and a blue ↓ after a long gap between GCDs.' },
    { key: 'openerCountdown', type: 'toggle', label: 'Opener countdown',
      help: 'A big 5→1 over the bar, synced to the in-game /countdown.' },
    { key: 'showSummary', type: 'toggle', label: 'Pull summary card',
      help: 'When combat ends, show a card with GCDs, uptime, clips, positionals, pet ghosts, deaths and per-DoT uptime.' },
    { key: 'meterMetric', type: 'seg', label: 'Meter (top-right)', options: [['dps', 'DPS'], ['hps', 'HPS'], ['dtps', 'Dmg taken/s'], ['rdps', 'Raid DPS'], ['off', 'Off']],
      help: 'What the number in the header shows. You can also click the meter itself to cycle.' },
  ] },
];

let onChangeCb = null;
let activeTab = 'layout';
let root = null;
let standalone = false; // settings.html: the page IS the panel, nothing to close
const painters = []; // every control's "refresh from store" fn, run when the modal opens (header buttons change settings too)

export function buildSettings(onChange, opts = {}) {
  onChangeCb = onChange;
  standalone = !!opts.standalone;
  root = document.getElementById('settings');
  root.innerHTML = '';
  root.addEventListener('mousedown', (e) => e.stopPropagation()); // never let OverlayPlugin drag the window from inside the modal
  if (!standalone) {
    root.addEventListener('click', (e) => { if (e.target === root) toggleSettings(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSettings(false); });
  }
  // settings changed from the other window (bar <-> settings.html): refresh the controls
  subscribe(() => painters.forEach((p) => p()));

  const box = el('div', 'settings-box');
  root.appendChild(box);

  // header
  const head = el('div', 'settings-head');
  const h = el('span', 'settings-title'); h.textContent = standalone ? 'Grim Skill Display — settings' : 'Grim — settings';
  head.appendChild(h);
  if (standalone) {
    const note = el('span', 'settings-note'); note.textContent = opts.status || 'changes apply to the bar instantly';
    head.appendChild(note);
  } else {
    const close = el('i', 'material-icons iconbutton'); close.textContent = 'close';
    close.setAttribute('data-tip', 'Close settings (Esc)');
    close.onclick = () => toggleSettings(false);
    head.appendChild(close);
  }
  box.appendChild(head);

  // tabs
  const tabs = el('div', 'settings-tabs');
  for (const t of TABS) {
    const b = el('button', 'settings-tab'); b.textContent = t.label; b.dataset.tab = t.id;
    b.onclick = () => showTab(t.id);
    tabs.appendChild(b);
  }
  box.appendChild(tabs);

  // body (one pane per tab)
  const body = el('div', 'settings-body');
  enableDragScroll(body);
  for (const t of TABS) {
    const pane = el('div', 'settings-pane hide'); pane.dataset.pane = t.id;
    for (const row of t.rows) pane.appendChild(control(row));
    body.appendChild(pane);
  }
  box.appendChild(body);

  // footer
  const footer = el('div', 'settings-footer');
  const ver = el('div', 'version');
  ver.textContent = `Grim v${Data.version || '?'} · game data ${Data.meta.gameVersion || '?'} (synced ${Data.meta.syncedAt || '?'})`;
  const reset = el('button', 'reset-btn'); reset.textContent = 'Reset all settings';
  reset.onclick = () => { localStorage.removeItem('grim-skill-display'); location.reload(); };
  footer.append(ver, reset);
  box.appendChild(footer);

  showTab(activeTab);
}

function showTab(id) {
  activeTab = id;
  root.querySelectorAll('.settings-tab').forEach((b) => b.classList.toggle('sel', b.dataset.tab === id));
  root.querySelectorAll('.settings-pane').forEach((p) => p.classList.toggle('hide', p.dataset.pane !== id));
  root.querySelector('.settings-body').scrollTop = 0;
}

function apply(key, v) { set(key, v); clearBars(); onChangeCb?.(key, v); }

// Drag anywhere in the body to scroll it (OverlayPlugin captures scrollbar drags as window moves).
function enableDragScroll(area) {
  let dragging = false, startY = 0, startTop = 0, moved = false;
  area.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, input')) return;
    dragging = true; moved = false; startY = e.clientY; startTop = area.scrollTop;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    area.scrollTop = startTop - (e.clientY - startY);
    if (Math.abs(e.clientY - startY) > 3) moved = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  area.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
}

function control(row) {
  const wrap = el('div', 'srow');
  const text = el('div', 'srow-text');
  const name = el('div', 'srow-label'); name.textContent = row.label;
  const help = el('div', 'srow-help'); help.textContent = row.help || '';
  text.append(name, help);
  wrap.appendChild(text);

  const ctl = el('div', 'srow-ctl');
  if (row.type === 'toggle') ctl.appendChild(toggle(row));
  else if (row.type === 'stepper') ctl.appendChild(stepper(row));
  else if (row.type === 'seg') ctl.appendChild(segmented(row));
  else if (row.type === 'swatches') ctl.appendChild(swatches(row));
  else if (row.type === 'bg') ctl.appendChild(bgControl(row));
  wrap.appendChild(ctl);
  return wrap;
}

function toggle(row) {
  const lab = el('label', 'toggle-wrap');
  const inp = el('input'); inp.type = 'checkbox'; inp.className = 'toggle';
  const paint = () => { inp.checked = !!get(row.key); };
  inp.onchange = () => apply(row.key, inp.checked);
  paint(); painters.push(paint);
  lab.appendChild(inp);
  return lab;
}

function stepper(row) {
  const box = el('div', 'stepper');
  const minus = el('button', 'step-btn'); minus.textContent = '−';
  const val = el('span', 'step-val');
  const plus = el('button', 'step-btn'); plus.textContent = '+';
  const fmt = (n) => (row.dp ? n.toFixed(row.dp) : String(n)) + (row.unit || '');
  const paint = () => { val.textContent = fmt(Number(get(row.key))); };
  const clamp = (n) => Math.min(row.max, Math.max(row.min, Math.round(n / row.step) * row.step));
  minus.onclick = () => { apply(row.key, clamp(Number(get(row.key)) - row.step)); paint(); };
  plus.onclick = () => { apply(row.key, clamp(Number(get(row.key)) + row.step)); paint(); };
  paint(); painters.push(paint);
  box.append(minus, val, plus);
  return box;
}

// segmented buttons instead of a dropdown: nothing pops up, nothing gets clipped, one click.
function segmented(row) {
  const box = el('div', 'seg');
  const paint = () => box.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b.dataset.v === String(get(row.key))));
  for (const [v, label] of row.options) {
    const b = el('button'); b.textContent = label; b.dataset.v = v;
    b.onclick = () => { apply(row.key, v); paint(); };
    box.appendChild(b);
  }
  paint(); painters.push(paint);
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
  paint(); painters.push(paint);
  return box;
}

function bgControl(row) {
  const box = el('div', 'bg-control');
  const sw = el('div', 'swatches');
  const paint = () => sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('sel', s.dataset.c.toLowerCase() === String(get(row.key)).toLowerCase()));
  for (const c of row.presets) {
    const s = el('button', 'swatch'); s.dataset.c = c;
    s.style.background = c.endsWith('00') ? 'repeating-conic-gradient(#777 0% 25%, #444 0% 50%) 50%/8px 8px' : c;
    s.setAttribute('data-tip', c === '#00000000' ? 'Transparent' : c);
    s.onclick = () => { apply(row.key, c); txt.value = c; paint(); };
    sw.appendChild(s);
  }
  const txt = el('input', 'hex-input'); txt.type = 'text'; txt.value = get(row.key) || ''; txt.placeholder = '#RRGGBBAA';
  txt.onchange = () => { const v = normalizeHex(txt.value.trim()); if (v) { apply(row.key, v); txt.value = v; paint(); } };
  painters.push(() => { txt.value = get(row.key) || ''; paint(); });
  box.append(sw, txt);
  return box;
}

function normalizeHex(c) {
  if (!c) return null;
  if (c[0] !== '#') c = '#' + c;
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c) ? c : null;
}

export function toggleSettings(force) {
  if (standalone) return;
  const panel = document.getElementById('settings');
  const main = document.getElementById('main');
  const show = force ?? panel.classList.contains('hide');
  if (show) painters.forEach((p) => p());
  panel.classList.toggle('hide', !show);
  main.classList.toggle('dimmed', show);
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
