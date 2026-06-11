// snapshot.js — export the recent rotation history as a PNG strip you can share.
// Draws the last ~N skills (from bar.js history) onto a canvas and triggers a download.

import { getHistory } from './bar.js';
import { iconPath } from './data.js';

const SIZE = 48, GAP = 6, PAD = 12, SECONDS = 15;

export function initSnapshot() {
  document.getElementById('btn-snapshot').addEventListener('click', exportSnapshot);
}

async function exportSnapshot() {
  const cutoff = Date.now() - SECONDS * 1000;
  const items = getHistory().filter((h) => h.t >= cutoff);
  if (!items.length) return flash('nothing to snapshot yet');

  const w = PAD * 2 + items.length * SIZE + (items.length - 1) * GAP;
  const h = PAD * 2 + SIZE + 18;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#16161a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#888'; ctx.font = '11px sans-serif';
  ctx.fillText(`Grim Skill Display — last ${SECONDS}s`, PAD, h - 6);

  await Promise.all(items.map((it, i) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const x = PAD + i * (SIZE + GAP);
      ctx.save();
      if (it.gcd) { ctx.strokeStyle = '#ff7b00'; ctx.lineWidth = 2; ctx.strokeRect(x - 1, PAD - 1, SIZE + 2, SIZE + 2); }
      ctx.drawImage(img, x, PAD, SIZE, SIZE);
      if (it.error) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x + SIZE, PAD + SIZE); ctx.stroke(); }
      ctx.restore();
      res();
    };
    img.onerror = res;
    img.src = iconPath(it.icon);
  })));

  const a = document.createElement('a');
  a.download = `grim-rotation-${stamp()}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
  flash('snapshot saved');
}

function stamp() { const d = new Date(); return `${d.getHours()}${d.getMinutes()}${d.getSeconds()}`; }
function flash(msg) {
  const el = document.getElementById('desc');
  if (!el) return;
  el.classList.remove('hide'); el.textContent = msg;
  setTimeout(() => el.classList.add('hide'), 2500);
}
