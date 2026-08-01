/**
 * Auto-hiding behavior for the view switcher pill: fades out after 4s of
 * pointer inactivity so it stays unobtrusive on shared screens, reappears on
 * any pointer movement or touch.
 */
(function () {
  'use strict';

  var switcher = document.getElementById('viewSwitcher');
  if (!switcher) return;

  var FADE_DELAY_MS = 4000;
  var fadeTimer = null;

  function show() {
    switcher.classList.remove('switcher-faded');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(function () {
      switcher.classList.add('switcher-faded');
    }, FADE_DELAY_MS);
  }

  document.addEventListener('pointermove', show, { passive: true });
  document.addEventListener('touchstart', show, { passive: true });
  document.addEventListener('keydown', show);

  // Keep it visible while the user is hovering it
  switcher.addEventListener('pointerenter', function () {
    clearTimeout(fadeTimer);
    switcher.classList.remove('switcher-faded');
  });
  switcher.addEventListener('pointerleave', show);

  show();
})();
