// settings-page.js — entry point for settings.html: the settings modal as its own page.
// Meant to run as a second OverlayPlugin overlay next to the bar. Both overlays are the same
// origin inside OverlayPlugin's browser, so they share localStorage; the bar listens for the
// `storage` event (store.js) and applies every change the moment it is saved here.

import { loadData } from './data.js';
import { loadSettings } from './store.js';
import { initTooltips } from './tooltip.js';
import { buildSettings } from './settings-ui.js';

async function main() {
  await loadData();
  loadSettings();
  initTooltips();
  buildSettings(() => {}, { standalone: true });
}

if (document.readyState === 'complete') main(); else window.addEventListener('load', main);
