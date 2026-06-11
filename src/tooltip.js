// tooltip.js — custom hover tooltips. Native `title` tooltips don't render inside
// OverlayPlugin's embedded browser, so we draw our own. Any element with a
// `data-tip` attribute gets a tooltip; works via event delegation (incl. dynamic nodes).

let tip = null;

export function initTooltips() {
  tip = document.createElement('div');
  tip.className = 'grim-tooltip hide';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    tip.textContent = el.getAttribute('data-tip');
    tip.classList.remove('hide');
    place(e);
  });
  document.addEventListener('mousemove', (e) => { if (!tip.classList.contains('hide')) place(e); });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tip]')) tip.classList.add('hide');
  });
}

function place(e) {
  const pad = 14;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + w > window.innerWidth) x = e.clientX - w - pad;
  if (y + h > window.innerHeight) y = e.clientY - h - pad;
  tip.style.left = `${Math.max(2, x)}px`;
  tip.style.top = `${Math.max(2, y)}px`;
}
