// meter.js — live mini-meter, top-right. Cycles metric on click.

import { get, set } from './store.js';

// click-cycle never lands on 'off' (you couldn't click a hidden meter to escape it);
// 'off' is only selectable from the settings dropdown.
const CYCLE = ['dps', 'hps', 'dtps', 'rdps'];
const LABELS = { dps: 'DPS', hps: 'HPS', dtps: 'DT/s', rdps: 'rDPS', off: '—' };
let valueEl, labelEl, boxEl;

export function initMeter() {
  boxEl = document.getElementById('meter');
  valueEl = document.getElementById('meter-value');
  labelEl = document.getElementById('meter-label');
  paintLabel();
  boxEl.setAttribute('data-tip', 'Click to change metric (DPS → HPS → damage taken → raid DPS)');
  boxEl.addEventListener('click', () => {
    const cur = get('meterMetric');
    const idx = CYCLE.indexOf(cur);              // -1 when currently 'off' -> start at dps
    const next = CYCLE[(idx + 1) % CYCLE.length];
    set('meterMetric', next);
    paintLabel();
  });
}

function paintLabel() {
  const m = get('meterMetric');
  labelEl.textContent = LABELS[m] || 'DPS';
  boxEl.classList.toggle('hide', m === 'off');
}

const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// called from CombatData updates
export function updateMeter(encounter, you) {
  const m = get('meterMetric');
  if (m === 'off' || !valueEl) return;
  let v = '--';
  const durSec = parseDuration(encounter?.duration);
  if (m === 'dps' && you) v = commas(Math.round(num(you.ENCDPS)));
  else if (m === 'hps' && you) v = commas(Math.round(num(you.ENCHPS)));
  else if (m === 'dtps' && you) v = durSec ? commas(Math.round(num(you.damagetaken) / durSec)) : '0';
  else if (m === 'rdps') v = commas(Math.round(num(encounter?.ENCDPS)));
  valueEl.textContent = v;
}

const num = (s) => { const n = parseFloat(String(s ?? '0').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
function parseDuration(d) {
  if (!d) return 0;
  const parts = String(d).split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
