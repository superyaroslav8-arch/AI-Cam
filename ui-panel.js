/** LOOI-style side panel: swipe from right / bottom, tiny nub */
(function () {
  'use strict';
  const panel = document.getElementById('panel');
  const scrim = document.getElementById('scrim');
  const nub = document.getElementById('menuNub');
  const closeBtn = document.getElementById('panelClose');
  const statusEl = document.getElementById('robotStatus');

  function openPanel() {
    if (!panel) return;
    panel.classList.add('open');
    if (scrim) scrim.classList.add('open');
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
  }
  function togglePanel() {
    if (panel && panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  window.CamUI = { openPanel, closePanel, togglePanel };

  if (nub) nub.addEventListener('click', openPanel);
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (scrim) scrim.addEventListener('click', closePanel);

  // Swipe from right edge → open; swipe panel right → close
  let startX = 0;
  let startY = 0;
  let tracking = false;

  function onStart(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    tracking = true;
  }
  function onEnd(e) {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const w = window.innerWidth;

    // from right edge: swipe left to open
    if (startX > w - 28 && dx < -40 && Math.abs(dy) < 80) {
      openPanel();
      return;
    }
    // from bottom: swipe up to open
    if (startY > window.innerHeight - 40 && dy < -40 && Math.abs(dx) < 80) {
      openPanel();
      return;
    }
    // on open panel: swipe right to close
    if (panel && panel.classList.contains('open') && dx > 60 && Math.abs(dy) < 100) {
      closePanel();
    }
  }

  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchend', onEnd, { passive: true });

  // Fade status like pet — show briefly then fade
  if (statusEl) {
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'textContent');
    // soft flash on status changes via MutationObserver
    const mo = new MutationObserver(() => {
      statusEl.classList.remove('fade');
      statusEl.classList.add('hi');
      clearTimeout(statusEl._fadeT);
      statusEl._fadeT = setTimeout(() => {
        statusEl.classList.add('fade');
        statusEl.classList.remove('hi');
      }, 2800);
    });
    mo.observe(statusEl, { childList: true, characterData: true, subtree: true });
  }
})();
