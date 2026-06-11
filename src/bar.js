// bar.js — the scrolling "music bar" renderer.
// Renders skill icons that travel across the lane, distinguishing GCDs from oGCDs,
// drawing cast bars, positional/interrupt errors, optional name labels & tooltips.

import { get } from './store.js';
import { iconPath } from './data.js';

const lanes = {};
export function initLanes() {
  lanes.aa = document.getElementById('auto-attack-lane');
  lanes.player = document.getElementById('player-lane');
  lanes.pet = document.getElementById('pet-lane');
}

// snapshot ring buffer: {t, name, icon, gcd, error} for export
const history = [];
export const getHistory = () => history;

const isGcd = (action) => Array.isArray(action.cooldownGroup) && action.cooldownGroup.includes(58);

export function appendErrorIcon(iconEl, errorClass) {
  iconEl.classList.add(errorClass);
  const img = iconEl.querySelector('img');
  if (img && img.classList.contains('casting')) img.style.backgroundColor = 'transparent';
  const mark = document.createElement('i');
  mark.className = 'material-icons error-icon';
  mark.textContent = 'error';
  iconEl.appendChild(mark);
}

// Build one travelling icon element for a given action.
// opts: { lane:'player'|'pet'|'aa', castTime (centiseconds), classes:[], forceGcd }
export function renderAction(action, opts = {}) {
  const lane = lanes[opts.lane] || lanes.player;
  if (!lane) return null;

  const displayTime = get('displayTime');
  const scale = get('scale');
  const dir = get('barDirection'); // rtl | ltr
  const gcd = opts.forceGcd ?? isGcd(action);

  const icon = document.createElement('div');
  icon.className = 'icon';
  const sizeClass = opts.lane === 'aa' ? 'aa' : (get('distinguishGcd') ? (gcd ? 'gcd' : 'ogcd') : 'gcd');
  icon.classList.add(sizeClass);
  (opts.classes || []).forEach((c) => icon.classList.add(c));

  // image
  const img = new Image();
  img.src = iconPath(action.icon) || iconPath('000405'); // 000405 = generic fallback icon
  img.className = 'skill-img';
  (opts.classes || []).forEach((c) => img.classList.add(c));
  img.onerror = () => { if (!img.src.endsWith('000405.png')) img.src = iconPath('000405'); };
  icon.appendChild(img);

  // optional name label
  if (get('showLabels') && action.name && opts.lane !== 'aa') {
    const label = document.createElement('span');
    label.className = 'icon-label';
    label.textContent = action.name;
    icon.appendChild(label);
  }
  // auto-attack interval (skill/spell-speed gauge): seconds since previous AA
  if (opts.lane === 'aa' && opts.interval > 0.1) {
    const t = document.createElement('span');
    t.className = 'aa-interval';
    t.textContent = opts.interval.toFixed(2);
    icon.appendChild(t);
  }
  // custom tooltip (native title doesn't render in OverlayPlugin's browser)
  if (get('showTooltips') && action.name) icon.setAttribute('data-tip', action.name);

  // cast bar: widen the icon's leading edge proportional to cast time
  let castBar = 0;
  const castTime = opts.castTime || 0; // centiseconds
  if ((opts.classes || []).includes('casting') && castTime !== 0) {
    castBar = castTime / (displayTime * scale);
    img.style.paddingRight = `${castBar}vw`;
  }

  // travel animation
  const from = dir === 'ltr' ? 'left' : 'right';
  icon.style[from] = `-${castBar}vw`;
  icon.animate(
    { [from]: [`-${castBar}vw`, '100%'], visibility: ['visible', 'visible'] },
    { duration: displayTime * 1000 + castTime * 10, iterations: 1 },
  );

  lane.appendChild(icon);

  // record for snapshot
  history.push({ t: Date.now(), name: action.name, icon: action.icon, gcd, error: (opts.classes || []).find((c) => c === 'mispositional' || c === 'interrupted') || '' });
  while (history.length > 200) history.shift();

  // auto-remove after it leaves the lane
  setTimeout(() => { try { lane.removeChild(icon); } catch {} }, displayTime * 1000 + castTime * 100 + 200);
  return icon;
}

export function renderAutoAttack(action, interval = 0) {
  return renderAction(action, { lane: 'aa', forceGcd: true, interval });
}

// wipe everything on screen (encounter end / settings change)
export function clearBars() {
  Object.values(lanes).forEach((l) => { if (l) l.innerHTML = ''; });
}
