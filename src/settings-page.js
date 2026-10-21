// settings-page.js — entry point for settings.html: the settings panel as its own page.
//
// Two ways it reaches the bar:
//  * Opened by the bar's ⚙ button through OverlayPlugin's `openWebsiteWithWS`: the URL carries
//    ?OVERLAY_WS=…, common.min.js connects to OverlayPlugin's WebSocket, and settings travel
//    both ways as `broadcast` messages (source 'grim-settings' ↔ 'grim-bar').
//  * Added as a second overlay inside OverlayPlugin: same origin, shared localStorage, the bar
//    picks changes up from the `storage` event. No socket needed.

import { loadData } from './data.js';
import { loadSettings, getSettings, subscribe, applyIncoming, isRemoteApply } from './store.js';
import { initTooltips } from './tooltip.js';
import { buildSettings } from './settings-ui.js';

const overWS = /[?&]OVERLAY_WS=/.test(location.href) && typeof addOverlayListener === 'function';

async function main() {
  await loadData();
  loadSettings();
  initTooltips();
  buildSettings(() => {}, { standalone: true, status: overWS ? 'connecting to ACT…' : 'changes apply to the bar instantly' });
  if (overWS) connectWS();
}

function connectWS() {
  const status = (t) => { const el = document.querySelector('.settings-note'); if (el) el.textContent = t; };
  addOverlayListener('BroadcastMessage', (m) => {
    if (m.source !== 'grim-bar' || !m.msg) return;
    if (m.msg.type === 'settings' && m.msg.settings) { applyIncoming(m.msg.settings); status('connected — changes apply to the bar instantly'); }
  });
  startOverlayEvents();
  // every local edit goes to the bar (not the ones that just came from it)
  subscribe(() => { if (!isRemoteApply()) send({ type: 'settings', settings: getSettings() }); });
  // ask the bar for its current settings (retry until it answers)
  let tries = 0;
  const ask = () => { if (tries++ < 10) { send({ type: 'get' }); setTimeout(() => { if (!document.querySelector('.settings-note')?.textContent.startsWith('connected')) ask(); }, 1500); } else status('no reply from the bar — is the Grim overlay open in ACT?'); };
  ask();
}

function send(msg) {
  try { callOverlayHandler({ call: 'broadcast', source: 'grim-settings', msg }); } catch {}
}

if (document.readyState === 'complete') main(); else window.addEventListener('load', main);
