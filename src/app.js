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

const VISUAL_KEYS = new Set(['showGrid', 'showBeatGrid', 'pinHeader', 'barDirection', 'displayTime', 'showAutoAttacks', 'showPetActions', 'showFps', 'barWidth', 'barHeight', 'barAlign', 'barVAlign']);

const pct = (v, dflt = 100) => Math.min(100, Math.max(10, Number(v) || dflt));
const isCentered = () => get('barAlign') === 'center' && get('barVAlign') === 'center' && (pct(get('barWidth')) < 100 || pct(get('barHeight')) < 100);

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

  // bar size / position inside the overlay window. OverlayPlugin gives a page no way to move or
  // resize its own window, so the window is a (transparent) canvas and the bar is a box in it:
  // make the window big, put it where you want on screen, and the bar sits inside it.
  const app = document.getElementById('app');
  const align = get('barAlign') || 'center';
  const valign = get('barVAlign') || 'center';
  app.style.width = `${pct(get('barWidth'))}%`;
  app.style.height = `${pct(get('barHeight'))}vh`;
  app.style.marginLeft = align === 'left' ? '0' : 'auto';
  app.style.marginRight = align === 'right' ? '0' : 'auto';
  app.style.marginTop = valign === 'top' ? '0' : 'auto';
  app.style.marginBottom = valign === 'bottom' ? '0' : 'auto';
  document.getElementById('btn-center').classList.toggle('active', isCentered());
}

function wireHeaderButtons() {
  document.getElementById('btn-pin').onclick = () => set('pinHeader', !get('pinHeader'));
  document.getElementById('btn-center').onclick = () => {
    if (isCentered()) { set('barWidth', 100); set('barHeight', 100); return; }
    set('barAlign', 'center'); set('barVAlign', 'center');
    if (pct(get('barWidth')) >= 100) set('barWidth', 60);
    if (pct(get('barHeight')) >= 100) set('barHeight', 50);
    toast('Bar centered inside the overlay window — make the window bigger and the bar stays small in the middle');
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
