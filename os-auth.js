/* =========================================================================
   AASHIR OS — Authentication
   Demo/admin login gate for the desktop environment. Session flag lives in
   sessionStorage only (cleared on logout or when the tab is closed).
   Credentials are checked client-side for demo purposes only — this is a
   portfolio simulation, not a real security boundary.
   ========================================================================= */
(function (global) {
  'use strict';

  var SESSION_KEY = 'aashiros_session';
  var DEMO_USER = 'admin';
  var DEMO_PASS = 'admin';

  function isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function setAuthenticated() {
    sessionStorage.setItem(SESSION_KEY, '1');
  }

  function clearAuthenticated() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function showLogin() {
    document.getElementById('os2-login-screen').setAttribute('data-visible', 'true');
    document.getElementById('os2-desktop').setAttribute('data-visible', 'false');
    var userInput = document.getElementById('os2-login-user');
    if (userInput) setTimeout(function () { userInput.focus(); }, 50);
  }

  function bootIntoDesktop() {
    document.getElementById('os2-login-screen').setAttribute('data-visible', 'false');
    var boot = document.getElementById('os2-boot');
    var desktop = document.getElementById('os2-desktop');
    desktop.setAttribute('data-visible', 'true');
    boot.hidden = false;
    boot.classList.remove('os2-boot-hide');

    var fill = document.getElementById('os2-boot-fill');
    var status = document.getElementById('os2-boot-status');
    var messages = ['INITIALIZING…', 'MOUNTING VIRTUAL FILESYSTEM…', 'LOADING DESKTOP SHELL…', 'READY.'];
    var step = 0;
    fill.style.width = '0%';
    var timer = setInterval(function () {
      step++;
      fill.style.width = Math.min(100, step * 25) + '%';
      if (status && messages[step]) status.textContent = messages[step];
      if (step >= 4) {
        clearInterval(timer);
        setTimeout(function () {
          boot.classList.add('os2-boot-hide');
          setTimeout(function () { boot.hidden = true; }, 500);
          if (!global.AashirDesktop.__inited) {
            global.AashirDesktop.init();
            global.AashirDesktop.__inited = true;
          }
        }, 300);
      }
    }, 260);
  }

  function attemptLogin(username, password) {
    var errorEl = document.getElementById('os2-login-error');
    if (username === DEMO_USER && password === DEMO_PASS) {
      if (errorEl) errorEl.hidden = true;
      setAuthenticated();
      bootIntoDesktop();
      return true;
    }
    if (errorEl) {
      errorEl.textContent = 'Invalid username or password.';
      errorEl.hidden = false;
    }
    var modal = document.getElementById('os2-login-modal');
    if (modal) {
      modal.classList.remove('shake');
      void modal.offsetWidth;
      modal.classList.add('shake');
    }
    return false;
  }

  function logout() {
    if (global.AashirWM) global.AashirWM.closeAll();
    clearAuthenticated();
    showLogin();
    var passInput = document.getElementById('os2-login-pass');
    if (passInput) passInput.value = '';
  }

  function wireLoginForm() {
    var form = document.getElementById('os2-login-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = document.getElementById('os2-login-user').value.trim();
      var pass = document.getElementById('os2-login-pass').value;
      attemptLogin(user, pass);
    });
  }

  function init() {
    wireLoginForm();
    if (isAuthenticated()) {
      document.getElementById('os2-login-screen').setAttribute('data-visible', 'false');
      document.getElementById('os2-boot').hidden = true;
      document.getElementById('os2-desktop').setAttribute('data-visible', 'true');
      global.AashirDesktop.init();
      global.AashirDesktop.__inited = true;
    } else {
      showLogin();
    }
  }

  global.AashirAuth = { init: init, logout: logout, isAuthenticated: isAuthenticated };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
