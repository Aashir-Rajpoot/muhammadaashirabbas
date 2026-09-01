/* game.js
 * Top-level game state machine and main loop. Wires together characters,
 * combat, ai, controls, audio, effects and ui. Also exposes the small
 * integration API (launchOfflineGame / closeOfflineGame) that a host
 * website calls to show/hide the game without touching its own markup.
 */

(function () {
  const ROOT_ID = "offline-fighter-app";
  const ROUND_TIME = 60;
  const ROUNDS_TO_WIN = 2;

  class Game {
    constructor(root) {
      this.root = root;
      this.canvas = root.querySelector("#ofg-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.controls = new ControlManager();
      this.particles = new ParticleSystem();
      this.audio = AUDIO;
      this.ui = new UIManager(root.querySelector("#ofg-combo-text"), root.querySelector("#ofg-banner"));

      this.screen = "main"; // main, select, stageSelect, fight, pause, victory, defeat, controlsInfo
      this.mode = "vsCpu"; // vsCpu, arcade, training, localVs
      this.difficulty = "Normal";
      this.selectedP1 = null;
      this.selectedP2 = null;
      this.stageId = "neonCity";

      this.arcadeQueue = [];
      this.arcadeIndex = 0;

      this.round = 1;
      this.p1RoundsWon = 0;
      this.p2RoundsWon = 0;
      this.timeLeft = ROUND_TIME;
      this.roundActive = false;
      this.slowMo = 0;

      this.lastTime = 0;
      this.running = false;

      this._bindMenus();
      this._buildCharacterSelect();
      this._buildStageSelect();
      this._setupResponsiveCanvas();
      this._setupConnectionWatch();
      this.controls.onPause = () => this.togglePause();
    }

    /* ---------------- Menu wiring ---------------- */
    _bindMenus() {
      const $ = (sel) => this.root.querySelector(sel);

      $("#ofg-btn-play").addEventListener("click", () => { this.mode = "vsCpu"; this.showScreen("select"); });
      $("#ofg-btn-arcade").addEventListener("click", () => { this.mode = "arcade"; this.showScreen("select"); });
      $("#ofg-btn-training").addEventListener("click", () => { this.mode = "training"; this.showScreen("select"); });
      $("#ofg-btn-localvs").addEventListener("click", () => { this.mode = "localVs"; this.controls.twoPlayer = true; this.showScreen("select"); });
      $("#ofg-btn-controls").addEventListener("click", () => this.showScreen("controlsInfo"));
      $("#ofg-btn-settings").addEventListener("click", () => this.showScreen("settings"));
      $("#ofg-btn-close").addEventListener("click", () => closeOfflineGame());

      $("#ofg-controlsinfo-back").addEventListener("click", () => this.showScreen("main"));
      $("#ofg-settings-back").addEventListener("click", () => this.showScreen("main"));

      root_onchange: {
        const muteBox = $("#ofg-mute");
        muteBox.addEventListener("change", () => this.audio.setMuted(muteBox.checked));
        const volSlider = $("#ofg-volume");
        volSlider.addEventListener("input", () => this.audio.setVolume(volSlider.value / 100));
      }

      $("#ofg-diff-select").addEventListener("change", (e) => { this.difficulty = e.target.value; });

      $("#ofg-select-back").addEventListener("click", () => this.showScreen("main"));
      $("#ofg-select-confirm").addEventListener("click", () => {
        if (!this.selectedP1) return;
        if (this.mode === "localVs" && !this.selectedP2) return;
        this.showScreen("stageSelect");
      });

      $("#ofg-stage-back").addEventListener("click", () => this.showScreen("select"));
      $("#ofg-stage-confirm").addEventListener("click", () => this.beginMatchFlow());

      // pause menu
      $("#ofg-pause-resume").addEventListener("click", () => this.togglePause());
      $("#ofg-pause-restart").addEventListener("click", () => { this.togglePause(); this.startRound(true); });
      $("#ofg-pause-controls").addEventListener("click", () => this.showScreen("controlsInfo"));
      $("#ofg-pause-menu").addEventListener("click", () => this.returnToMainMenu());
      $("#ofg-mobile-pause").addEventListener("click", () => this.togglePause());

      // victory / defeat
      $("#ofg-result-rematch").addEventListener("click", () => this.beginMatchFlow(true));
      $("#ofg-result-select").addEventListener("click", () => this.showScreen("select"));
      $("#ofg-result-menu").addEventListener("click", () => this.returnToMainMenu());
    }

    showScreen(name) {
      this.screen = name;
      this.root.querySelectorAll(".ofg-screen").forEach((el) => el.classList.remove("active"));
      const map = {
        main: "#ofg-screen-main", select: "#ofg-screen-select", stageSelect: "#ofg-screen-stage",
        fight: "#ofg-screen-fight", pause: "#ofg-screen-pause", victory: "#ofg-screen-result",
        defeat: "#ofg-screen-result", controlsInfo: "#ofg-screen-controls", settings: "#ofg-screen-settings",
      };
      const el = this.root.querySelector(map[name]);
      if (el) el.classList.add("active");
      this.audio.menu();

      if (name === "fight" || name === "pause") {
        // the canvas wrapper only has real dimensions once its screen is
        // shown, so (re)compute the canvas' on-screen size now
        requestAnimationFrame(() => this._resizeCanvas());
      }

      const mobilePad = this.root.querySelector("#ofg-touchpad-wrap");
      const mobilePause = this.root.querySelector("#ofg-mobile-pause");
      const showFightUI = name === "fight";
      mobilePad.style.display = showFightUI && this.controls.isTouch ? "flex" : "none";
      mobilePause.style.display = showFightUI ? "block" : "none";
    }

    /* ---------------- Character / stage select ---------------- */
    _buildCharacterSelect() {
      const grid = this.root.querySelector("#ofg-char-grid");
      grid.innerHTML = "";
      CHARACTER_ORDER.forEach((id) => {
        const c = getCharacter(id);
        const card = document.createElement("button");
        card.className = "ofg-char-card";
        card.dataset.id = id;
        card.innerHTML = `
          <div class="ofg-char-swatch" style="background:linear-gradient(160deg, ${c.palette.primary}, ${c.palette.secondary})"></div>
          <div class="ofg-char-name">${c.name}</div>
          <div class="ofg-char-title">${c.title}</div>
        `;
        card.addEventListener("click", () => this._selectCharacter(id, card));
        grid.appendChild(card);
      });
      this._renderCharDetail(null);
    }

    _selectCharacter(id, cardEl) {
      const grid = this.root.querySelector("#ofg-char-grid");
      // decide whether this click is choosing P1 or P2 (local vs mode picks in sequence)
      if (this.mode === "localVs" && this.selectedP1 && !this.selectedP2 && id !== this.selectedP1) {
        this.selectedP2 = id;
      } else {
        this.selectedP1 = id;
        this.selectedP2 = this.mode === "localVs" ? this.selectedP2 : null;
      }
      grid.querySelectorAll(".ofg-char-card").forEach((el) => el.classList.remove("p1", "p2"));
      grid.querySelectorAll(".ofg-char-card").forEach((el) => {
        if (el.dataset.id === this.selectedP1) el.classList.add("p1");
        if (el.dataset.id === this.selectedP2) el.classList.add("p2");
      });
      this._renderCharDetail(getCharacter(this.selectedP1));
      this.audio.confirm();
      const confirmBtn = this.root.querySelector("#ofg-select-confirm");
      confirmBtn.disabled = this.mode === "localVs" ? !(this.selectedP1 && this.selectedP2) : !this.selectedP1;
    }

    _renderCharDetail(c) {
      const el = this.root.querySelector("#ofg-char-detail");
      if (!c) { el.innerHTML = `<p class="ofg-hint">Select a fighter to see their stats.</p>`; return; }
      const statRow = (label, val) => `
        <div class="ofg-stat-row"><span>${label}</span>
          <div class="ofg-stat-bar"><div style="width:${val}%; background:${c.palette.primary}"></div></div>
        </div>`;
      el.innerHTML = `
        <h3 style="color:${c.palette.primary}">${c.name} <small>"${c.title}"</small></h3>
        <p class="ofg-char-style">${c.style} — Difficulty: ${c.difficulty}</p>
        <p class="ofg-char-bio">${c.backstory}</p>
        ${statRow("Health", Math.round((c.stats.health / 130) * 100))}
        ${statRow("Power", c.stats.power)}
        ${statRow("Defense", c.stats.defense)}
        ${statRow("Speed", c.stats.speed)}
        ${statRow("Combo", c.stats.combo)}
        ${statRow("Special", c.stats.special)}
      `;
    }

    _buildStageSelect() {
      const grid = this.root.querySelector("#ofg-stage-grid");
      grid.innerHTML = "";
      STAGE_ORDER.forEach((id) => {
        const s = STAGES[id];
        const card = document.createElement("button");
        card.className = "ofg-stage-card";
        card.dataset.id = id;
        card.innerHTML = `<div class="ofg-stage-swatch" style="background:linear-gradient(160deg, ${s.sky[0]}, ${s.sky[2]})"></div>
          <div class="ofg-stage-name">${s.name}</div><div class="ofg-stage-desc">${s.desc}</div>`;
        card.addEventListener("click", () => {
          this.stageId = id;
          grid.querySelectorAll(".ofg-stage-card").forEach((el) => el.classList.remove("selected"));
          card.classList.add("selected");
          this.audio.confirm();
        });
        grid.appendChild(card);
      });
      grid.querySelector(`[data-id="${this.stageId}"]`)?.classList.add("selected");
    }

    /* ---------------- Match flow ---------------- */
    beginMatchFlow(rematch = false) {
      if (this.mode === "arcade" && !rematch) {
        this.arcadeQueue = CHARACTER_ORDER.filter((id) => id !== this.selectedP1).sort(() => Math.random() - 0.5).slice(0, 4);
        this.arcadeIndex = 0;
        this.selectedP2 = this.arcadeQueue[0];
      } else if (this.mode !== "localVs" && !this.selectedP2) {
        const pool = CHARACTER_ORDER.filter((id) => id !== this.selectedP1);
        this.selectedP2 = pool[Math.floor(Math.random() * pool.length)];
      }
      this.p1RoundsWon = 0;
      this.p2RoundsWon = 0;
      this.round = 1;
      this.showScreen("fight");
      this.startRound(true);
    }

    startRound(freshMatch) {
      this.timeLeft = ROUND_TIME;
      this.roundActive = true;
      this.slowMo = 0;
      const isTraining = this.mode === "training";

      this.p1 = new Fighter(this.selectedP1, 260, 1, false, this.difficulty);
      this.p2 = new Fighter(this.selectedP2, 740, -1, this.mode !== "localVs", this.difficulty);
      if (isTraining) { this.p1.maxHealth = this.p1.health = 99999; }
      this.p2AI = this.mode !== "localVs" ? new AIController(this.difficulty) : null;

      this.ui.showBanner(`ROUND ${this.round}`, 1300);
      setTimeout(() => this.ui.showBanner("FIGHT!", 700), 1300);

      this.controls.attachKeyboard();
      if (!this._touchBuilt && this.controls.isTouch) {
        this.controls.buildTouchPad(this.root.querySelector("#ofg-touchpad-wrap"));
        this._touchBuilt = true;
      }
    }

    endRound(winner) {
      this.roundActive = false;
      this.audio.ko();
      this.ui.showBanner("K.O.", 1000);
      if (winner === "p1") this.p1RoundsWon++;
      else if (winner === "p2") this.p2RoundsWon++;

      setTimeout(() => {
        if (this.p1RoundsWon >= ROUNDS_TO_WIN || this.p2RoundsWon >= ROUNDS_TO_WIN) {
          this.endMatch(this.p1RoundsWon > this.p2RoundsWon ? "p1" : "p2");
        } else {
          this.round++;
          this.startRound(false);
        }
      }, 1600);
    }

    endMatch(winner) {
      if (this.mode === "arcade" && winner === "p1") {
        this.arcadeIndex++;
        if (this.arcadeIndex < this.arcadeQueue.length) {
          this.ui.showBanner("CHALLENGER APPROACHES", 1400);
          this.selectedP2 = this.arcadeQueue[this.arcadeIndex];
          setTimeout(() => { this.p1RoundsWon = 0; this.p2RoundsWon = 0; this.round = 1; this.startRound(true); }, 1600);
          return;
        }
      }
      const won = winner === "p1";
      this.showResultScreen(won);
    }

    showResultScreen(playerWon) {
      this.showScreen(playerWon ? "victory" : "defeat");
      this.audio[playerWon ? "victory" : "defeat"]();
      const el = this.root.querySelector("#ofg-screen-result");
      el.classList.toggle("win", playerWon);
      el.classList.toggle("lose", !playerWon);
      const c = getCharacter(this.selectedP1);
      this.root.querySelector("#ofg-result-title").textContent = playerWon ? "VICTORY" : "DEFEAT";
      this.root.querySelector("#ofg-result-sub").textContent = playerWon
        ? `${c.name} WINS! "${c.victoryQuote}"`
        : `"${c.defeatQuote}"`;
      this.root.querySelector("#ofg-result-stats").innerHTML = `
        <div>Rounds Won: ${this.p1RoundsWon}</div>
        <div>Damage Dealt: ${Math.round(this.p1.stats.damageDealt)}</div>
        <div>Highest Combo: ${this.p1.stats.highestCombo}</div>
        <div>Specials Used: ${this.p1.stats.specialsUsed}</div>
      `;
    }

    togglePause() {
      if (this.screen === "fight") { this.wasFight = true; this.showScreen("pause"); }
      else if (this.screen === "pause") { this.showScreen("fight"); }
    }

    returnToMainMenu() {
      this.controls.twoPlayer = false;
      this.selectedP1 = null;
      this.selectedP2 = null;
      this.showScreen("main");
    }

    /* ---------------- Main loop ---------------- */
    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop.bind(this));
    }
    stop() { this.running = false; }

    _loop(now) {
      if (!this.running) return;
      let dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (this.slowMo > 0) { dt *= 0.25; this.slowMo -= dt; }

      this.controls.beginFrame();
      if (this.p2AI) this.p2AI.input.beginFrame();

      if (this.screen === "fight" && this.roundActive) this._updateFight(dt);
      this._render();

      this.controls.endFrame();
      if (this.p2AI) this.p2AI.finalizeFrame();

      requestAnimationFrame(this._loop.bind(this));
    }

    _updateFight(dt) {
      const p1 = this.p1, p2 = this.p2;
      p1.faceOpponent(p2);
      p2.faceOpponent(p1);

      p1.tryMove(this.controls.p1, p2, dt, this);
      if (this.p2AI) {
        this.p2AI.update(dt, p2, p1);
        p2.tryMove(this.p2AI.input, p1, dt, this);
      } else {
        p2.tryMove(this.controls.p2, p1, dt, this);
      }

      p1.applyPhysics(dt);
      p2.applyPhysics(dt);
      enforceSeparation(p1, p2);
      resolveAttacks(p1, p2, this);
      this.particles.update(dt);

      if (this.mode !== "training") {
        this.timeLeft -= dt;
        if (p1.health <= 0 || p2.health <= 0) {
          this.endRound(p1.health <= 0 && p2.health <= 0 ? "draw" : p1.health <= 0 ? "p2" : "p1");
        } else if (this.timeLeft <= 0) {
          this.endRound(p1.health === p2.health ? "draw" : p1.health > p2.health ? "p1" : "p2");
        }
      }
    }

    _render() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (this.screen !== "fight" && this.screen !== "pause") return;

      const shake = this.particles.getShakeOffset();
      ctx.save();
      ctx.translate(shake.x, shake.y);

      const stage = STAGES[this.stageId];
      stage.draw(ctx, w, h, performance.now());

      if (this.p1 && this.p2) {
        // draw further-back fighter first for a touch of depth
        const order = this.p1.y <= this.p2.y ? [this.p2, this.p1] : [this.p1, this.p2];
        order.forEach((f) => drawFighter(ctx, f, performance.now()));
        this.particles.draw(ctx);
        this.ui.drawHUD(ctx, w, h, this.p1, this.p2, this.round, this.timeLeft);
      }
      ctx.restore();
    }

    /* ---------------- Responsive canvas ---------------- */
    _setupResponsiveCanvas() {
      this._resizeCanvas = () => {
        const wrap = this.root.querySelector("#ofg-canvas-wrap");
        const rect = wrap.getBoundingClientRect();
        if (!rect.width || !rect.height) return; // wrap is hidden (screen not active) — nothing to size against yet
        const scale = Math.min(rect.width / ARENA.width, rect.height / ARENA.height);
        this.canvas.style.width = Math.round(ARENA.width * scale) + "px";
        this.canvas.style.height = Math.round(ARENA.height * scale) + "px";
      };
      this.canvas.width = ARENA.width;
      this.canvas.height = ARENA.height;
      window.addEventListener("resize", this._resizeCanvas);
      this._resizeCanvas();
    }

    _setupConnectionWatch() {
      const badge = this.root.querySelector("#ofg-net-badge");
      const update = () => {
        const online = navigator.onLine;
        badge.textContent = online ? "INTERNET RESTORED" : "YOU ARE OFFLINE";
        badge.classList.toggle("online", online);
        badge.classList.add("show");
        clearTimeout(this._netBadgeTimeout);
        this._netBadgeTimeout = setTimeout(() => badge.classList.remove("show"), 2500);
      };
      window.addEventListener("offline", update);
      window.addEventListener("online", update);
    }
  }

  /* ---------------- Public integration API ---------------- */
  let gameInstance = null;

  window.launchOfflineGame = function launchOfflineGame() {
    const root = document.getElementById(ROOT_ID);
    if (!root) { console.error("offline-fighter-app root element not found in the page."); return; }
    root.classList.add("ofg-visible");
    document.body.classList.add("ofg-no-scroll");
    if (!gameInstance) gameInstance = new Game(root);
    gameInstance.showScreen("main");
    gameInstance.start();
  };

  window.closeOfflineGame = function closeOfflineGame() {
    const root = document.getElementById(ROOT_ID);
    if (root) root.classList.remove("ofg-visible");
    document.body.classList.remove("ofg-no-scroll");
    if (gameInstance) {
      gameInstance.stop();
      // HOST-INTEGRATION FIX: attachKeyboard() is called every time a round
      // starts (see startRound()), but nothing ever detached it again. Left
      // unfixed, once a single round of the fight had been played, the
      // page-wide keydown/keyup listener stayed attached forever — even
      // after the game was closed — silently eating A/D/W/S/J/K/L/U/I/Space/
      // Arrow/Escape keystrokes anywhere on the host site (for example,
      // typing in a text input on the host page). Detaching here restores
      // normal keyboard behavior on the host page as soon as the game closes.
      gameInstance.controls.detachKeyboard();
    }
  };

  // Auto-registration of the service worker for offline caching (no-op if unsupported).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {
        /* offline-first game still works without SW caching, just without repeat-visit pre-cache */
      });
    });
  }

  // If this file is opened as a standalone page (not embedded in a host site),
  // launch automatically so the game is directly playable/testable.
  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.standalone === "true") {
      window.launchOfflineGame();
    }
  });
})();
