/* ai.js
 * CPU opponent brain. Implements the same isHeld/wasPressed interface as
 * InputState (see controls.js) so combat.js can treat a human and a CPU
 * fighter identically — the AI just drives its own virtual input state.
 */

const AI_PROFILES = {
  Easy: { reaction: 0.45, aggression: 0.3, blockChance: 0.15, specialChance: 0.15, mistake: 0.35, comboUse: 0.1, ultimateUse: 0.3 },
  Normal: { reaction: 0.28, aggression: 0.5, blockChance: 0.35, specialChance: 0.3, mistake: 0.18, comboUse: 0.35, ultimateUse: 0.55 },
  Hard: { reaction: 0.16, aggression: 0.7, blockChance: 0.55, specialChance: 0.45, mistake: 0.08, comboUse: 0.6, ultimateUse: 0.75 },
  Expert: { reaction: 0.08, aggression: 0.85, blockChance: 0.72, specialChance: 0.6, mistake: 0.02, comboUse: 0.85, ultimateUse: 0.9 },
};

class AIInputState {
  constructor() { this.actions = {}; this.justPressed = {}; this._prevHeld = {}; }
  isHeld(a) { return !!this.actions[a]; }
  wasPressed(a) { return !!this.justPressed[a]; }
  beginFrame() {
    this.justPressed = {};
    for (const a in this.actions) if (this.actions[a] && !this._prevHeld[a]) this.justPressed[a] = true;
  }
  endFrame() { this._prevHeld = { ...this.actions }; }
  reset() { this.actions = {}; }
  press(action) { this.actions[action] = true; }
}

class AIController {
  constructor(difficulty) {
    this.profile = AI_PROFILES[difficulty] || AI_PROFILES.Normal;
    this.input = new AIInputState();
    this.decisionTimer = 0;
    this.currentPlan = "approach";
  }

  update(dt, self, opp) {
    this.input.beginFrame();
    this.input.reset();
    this.decisionTimer -= dt;

    const dist = opp.x - self.x;
    const absDist = Math.abs(dist);
    const dir = dist > 0 ? 1 : -1;
    const p = this.profile;

    // React to opponent's active attacks by blocking, with reaction delay baked
    // into how often the AI is even allowed to re-evaluate.
    const opponentAttacking = opp.isBusy() && opp.state !== "hit" && opp.state !== "ko" && absDist < 130;

    if (this.decisionTimer <= 0) {
      this.decisionTimer = this.profile.reaction * (0.6 + Math.random() * 0.8);

      if (self.health < self.maxHealth * 0.3 && Math.random() < p.aggression * 0.5) {
        this.currentPlan = "retreat";
      } else if (opponentAttacking && Math.random() < p.blockChance) {
        this.currentPlan = "block";
      } else if (absDist > 260) {
        this.currentPlan = "approach";
      } else if (absDist > 90) {
        this.currentPlan = Math.random() < p.aggression ? "close" : "approach";
      } else {
        this.currentPlan = this.pickAttackPlan(self, p);
      }

      if (Math.random() < p.mistake) this.currentPlan = "idle";
    }

    switch (this.currentPlan) {
      case "approach":
        this.input.press(dir > 0 ? "right" : "left");
        break;
      case "close":
        this.input.press(dir > 0 ? "right" : "left");
        if (Math.random() < 0.15) this.input.press("dash");
        break;
      case "retreat":
        this.input.press(dir > 0 ? "left" : "right");
        if (Math.random() < 0.3) this.input.press("block");
        break;
      case "block":
        this.input.press("block");
        if (Math.random() < 0.4) this.input.press("down");
        break;
      case "jumpIn":
        this.input.press("up");
        this.input.press(dir > 0 ? "right" : "left");
        break;
      case "punchLight":
        this.input.press("punch");
        break;
      case "punchHeavy":
        this.input.press("punch");
        this.input.press("down");
        break;
      case "kickLight":
        this.input.press("kick");
        break;
      case "kickHeavy":
        this.input.press("kick");
        this.input.press("down");
        break;
      case "special":
        this.input.press("special");
        break;
      case "ultimate":
        this.input.press("ultimate");
        break;
      case "idle":
      default:
        break;
    }
  }

  pickAttackPlan(self, p) {
    if (self.meter >= 100 && Math.random() < p.ultimateUse) return "ultimate";
    if (self.meter >= 35 && Math.random() < p.specialChance) return "special";
    if (self.grounded && Math.random() < 0.12) return "jumpIn";
    const roll = Math.random();
    if (roll < 0.35) return "punchLight";
    if (roll < 0.55) return "punchHeavy";
    if (roll < 0.8) return "kickLight";
    return "kickHeavy";
  }

  finalizeFrame() { this.input.endFrame(); }
}
