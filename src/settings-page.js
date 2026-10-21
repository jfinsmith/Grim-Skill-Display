// settings-page.js — entry point for settings.html: the settings panel as its own page, for use
// as a second overlay inside OverlayPlugin. Same origin as the bar, so both share localStorage;
// the bar picks changes up from the `storage` event (store.js) and applies them instantly.

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
