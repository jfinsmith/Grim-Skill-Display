// app.js — entry point. Loads data + settings, initialises modules, wires the UI,
// and starts listening to ACT.

import listenToACT from './act.js';
import { loadData } from './data.js';
import { loadSettings, get, set, subscribe } from './store.js';
import { initLanes } from './bar.js';
import { initHeader } from './header.js';
import { initMeter } from './meter.js';
import { initDots } from './dots.js';
import { initSnapshot } from './snapshot.js';
import { buildSettings, toggleSettings } from './settings-ui.js';
import { initTooltips } from './tooltip.js';
import { initFeatures } from './features.js';
import { initReview } from './review.js';
import { handleEvent, fullReset } from './parser.js';

async function main() {
  await loadData();
  loadSettings();

  initTooltips();
  initLanes();
  initHeader();
  initMeter();
  initDots();
  initFeatures();
  initReview();
  initSnapshot();
  buildSettings(applyVisuals);

  wireHeaderButtons();
  applyVisuals();
  setupResponsiveSizing();
  setupFps();
  subscribe((_, key) => { if (VISUAL_KEYS.has(key)) applyVisuals(); if (key === 'scale') sizeIcons(); });

  listenToACT(handleEvent);
  // dev hook: feed synthetic ACT events from the console, e.g.
  //   grim.handleEvent({ type: 'LogLine', message: ['21', ts, '10000001', 'Me', '2C6B', 'Smash Axe', '40001234', 'Dummy', '710003', '1234', ...] })
  window.grim = { handleEvent, fullReset };
  console.log('Grim Skill Display ready.');
}

// The bar has a fixed height driven by the icon scale and sits at the bottom of the overlay
// window, above the header. Extra window height stays empty, so you can make the window tall
// (to give the settings panel room) without the bar growing with it.
function setupResponsiveSizing() { sizeIcons(); }

function sizeIcons() {
  const scale = get('scale') || 1;
  const gcd = Math.round(46 * scale);
  const r = document.documentElement.style;
  r.setProperty('--gcd-size', `${gcd}px`);
  r.setProperty('--ogcd-size', `${Math.round(gcd * 0.72)}px`);
  r.setProperty('--aa-size', `${Math.round(gcd * 0.3)}px`); // auto-attacks ~a quarter of a GCD
  r.setProperty('--bar-height', `${Math.round(gcd * 2.4)}px`); // AA lane + main lane + pet lane
}

const VISUAL_KEYS = new Set(['showGrid', 'showBeatGrid', 'pinHeader', 'barDirection', 'displayTime', 'showAutoAttacks', 'showPetActions', 'showFps']);

// Overlay render FPS (a health indicator for the overlay itself, not the game's FPS).
function setupFps() {
  const el = document.getElementById('fps');
  let frames = 0;
  let last = performance.now();
  const loop = (now) => {
    frames += 1;
    if (now - last >= 1000) {
      if (get('showFps')) el.textContent = `${Math.round((frames * 1000) / (now - last))} FPS`;
      frames = 0;
      last = now;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// Push settings that map to DOM classes / inline styles.
function applyVisuals() {
  const sd = document.getElementById('skilldisplayer');
  const header = document.getElementById('header');
  const beat = document.getElementById('beat-grid');
  const aaLane = document.getElementById('auto-attack-lane');
  const petLane = document.getElementById('pet-lane');

  sd.classList.toggle('bg-active', get('showGrid'));
  sd.classList.toggle('ltr', get('barDirection') === 'ltr');
  sd.style.animationDuration = `${get('displayTime')}s`;
  header.classList.toggle('pinned', get('pinHeader'));
  document.getElementById('btn-pin').classList.toggle('active', get('pinHeader'));
  beat.classList.toggle('hide', !get('showBeatGrid'));
  aaLane.classList.toggle('hide', !get('showAutoAttacks'));
  petLane.classList.toggle('hide', !get('showPetActions'));
  const fpsEl = document.getElementById('fps');
  fpsEl.classList.toggle('hide', !get('showFps'));
  if (!get('showFps')) fpsEl.textContent = '';
}

function wireHeaderButtons() {
  document.getElementById('btn-pin').onclick = () => set('pinHeader', !get('pinHeader'));
  document.getElementById('btn-settings').onclick = () => toggleSettings();
  document.getElementById('btn-reset').onclick = () => {
    try { window.OverlayPluginApi?.endEncounter?.(); } catch {}
    fullReset();
  };
  // btn-snapshot handled in snapshot.js
}

// imported by the bootstrap in index.html, usually after `load` has already fired
if (document.readyState === 'complete') main(); else window.addEventListener('load', main);
