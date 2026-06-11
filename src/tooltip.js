// tooltip.js — custom hover tooltips. Native `title` tooltips don't render inside
// OverlayPlugin's embedded browser, so we draw our own. Any element with a
// `data-tip` attribute gets a tooltip; works via event delegation (incl. dynamic nodes).

let tip = null;

export function initTooltips() {
  tip = document.createElement('div');
  tip.className = 'grim-tooltip hide';
  document.body.appendChild(tip);

  // Pinned to the top-left corner so it never sits under the cursor / the thing you're reading.
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el) return;
    tip.textContent = el.getAttribute('data-tip');
    tip.classList.remove('hide');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tip]')) tip.classList.add('hide');
  });
}
