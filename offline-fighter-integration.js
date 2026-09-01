/* offline-fighter-integration.js
 * Glue code that connects this site to the embedded Offline Fighter game
 * (files at repo root: characters.js, stages.js, audio.js, controls.js, effects.js, ai.js, combat.js, ui.js, game.js). This file is the ONLY thing that knows about
 * both the host page and the game — the game itself stays fully isolated
 * (see the game CSS merged into style.css, and game.js), and this file never
 * touches the game's internals beyond its documented public API:
 *   window.launchOfflineGame()
 *   window.closeOfflineGame()
 *
 * Responsibilities:
 *  1. Detect when the visitor goes offline / comes back online.
 *  2. Show/hide the "OFFLINE MODE" screen (#offline-mode-screen).
 *  3. Wire START GAME -> launchOfflineGame().
 *  4. Wire DOWNLOAD GAME -> platform-aware download logic that refuses to
 *     pretend to download anything while offline.
 *
 * Configure the two release URLs below once they exist (see README /
 * final report for instructions) — everything else works immediately.
 */
(function () {
  "use strict";

  // ---- 1. Configure your GitHub Release download URLs here ----
  // Replace these two placeholder strings with the real asset URLs from
  // your GitHub Release once you've published them. Until then, clicking
  // DOWNLOAD GAME while online will show a friendly "not published yet"
  // message instead of a broken link.
  var GAME_DOWNLOAD_URLS = {
    windows: "YOUR_WINDOWS_DOWNLOAD_URL",
    android: "YOUR_ANDROID_DOWNLOAD_URL"
  };

  var screen = document.getElementById("offline-mode-screen");
  if (!screen) return; // markup not present on this page — nothing to do

  var startBtn = document.getElementById("ofm-btn-start");
  var downloadBtn = document.getElementById("ofm-btn-download");
  var downloadLabel = document.getElementById("ofm-download-label");
  var note = document.getElementById("ofm-note");

  var isAndroid = /Android/i.test(navigator.userAgent);

  // ---- Platform-aware button label ----
  // (Task spec: Windows/desktop -> "DOWNLOAD WINDOWS GAME",
  //  Android -> "DOWNLOAD ANDROID GAME".)
  if (downloadLabel) {
    downloadLabel.textContent = isAndroid ? "DOWNLOAD ANDROID GAME" : "DOWNLOAD WINDOWS GAME";
  }

  function setNote(text, isError) {
    if (!note) return;
    note.textContent = text || "";
    note.classList.toggle("is-error", !!isError);
  }

  // ---- 2. Offline-screen visibility ----
  // We only show our own "OFFLINE MODE" pre-game menu when the fighting
  // game itself is NOT already open. If the visitor is mid-fight and
  // connectivity flips back on, we deliberately do nothing here — the
  // game keeps running (it shows its own small "INTERNET RESTORED"
  // badge) and the visitor exits on their own via CLOSE GAME / RESUME.
  function gameIsOpen() {
    var app = document.getElementById("offline-fighter-app");
    return !!(app && app.classList.contains("ofg-visible"));
  }

  function updateOfflineScreen() {
    var offline = !navigator.onLine || FORCE_OFFLINE_FOR_TESTING;
    if (offline && !gameIsOpen()) {
      screen.classList.add("is-visible");
      setNote("");
    } else if (!offline) {
      screen.classList.remove("is-visible");
      setNote("");
    }
    // If offline is true but the game is open: leave everything as-is
    // (see comment above) — don't hide or show the offline screen.
  }

  // Optional manual test hook: append ?forceOffline=1 to the page URL to
  // preview the OFFLINE MODE screen without actually disconnecting.
  // Safe to leave in production — it does nothing unless that exact
  // query parameter is present.
  var FORCE_OFFLINE_FOR_TESTING = /[?&]forceOffline=1\b/.test(window.location.search);

  window.addEventListener("online", updateOfflineScreen);
  window.addEventListener("offline", updateOfflineScreen);
  document.addEventListener("DOMContentLoaded", updateOfflineScreen);
  // In case this script runs after DOMContentLoaded already fired
  // (e.g. it's placed at the very end of <body>, which is the normal case).
  updateOfflineScreen();

  // ---- 3b. GAME module "PLAY GAME" button (AASHIR OS -> Game panel) ----
  // Separate from the offline-mode-screen's START GAME button above: this
  // one is always visible (not just when offline) so online visitors have
  // a normal, discoverable way to launch the game too.
  var playGameBtn = document.getElementById("os-btn-play-game");
  if (playGameBtn) {
    playGameBtn.addEventListener("click", function () {
      if (typeof window.launchOfflineGame === "function") {
        window.launchOfflineGame();
      } else {
        setNote("The game couldn't load. Please reconnect once and reload this page so it can be cached for offline use.", true);
      }
    });
  }

  // ---- 3. START GAME ----
  if (startBtn) {
    startBtn.addEventListener("click", function () {
      screen.classList.remove("is-visible");
      if (typeof window.launchOfflineGame === "function") {
        window.launchOfflineGame();
      } else {
        // The game scripts failed to load (very unlikely once cached,
        // but possible on a first-ever visit with no connection at all).
        setNote("The game couldn't load. Please reconnect once and reload this page so it can be cached for offline use.", true);
        screen.classList.add("is-visible");
      }
    });
  }

  // ---- 4. DOWNLOAD GAME ----
  function showOfflineDownloadMenu() {
    if (!navigator.onLine) {
      setNote("Internet connection is required to download the standalone game.", true);
      return;
    }
    var url = isAndroid ? GAME_DOWNLOAD_URLS.android : GAME_DOWNLOAD_URLS.windows;
    if (!url || /^YOUR_/.test(url)) {
      setNote("The downloadable build hasn't been published yet — check back soon.", true);
      return;
    }
    setNote("");
    window.location.href = url;
  }
  window.showOfflineDownloadMenu = showOfflineDownloadMenu; // exposed per task spec

  if (downloadBtn) {
    downloadBtn.addEventListener("click", showOfflineDownloadMenu);
  }

  // ---- Also close the offline screen if the visitor opens the game some
  // other way in the future (defensive; harmless no-op today since START
  // GAME is currently the only entry point). ----
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("#ofg-btn-close")) {
      // Game was just closed from inside itself — re-run the check in case
      // we're still offline, so the OFFLINE MODE screen reappears instead
      // of leaving the visitor looking at a dead page.
      setTimeout(updateOfflineScreen, 0);
    }
  });
})();
