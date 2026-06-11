// dots.js — DoT / damage-debuff uptime tracker.
// Detected live from status lines: any status the player applies to an enemy is
// shown as a countdown pip. When time remaining drops below the warn threshold the
// pip flashes so you know to refresh. No per-job hardcoding -> works for every job,
// current and future. (Covers DoTs *and* maintain-debuffs like Death's Design.)

import { get } from './store.js';

const active = new Map(); // effectId -> {name, expireMs, duration}
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
  const effectId = parseInt(p[0], 16);
  active.set(effectId, { name: p[1] || 'DoT', duration, expireMs: Date.now() + duration * 1000 });
}

// from LogLine 30 (LosesEffect): same param layout
export function onStatusLose(p, playerID) {
  const srcId = parseInt(p[3], 16);
  if (srcId !== playerID) return;
  active.delete(parseInt(p[0], 16));
}

export function clearDots() { active.clear(); if (container) container.innerHTML = ''; }

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
    seen.add(String(id));
    let pip = container.querySelector(`[data-dot="${id}"]`);
    if (!pip) {
      pip = document.createElement('div');
      pip.className = 'dot-pip';
      pip.dataset.dot = String(id);
      pip.innerHTML = `<span class="dot-name"></span><span class="dot-time"></span><div class="dot-bar"></div>`;
      container.appendChild(pip);
    }
    pip.querySelector('.dot-name').textContent = d.name;
    pip.querySelector('.dot-time').textContent = remain.toFixed(0);
    pip.querySelector('.dot-bar').style.width = `${Math.min(100, (remain / d.duration) * 100)}%`;
    pip.classList.toggle('warn', remain <= warn);
  }
  // drop stale pips
  container.querySelectorAll('.dot-pip').forEach((pip) => {
    if (!seen.has(pip.dataset.dot)) pip.remove();
  });
}
