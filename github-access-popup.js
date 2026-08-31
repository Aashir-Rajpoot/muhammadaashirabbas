/* =========================================================================
   GITHUB DEMO ACCESS POPUP
   Frontend-only UI demonstration. No backend, database, or auth service
   is used or contacted. The "payment information" shown is placeholder
   demo data only — no real payment is processed, requested, or verified.
   ========================================================================= */
(function () {
  'use strict';

  var DEMO_CODE = 'Aashirrajpoot121';

  document.addEventListener('DOMContentLoaded', function () {
    var trigger = document.getElementById('github-demo-card');
    var overlay = document.getElementById('gdemoOverlay');
    var modal = document.getElementById('gdemoModal');
    var closeBtn = document.getElementById('gdemoClose');
    var submitBtn = document.getElementById('gdemoSubmit');
    var input = document.getElementById('gdemoCodeInput');
    var message = document.getElementById('gdemoMessage');

    if (!trigger || !overlay || !modal || !closeBtn || !submitBtn || !input || !message) {
      return; // Popup markup not present — fail silently, don't break the site.
    }

    var githubUrl = trigger.getAttribute('href');
    var lastFocused = null;

    function showMessage(text, type) {
      message.textContent = text;
      message.classList.remove('is-success', 'is-error');
      if (type) message.classList.add(type);
      message.classList.add('is-visible');
    }

    function clearMessage() {
      message.textContent = '';
      message.classList.remove('is-visible', 'is-success', 'is-error');
    }

    function openPopup(e) {
      if (e) e.preventDefault();
      lastFocused = document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      window.setTimeout(function () { input.focus(); }, 250);
      document.addEventListener('keydown', onKeydown);
    }

    function closePopup() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      input.value = '';
      clearMessage();
      document.removeEventListener('keydown', onKeydown);
      if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
      }
    }

    function onKeydown(e) {
      if (e.key === 'Escape') closePopup();
    }

    function checkCode() {
      var value = input.value.trim();
      if (!value) {
        showMessage('Please enter an access code.', 'is-error');
        return;
      }
      if (value === DEMO_CODE) {
        showMessage('Access granted. Opening GitHub...', 'is-success');
        window.setTimeout(function () {
          window.open(githubUrl, '_blank', 'noopener,noreferrer');
        }, 500);
      } else {
        showMessage('Invalid access code. Please check your code.', 'is-error');
      }
    }

    trigger.addEventListener('click', openPopup);
    closeBtn.addEventListener('click', closePopup);

    // Click outside the modal closes the popup.
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay) closePopup();
    });

    submitBtn.addEventListener('click', checkCode);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') checkCode();
    });
    input.addEventListener('input', clearMessage);
  });
})();
