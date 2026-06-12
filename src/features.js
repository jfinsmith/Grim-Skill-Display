// features.js — raid-buff highlight, death/downtime markers, opener countdown,
// DoT expiry alerts, pull recording, and the end-of-pull summary card.

import { Data } from './data.js';
import { get } from './store.js';
import * as rot from './rotation.js';
import { getDotUptimes } from './dots.js';

let els = {};
let combatStartMs = 0;
let deaths = 0;
const activeBuffs = new Set();
const pullLog = [];            // every player/pet action this pull (for review)
export const getPullLog = () => pullLog;

let audioCtx = null;
let countdownTimer = null;

export function initFeatures() {
  els = {
    glow: document.getElementById('buff-glow'),
    markers: document.getElementById('markers'),
    countdown: document.getElementById('countdown'),
    flash: document.getElementById('dot-alert-flash'),
    summary: document.getElementById('summary'),
  };
}

/* ---------- combat lifecycle ---------- */
export function onCombatStart() {
  combatStartMs = Date.now();
  deaths = 0;
  pullLog.length = 0;
  activeBuffs.clear();
  if (els.glow) els.glow.classList.remove('on');
  if (els.markers) els.markers.innerHTML = '';
  hideSummary();
}

export function onCombatEnd(durationStr) {
  if (get('showSummary') && pullLog.length) showSummary(durationStr);
}

export function recordPullAction(entry) { pullLog.push(entry); }

/* ---------- raid-buff highlight ---------- */
// from LogLine 26 / 30. We only care about buffs landing on the player.
export function onBuffGain(p, playerID) {
  if (!get('highlightBuffs')) return;
  if (parseInt(p[5], 16) !== playerID) return;     // target must be the player
  if (!Data.raidbuffs.has(p[1])) return;
  activeBuffs.add(p[1]);
  els.glow?.classList.add('on');
}
export function onBuffLose(p, playerID) {
  if (parseInt(p[5], 16) !== playerID) return;
  activeBuffs.delete(p[1]);
  if (!activeBuffs.size) els.glow?.classList.remove('on');
}

/* ---------- death marker ---------- */
export function onDeath() {
  deaths++;
  if (get('showDeathMarkers')) addMarker('death', 'KO');
}
// a vertical marker that scrolls across the bar like the icons do
export function addMarker(cls, label) {
  if (!els.markers) return;
  const dir = get('barDirection') === 'ltr' ? 'left' : 'right';
  const m = document.createElement('div');
  m.className = `marker ${cls}`;
  m.innerHTML = `<span>${label}</span>`;
  els.markers.appendChild(m);
  const dur = get('displayTime') * 1000;
  m.animate(
    [
      { [dir]: '0%', opacity: 1, offset: 0 },
      { opacity: 1, offset: 0.82 },
      { [dir]: '100%', opacity: 0, offset: 1 },
    ],
    { duration: dur, iterations: 1, easing: 'linear', fill: 'forwards' },
  );
  setTimeout(() => { try { els.markers.removeChild(m); } catch {} }, dur + 200);
}

/* ---------- DoT expiry alert ---------- */
export function triggerDotAlert(name) {
  const mode = get('dotAlert');
  if (mode === 'flash' && els.flash) {
    els.flash.classList.remove('show'); void els.flash.offsetWidth; els.flash.classList.add('show');
  } else if (mode === 'sound') {
    beep();
  }
}
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
    o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.3);
  } catch {}
}

/* ---------- opener countdown ---------- */
// best-effort: triggered by the game's "Battle commencing in N seconds!" system line (00).
export function maybeCountdown(p) {
  if (!get('openerCountdown')) return;
  const text = p.join(' ');
  const m = /commencing in (\d+)/i.exec(text);
  if (!m) return;
  startCountdown(parseInt(m[1], 10));
}
function startCountdown(seconds) {
  if (!els.countdown) return;
  clearInterval(countdownTimer);
  let n = seconds;
  const tick = () => {
    if (n <= 0) { els.countdown.classList.add('hide'); clearInterval(countdownTimer); return; }
    els.countdown.textContent = n;
    els.countdown.classList.remove('hide');
    els.countdown.classList.remove('pulse'); void els.countdown.offsetWidth; els.countdown.classList.add('pulse');
    n--;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

/* ---------- summary card ---------- */
function showSummary(durationStr) {
  const durSec = parseDur(durationStr);
  const up = rot.gcdUptime(durSec);
  const dots = getDotUptimes(durSec * 1000).slice(0, 4);
  const row = (label, val, cls = '') => `<div class="sum-row"><span>${label}</span><span class="${cls}">${val}</span></div>`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  els.summary.innerHTML = `
    <div class="sum-head"><span>Pull summary · ${durationStr || '0:00'}</span><i class="material-icons iconbutton" id="sum-close">close</i></div>
    ${row('GCDs', rot.stats.gcds)}
    ${up != null ? row('GCD uptime', `${up}%`, up >= 97 ? 'good' : up >= 92 ? 'ok' : 'bad') : ''}
    ${row('GCD clips', `${rot.stats.clips}/${rot.stats.gcds} (${pct(rot.stats.clips, rot.stats.gcds)}%)`, rot.stats.clips === 0 ? 'good' : 'bad')}
    ${rot.stats.positional ? row('Positional misses', `${rot.stats.mispositional}/${rot.stats.positional} (${pct(rot.stats.mispositional, rot.stats.positional)}%)`, rot.stats.mispositional === 0 ? 'good' : 'bad') : ''}
    ${rot.stats.pet ? row('Pet ghosts', `${rot.stats.petGhost}/${rot.stats.pet}`, rot.stats.petGhost === 0 ? 'good' : 'bad') : ''}
    ${row('Deaths', deaths, deaths === 0 ? 'good' : 'bad')}
    ${dots.length ? `<div class="sum-sub">DoT / debuff uptime</div>${dots.map((d) => row(d.name, `${d.pct}%`, d.pct >= 90 ? 'good' : d.pct >= 75 ? 'ok' : 'bad')).join('')}` : ''}
  `;
  els.summary.classList.remove('hide');
  document.getElementById('sum-close').onclick = hideSummary;
}
export function hideSummary() { els.summary?.classList.add('hide'); }

function parseDur(d) {
  if (!d) return 0;
  const x = String(d).split(':').map(Number);
  return x.length === 2 ? x[0] * 60 + x[1] : (x.length === 3 ? x[0] * 3600 + x[1] * 60 + x[2] : 0);
}
