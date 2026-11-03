/** LOOI-style pet UI: full-screen eyes, swipe side panel */
(function () {
  'use strict';
  const panel = document.querySelector('.panel');
  const scrim = document.getElementById('scrim');
  const nub = document.getElementById('menuNub');
  const statusEl = document.getElementById('robotStatus');
  if (!panel) return;

  let open = false;
  let startX = 0, startY = 0, tracking = false;

  function setOpen(v) {
    open = v;
    panel.classList.toggle('open', open);
    if (scrim) scrim.classList.toggle('open', open);
  }

  function toggle() { setOpen(!open); }

  if (nub) nub.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  if (scrim) scrim.addEventListener('click', () => setOpen(false));
  const btnClose = document.getElementById('btnPanelClose');
  if (btnClose) btnClose.addEventListener('click', () => setOpen(false));

  // Swipe from right edge → open; swipe panel right → close
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    const fromRight = startX > window.innerWidth - 28;
    const fromBottom = startY > window.innerHeight - 36;
    tracking = fromRight || fromBottom || open;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (!open) {
      // open: swipe left from right edge, or swipe up from bottom
      if (startX > window.innerWidth - 28 && dx < -48) setOpen(true);
      else if (startY > window.innerHeight - 36 && dy < -56) setOpen(true);
    } else {
      // close: swipe right on panel area
      if (dx > 64 && Math.abs(dx) > Math.abs(dy)) setOpen(false);
    }
  }, { passive: true });

  // Status fades like LOOI captions
  let fadeTimer;
  const obs = new MutationObserver(() => {
    if (!statusEl) return;
    statusEl.classList.remove('fade');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => statusEl.classList.add('fade'), 4500);
  });
  if (statusEl) {
    obs.observe(statusEl, { childList: true, characterData: true, subtree: true });
    fadeTimer = setTimeout(() => statusEl.classList.add('fade'), 5000);
  }

  // expose for other scripts
  window.CamPetUI = { open: () => setOpen(true), close: () => setOpen(false), toggle };
})();
