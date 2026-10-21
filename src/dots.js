// dots.js — DoT / damage-debuff uptime tracker.
// Detected live from status lines: any status the player applies to an enemy is
// shown as a countdown pip. When time remaining drops below the warn threshold the
// pip flashes so you know to refresh. No per-job hardcoding -> works for every job,
// current and future. (Covers DoTs *and* maintain-debuffs like Death's Design.)

import { get } from './store.js';
import { triggerDotAlert } from './features.js';

// keyed by `${effectId}:${targetId}` so the same DoT on two enemies gets two pips and one
// target dying / dropping it doesn't clear the other's timer.
const active = new Map(); // key -> {name, expireMs, duration, gainMs}
const uptime = new Map(); // name -> cumulative active ms (for the pull summary)
const alerted = new Set(); // effectIds already alerted this expiry cycle
let container = null;
let ticking = false;

export function initDots() {
  container = document.getElementById('dot-tracker');
  if (!ticking) { ticking = true; requestAnimationFrame(loop); }
}

// from LogLine 26 (GainsEffect): params [effectId, name, duration, srcId, srcName, tgtId, tgtName,...]
export function onStatusGain(p, playerID) {
  if (!get('showDots')) return;
  const srcId = parseInt(p[3], 16);
  const tgtId = parseInt(p[5], 16);
  if (srcId !== playerID || tgtId === playerID) return; // only player's debuffs on others
  const duration = parseFloat(p[2]);
  if (!(duration >= 5 && duration <= 120)) return;       // skip stuns / permanent / buffs
  const key = `${parseInt(p[0], 16)}:${tgtId}`;
  active.set(key, { name: p[1] || 'DoT', duration, expireMs: Date.now() + duration * 1000, gainMs: Date.now() });
  alerted.delete(key);
}

// from LogLine 30 (LosesEffect): same param layout
export function onStatusLose(p, playerID) {
  const srcId = parseInt(p[3], 16);
  if (srcId !== playerID) return;
  accrue(`${parseInt(p[0], 16)}:${parseInt(p[5], 16)}`);
}

function accrue(key) {
  const d = active.get(key);
  if (d) { uptime.set(d.name, (uptime.get(d.name) || 0) + (Date.now() - d.gainMs)); active.delete(key); }
}

// per-DoT uptime % for the summary; flush still-active ones first
export function getDotUptimes(durationMs) {
  [...active.keys()].forEach(accrue); // settle currently-active
  const out = [];
  for (const [name, ms] of uptime) out.push({ name, pct: Math.min(100, Math.round((ms / durationMs) * 100)) });
  return out.sort((a, b) => b.pct - a.pct);
}

export function clearDots() { active.clear(); uptime.clear(); alerted.clear(); if (container) container.innerHTML = ''; }

function loop() {
  if (container && get('showDots')) render();
  requestAnimationFrame(loop);
}

function render() {
  const now = Date.now();
  const warn = get('dotWarnThreshold');
  const entries = [...active.entries()].sort((a, b) => a[1].expireMs - b[1].expireMs);
  if (!entries.length) { container.classList.add('hide'); container.innerHTML = ''; return; }
  container.classList.remove('hide');

  // reconcile DOM
  const seen = new Set();
  for (const [id, d] of entries) {
    const remain = (d.expireMs - now) / 1000;
    if (remain <= 0) { active.delete(id); continue; }
    seen.add(id);
    let pip = container.querySelector(`[data-dot="${id}"]`);
    if (!pip) {
      pip = document.createElement('div');
      pip.className = 'dot-pip';
      pip.dataset.dot = id;
      pip.innerHTML = `<span class="dot-name"></span><span class="dot-time"></span><div class="dot-bar"></div>`;
      container.appendChild(pip);
    }
    pip.querySelector('.dot-name').textContent = d.name;
    pip.querySelector('.dot-time').textContent = remain.toFixed(0);
    pip.querySelector('.dot-bar').style.width = `${Math.min(100, (remain / d.duration) * 100)}%`;
    const warning = remain <= warn;
    pip.classList.toggle('warn', warning);
    if (warning && !alerted.has(id)) { alerted.add(id); triggerDotAlert(d.name); }
  }
  // drop stale pips
  container.querySelectorAll('.dot-pip').forEach((pip) => {
    if (!seen.has(pip.dataset.dot)) pip.remove();
  });
}
