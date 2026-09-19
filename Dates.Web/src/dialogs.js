// Give existing themed panels keyboard focus management without changing their layout.
const panels = [...document.querySelectorAll('#loginModal, #eventFormModal, #myeventspopup, #popup')];
const returnTargets = new WeakMap();
const openPanels = [];
const visibleControls = panel => [...panel.querySelectorAll('a[href], button, input, textarea, select, [tabindex="0"]')]
  .filter(node => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');

function syncPanels() {
  for (const panel of panels) {
    const isOpen = getComputedStyle(panel).display !== 'none';
    const index = openPanels.indexOf(panel);
    if (isOpen && index < 0) {
      returnTargets.set(panel, document.activeElement);
      openPanels.push(panel);
      queueMicrotask(() => {
        if (!panel.contains(document.activeElement)) (visibleControls(panel)[0] || panel).focus();
      });
    } else if (!isOpen && index >= 0) {
      openPanels.splice(index, 1);
      panel.inert = false;
      const target = returnTargets.get(panel);
      if (target?.isConnected) target.focus({ preventScroll: true });
    }
  }
  document.getElementById('overlay').inert = openPanels.length > 0;
  document.getElementById('bg').inert = openPanels.length > 0;
  openPanels.forEach((panel, index) => { panel.inert = index !== openPanels.length - 1; });
}
for (const panel of panels) {
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.tabIndex = -1;
  new MutationObserver(syncPanels).observe(panel, { attributes: true, attributeFilter: ['style'] });
  panel.addEventListener('click', event => {
    if (event.target === panel) closePanel(panel);
  });
}
function closePanel(panel) {
  if (panel.id === 'eventFormModal') document.getElementById('event-form-cancel').click();
  else panel.style.display = 'none';
}
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  const panel = openPanels.at(-1);
  if (!panel) return;
  if (event.key === 'Escape') { event.preventDefault(); closePanel(panel); }
  if (event.key === 'Tab') {
    const controls = visibleControls(panel);
    const first = controls[0] || panel;
    const last = controls.at(-1) || panel;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  }
});
syncPanels();
