/* controls.js
 * Unified input layer. Desktop uses keyboard; touch devices get an
 * on-screen control pad. Both feed the same `pressed` action state that
 * combat.js reads, so the rest of the game doesn't care where an input
 * came from.
 */

const DEFAULT_KEYS_P1 = {
  left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS",
  punch: "KeyJ", kick: "KeyK", block: "KeyL", special: "KeyU",
  ultimate: "KeyI", dash: "Space", pause: "Escape",
};

const DEFAULT_KEYS_P2 = {
  left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown",
  punch: "Numpad1", kick: "Numpad2", block: "Numpad3", special: "Numpad4",
  ultimate: "Numpad5", dash: "Numpad0", pause: "Escape",
};

class InputState {
  constructor() {
    this.actions = {}; // actionName -> boolean held
    this.justPressed = {}; // actionName -> boolean this frame only
    this._prevHeld = {};
  }
  isHeld(a) { return !!this.actions[a]; }
  wasPressed(a) { return !!this.justPressed[a]; }
  beginFrame() {
    this.justPressed = {};
    for (const a in this.actions) {
      if (this.actions[a] && !this._prevHeld[a]) this.justPressed[a] = true;
    }
  }
  endFrame() {
    this._prevHeld = { ...this.actions };
  }
  set(action, val) { this.actions[action] = val; }
}

class ControlManager {
  constructor() {
    this.p1 = new InputState();
    this.p2 = new InputState();
    this.keyMapP1 = { ...DEFAULT_KEYS_P1 };
    this.keyMapP2 = { ...DEFAULT_KEYS_P2 };
    this.twoPlayer = false;
    this.onPause = null;
    this._keyDown = this._keyDown.bind(this);
    this._keyUp = this._keyUp.bind(this);
    this.isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }

  attachKeyboard() {
    window.addEventListener("keydown", this._keyDown);
    window.addEventListener("keyup", this._keyUp);
  }
  detachKeyboard() {
    window.removeEventListener("keydown", this._keyDown);
    window.removeEventListener("keyup", this._keyUp);
  }

  _resolve(code, map) {
    for (const action in map) if (map[action] === code) return action;
    return null;
  }

  _keyDown(e) {
    if ([...Object.values(this.keyMapP1), ...Object.values(this.keyMapP2)].includes(e.code)) e.preventDefault();
    const a1 = this._resolve(e.code, this.keyMapP1);
    if (a1) {
      if (a1 === "pause") { this.onPause && this.onPause(); return; }
      this.p1.set(a1, true);
    }
    if (this.twoPlayer) {
      const a2 = this._resolve(e.code, this.keyMapP2);
      if (a2 && a2 !== "pause") this.p2.set(a2, true);
    }
  }
  _keyUp(e) {
    const a1 = this._resolve(e.code, this.keyMapP1);
    if (a1) this.p1.set(a1, false);
    if (this.twoPlayer) {
      const a2 = this._resolve(e.code, this.keyMapP2);
      if (a2) this.p2.set(a2, false);
    }
  }

  beginFrame() { this.p1.beginFrame(); this.p2.beginFrame(); }
  endFrame() { this.p1.endFrame(); this.p2.endFrame(); }

  // ---- Touch pad ----
  buildTouchPad(container) {
    container.innerHTML = "";
    container.classList.add("ofg-touchpad");
    const dpad = document.createElement("div");
    dpad.className = "ofg-dpad";
    dpad.innerHTML = `
      <button class="ofg-btn ofg-dpad-btn" data-action="left">◀</button>
      <button class="ofg-btn ofg-dpad-btn" data-action="right">▶</button>
      <button class="ofg-btn ofg-dpad-btn" data-action="up">⬆</button>
      <button class="ofg-btn ofg-dpad-btn" data-action="down">⬇</button>
    `;
    const actionPad = document.createElement("div");
    actionPad.className = "ofg-actionpad";
    actionPad.innerHTML = `
      <button class="ofg-btn ofg-action-btn punch" data-action="punch">👊</button>
      <button class="ofg-btn ofg-action-btn kick" data-action="kick">🦶</button>
      <button class="ofg-btn ofg-action-btn block" data-action="block">🛡</button>
      <button class="ofg-btn ofg-action-btn special" data-action="special">⚡</button>
      <button class="ofg-btn ofg-action-btn ultimate" data-action="ultimate">🔥</button>
      <button class="ofg-btn ofg-action-btn dash" data-action="dash">➤➤</button>
    `;
    container.appendChild(dpad);
    container.appendChild(actionPad);

    const bind = (btn) => {
      const action = btn.dataset.action;
      const start = (e) => { e.preventDefault(); btn.classList.add("active"); this.p1.set(action, true); };
      const end = (e) => { e.preventDefault(); btn.classList.remove("active"); this.p1.set(action, false); };
      btn.addEventListener("touchstart", start, { passive: false });
      btn.addEventListener("touchend", end, { passive: false });
      btn.addEventListener("touchcancel", end, { passive: false });
      // mouse fallback for testing on desktop
      btn.addEventListener("mousedown", start);
      btn.addEventListener("mouseup", end);
      btn.addEventListener("mouseleave", end);
    };
    container.querySelectorAll(".ofg-btn").forEach(bind);

    // block accidental page scroll while touching the pad
    container.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  }
}
