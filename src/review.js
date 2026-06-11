// review.js — "pause & review": overlay a static, scrollable strip of the whole pull.

import { iconPath } from './data.js';
import { get } from './store.js';
import { getPullLog } from './features.js';

let panel = null;

export function initReview() {
  panel = document.getElementById('review');
  document.getElementById('btn-review').addEventListener('click', toggleReview);
}

export function toggleReview() {
  if (!panel) return;
  if (panel.classList.contains('hide')) openReview();
  else panel.classList.add('hide');
}

function openReview() {
  const log = getPullLog();
  const head = `<div class="rev-head"><span>Pull review — ${log.length} actions (scroll / drag)</span>
    <i class="material-icons iconbutton" id="rev-close">close</i></div>`;
  if (!log.length) {
    panel.innerHTML = head + `<div class="rev-empty">No actions recorded yet — pull something first.</div>`;
  } else {
    const t0 = log[0].t;
    const strip = log.map((e) => {
      const cls = e.lane === 'aa' ? 'aa' : (e.gcd ? 'gcd' : 'ogcd');
      const sec = ((e.t - t0) / 1000).toFixed(1);
      const err = e.error ? `<i class="material-icons rev-err">error</i>` : '';
      return `<div class="rev-icon ${cls} ${e.error || ''}">
        <img src="${iconPath(e.icon)}" onerror="this.src='${iconPath('000405')}'">${err}
        <span class="rev-name">${e.name || ''}</span><span class="rev-t">${sec}s</span></div>`;
    }).join('');
    panel.innerHTML = head + `<div class="rev-strip" id="rev-strip">${strip}</div>`;
    enableDragScrollX(document.getElementById('rev-strip'));
  }
  document.getElementById('rev-close').onclick = () => panel.classList.add('hide');
  panel.classList.remove('hide');
}

function enableDragScrollX(el) {
  let down = false, startX = 0, startLeft = 0;
  el.addEventListener('mousedown', (e) => { e.stopPropagation(); down = true; startX = e.clientX; startLeft = el.scrollLeft; });
  window.addEventListener('mousemove', (e) => { if (down) el.scrollLeft = startLeft - (e.clientX - startX); });
  window.addEventListener('mouseup', () => { down = false; });
  el.addEventListener('wheel', (e) => { el.scrollLeft += e.deltaY; e.preventDefault(); }, { passive: false });
}
