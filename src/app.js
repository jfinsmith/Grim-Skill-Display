// app.js — entry point. Loads data + settings, initialises modules, wires the UI,
// and starts listening to ACT.

import listenToACT from './act.js';
import { loadData } from './data.js';
import { loadSettings, get, set, subscribe } from './store.js';
import { initLanes } from './bar.js';
import { initHeader, toast } from './header.js';
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

// Icon sizes scale with the overlay's height so the bar never clips and stays centered.
function setupResponsiveSizing() {
  const sd = document.getElementById('skilldisplayer');
  const ro = new ResizeObserver(() => sizeIcons());
  ro.observe(sd);
  sizeIcons();
}

function sizeIcons() {
  const sd = document.getElementById('skilldisplayer');
  if (!sd) return;
  const h = sd.clientHeight || 80;
  const scale = get('scale') || 1;
  const gcd = Math.max(16, h * 0.42 * scale); // sized to the full overlay height; main lane is centered
  const r = document.documentElement.style;
  r.setProperty('--gcd-size', `${gcd}px`);
  r.setProperty('--ogcd-size', `${gcd * 0.72}px`);
  r.setProperty('--aa-size', `${gcd * 0.3}px`); // auto-attacks ~a quarter of a GCD
}

const VISUAL_KEYS = new Set(['showGrid', 'showBeatGrid', 'pinHeader', 'barDirection', 'displayTime', 'showAutoAttacks', 'showPetActions', 'showFps', 'barWidth', 'barAlign', 'uiLock']);

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

  // bar width / position inside the overlay window. OverlayPlugin gives a page no way to move
  // its own window, so "center on screen" = a screen-wide window with a narrower, centered bar.
  const app = document.getElementById('app');
  const width = Math.min(100, Math.max(10, Number(get('barWidth')) || 100));
  const align = get('barAlign') || 'center';
  app.style.width = `${width}%`;
  app.style.marginLeft = align === 'left' ? '0' : 'auto';
  app.style.marginRight = align === 'right' ? '0' : 'auto';
  document.getElementById('btn-center').classList.toggle('active', align === 'center' && width < 100);

  // layout lock: hides the resize corner and the center button so nothing shifts by accident
  const locked = !!get('uiLock');
  document.body.classList.toggle('ui-locked', locked);
  const lockBtn = document.getElementById('btn-lock');
  lockBtn.textContent = locked ? 'lock' : 'lock_open';
  lockBtn.classList.toggle('active', locked);
}

function wireHeaderButtons() {
  document.getElementById('btn-pin').onclick = () => set('pinHeader', !get('pinHeader'));
  document.getElementById('btn-center').onclick = () => {
    const centered = get('barAlign') === 'center' && (Number(get('barWidth')) || 100) < 100;
    if (centered) { set('barWidth', 100); }
    else { set('barAlign', 'center'); if ((Number(get('barWidth')) || 100) >= 100) set('barWidth', 60); }
  };
  document.getElementById('btn-lock').onclick = () => {
    const next = !get('uiLock');
    set('uiLock', next);
    if (next) toast('Layout locked. To lock the window itself: right-click it in OverlayPlugin → Lock');
  };
  document.getElementById('btn-settings').onclick = () => toggleSettings();
  document.getElementById('btn-reset').onclick = () => {
    try { window.OverlayPluginApi?.endEncounter?.(); } catch {}
    fullReset();
  };
  // btn-snapshot handled in snapshot.js
}

// imported by the bootstrap in index.html, usually after `load` has already fired
if (document.readyState === 'complete') main(); else window.addEventListener('load', main);
