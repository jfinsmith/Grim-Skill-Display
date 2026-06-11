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
import { handleEvent, fullReset } from './parser.js';

async function main() {
  await loadData();
  loadSettings();

  initLanes();
  initHeader();
  initMeter();
  initDots();
  initSnapshot();
  buildSettings(applyVisuals);

  wireHeaderButtons();
  applyVisuals();
  subscribe((_, key) => { if (VISUAL_KEYS.has(key)) applyVisuals(); });

  listenToACT(handleEvent);
  console.log('Grim Skill Display ready.');
}

const VISUAL_KEYS = new Set(['showGrid', 'showBeatGrid', 'pinHeader', 'barDirection', 'displayTime', 'showAutoAttacks', 'showPetActions']);

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
  beat.classList.toggle('hide', !get('showBeatGrid'));
  aaLane.classList.toggle('hide', !get('showAutoAttacks'));
  petLane.classList.toggle('hide', !get('showPetActions'));
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

window.addEventListener('load', main);
