/* combat.js
 * The fighting-game rules: movement, attacks, blocking, combos, special
 * meter, and damage resolution. Rendering lives in effects.js; this file
 * is pure gameplay logic plus the small amount of glue needed to trigger
 * sound/particles when something happens.
 */

const ARENA = { minX: 60, maxX: 940, groundY: 460, gravity: 1500, width: 1000, height: 520 };

const MOVE_TIMING = {
  punchLight: { dur: 0.28, hitAt: 0.11, range: 70, knock: 60, stun: 0.22 },
  punchHeavy: { dur: 0.48, hitAt: 0.22, range: 78, knock: 140, stun: 0.35 },
  kickLight: { dur: 0.32, hitAt: 0.14, range: 76, knock: 80, stun: 0.24 },
  kickHeavy: { dur: 0.52, hitAt: 0.24, range: 86, knock: 160, stun: 0.4 },
  special: { dur: 0.6, hitAt: 0.25, range: 110, knock: 200, stun: 0.5 },
  ultimate: { dur: 1.1, hitAt: 0.4, range: 140, knock: 260, stun: 0.7 },
};

class Fighter {
  constructor(charId, startX, facing, isCPU, difficulty) {
    this.char = getCharacter(charId);
    this.x = startX;
    this.y = ARENA.groundY;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.isCPU = isCPU;
    this.difficulty = difficulty || "Normal";

    this.maxHealth = this.char.stats.health * 1.4;
    this.health = this.maxHealth;
    this.meter = 0;
    this.state = "idle"; // idle, walk, jump, crouch, block, crouchBlock, punchLight, punchHeavy, kickLight, kickHeavy, special, ultimate, hit, ko
    this.animTime = 0;
    this.grounded = true;
    this.hitFlash = 0;
    this.attackHasHit = false;
    this.currentMove = null; // {timing, dmg, name, kind}
    this.comboCount = 0;
    this.comboTimer = 0;
    this.dashCooldown = 0;
    this.blockstunTimer = 0;
    this.hitstunTimer = 0;
    this.superChargeVisual = false;
    this.ultimateFlashTimer = 0;

    // match stats
    this.stats = { damageDealt: 0, highestCombo: 0, specialsUsed: 0 };

    // scale gameplay numbers by character stats (0-100 -> multiplier)
    this.speedMult = 0.6 + (this.char.stats.speed / 100) * 0.8;
    this.powerMult = 0.75 + (this.char.stats.power / 100) * 0.6;
    this.defenseMult = 1.3 - (this.char.stats.defense / 100) * 0.6;
    this.jumpMult = 0.75 + (this.char.stats.jump / 100) * 0.5;
  }

  isBusy() {
    return ["punchLight", "punchHeavy", "kickLight", "kickHeavy", "special", "ultimate", "hit", "ko"].includes(this.state);
  }
  isBlockingState() { return this.state === "block" || this.state === "crouchBlock"; }
  isNeutral() { return ["idle", "walk", "jump", "crouch"].includes(this.state); }

  faceOpponent(opp) {
    if (!this.isBusy()) this.facing = opp.x >= this.x ? 1 : -1;
  }

  setState(s) { this.state = s; this.animTime = 0; }

  startAttack(kind, moveData, timingKey) {
    this.setState(kind);
    this.attackHasHit = false;
    this.currentMove = { timing: MOVE_TIMING[timingKey], dmg: moveData.dmg, name: moveData.name, kind };
  }

  tryMove(action, opp, dt, engine) {
    if (this.state === "ko") return;

    // hitstun / blockstun lock out actions
    if (this.hitstunTimer > 0 || this.blockstunTimer > 0) return;

    if (this.isBusy()) return; // mid-attack, can't act (no cancels — keeps combos honest)

    const grounded = this.grounded;

    if (action.wasPressed("ultimate") && this.meter >= 100) {
      this.meter = 0;
      this.startAttack("ultimate", this.char.ultimate, "ultimate");
      this.stats.specialsUsed++;
      engine.audio.ultimate();
      engine.particles.addShake(14);
      this.ultimateFlashTimer = 0.15;
      engine.slowMo = 0.35;
      return;
    }

    if (action.wasPressed("special")) {
      const specs = this.char.specials;
      let chosen = null;
      if (this.comboCount >= 3 && this.meter >= specs[2].cost) chosen = specs[2];
      else if (action.isHeld("block") && this.meter >= specs[1].cost) chosen = specs[1];
      else if (this.meter >= specs[0].cost) chosen = specs[0];
      if (chosen) {
        this.meter -= chosen.cost;
        this.startAttack("special", chosen, "special");
        this.stats.specialsUsed++;
        engine.audio.special();
        return;
      } else {
        engine.audio.menu();
      }
    }

    if (action.wasPressed("punch") && grounded) {
      const heavy = action.isHeld("down");
      const move = heavy ? this.char.moves.heavyPunch : this.char.moves.lightPunch;
      this.startAttack(heavy ? "punchHeavy" : "punchLight", move, heavy ? "punchHeavy" : "punchLight");
      engine.audio.punch();
      return;
    }
    if (action.wasPressed("kick") && grounded) {
      const heavy = action.isHeld("down");
      const move = heavy ? this.char.moves.heavyKick : this.char.moves.lightKick;
      this.startAttack(heavy ? "kickHeavy" : "kickLight", move, heavy ? "kickHeavy" : "kickLight");
      engine.audio.kick();
      return;
    }

    if (action.wasPressed("dash") && grounded && this.dashCooldown <= 0) {
      this.vx = 620 * this.speedMult * this.facing;
      this.dashCooldown = 0.5;
      engine.audio.dash();
      engine.particles.spawnDust(this.x, this.y);
      return;
    }

    if (action.isHeld("block")) {
      this.setState(action.isHeld("down") ? "crouchBlock" : "block");
      return;
    }

    if (action.isHeld("down")) { this.setState("crouch"); this.vx = 0; return; }

    if (action.wasPressed("up") && grounded) {
      this.vy = -560 * this.jumpMult;
      this.grounded = false;
      this.setState("jump");
      engine.audio.jump();
      return;
    }

    if (action.isHeld("left") || action.isHeld("right")) {
      const dir = action.isHeld("left") ? -1 : 1;
      this.vx = 220 * this.speedMult * dir;
      if (grounded) this.setState("walk");
    } else if (grounded) {
      this.vx *= 0.6;
      if (Math.abs(this.vx) < 5) { this.vx = 0; if (this.state === "walk" || this.state === "crouch" || this.state === "block" || this.state === "crouchBlock") this.setState("idle"); }
    }
  }

  applyPhysics(dt) {
    if (!this.grounded) {
      this.vy += ARENA.gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= ARENA.groundY) {
        this.y = ARENA.groundY;
        this.vy = 0;
        this.grounded = true;
        if (this.state === "jump") this.setState("idle");
      }
    }
    this.x += this.vx * dt;
    this.x = Math.max(ARENA.minX, Math.min(ARENA.maxX, this.x));
    if (this.grounded && this.state !== "walk" && !this.isBusy() && !this.isBlockingState()) this.vx *= 0.7;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.ultimateFlashTimer > 0) this.ultimateFlashTimer -= dt;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    if (this.hitstunTimer > 0) {
      this.hitstunTimer -= dt;
      if (this.hitstunTimer <= 0 && this.state === "hit") this.setState("idle");
    }
    if (this.blockstunTimer > 0) {
      this.blockstunTimer -= dt;
    }

    if (this.isBusy() && this.state !== "hit" && this.state !== "ko") {
      this.animTime += dt;
      if (this.currentMove && this.animTime >= this.currentMove.timing.dur) {
        this.setState("idle");
        this.currentMove = null;
      }
    } else {
      this.animTime += dt;
    }

    // passive meter regen while blocking held (small) handled at hit-resolution level
    this.superChargeVisual = this.meter >= 100;
  }

  takeHit(dmgRaw, move, attacker, engine) {
    const blocking = this.isBlockingState() &&
      ((attacker.x < this.x && this.facing === -1) || (attacker.x > this.x && this.facing === 1));

    let dmg = dmgRaw;
    let knock = move.timing.knock;

    if (blocking) {
      const chipFactor = move.kind === "ultimate" ? 0.4 : move.kind === "special" ? 0.6 : 0.85;
      dmg = dmgRaw * (1 - chipFactor);
      knock *= 0.3;
      this.blockstunTimer = move.timing.stun * 0.6;
      this.meter = Math.min(100, this.meter + 2);
      engine.audio.block();
      engine.particles.spawnHitSpark(this.x - this.facing * 20, this.y - 60, "#9fdcff");
    } else {
      dmg = dmgRaw * this.defenseMult;
      this.hitstunTimer = move.timing.stun;
      this.setState(this.health - dmg <= 0 ? "ko" : "hit");
      this.hitFlash = 1;
      this.meter = Math.min(100, this.meter + 4);
      engine.audio.hit();
      engine.particles.spawnHitSpark(this.x - this.facing * 15, this.y - 60, "#fff176");
      engine.particles.addShake(move.kind === "ultimate" ? 12 : move.kind === "special" ? 7 : 4);
      this.vx = knock * -this.facing * 0.02 * 60;
    }

    this.health = Math.max(0, this.health - dmg);
    attacker.stats.damageDealt += dmg;
    return { dmg, blocked: blocking };
  }
}

/* Fighters are solid — keep them from walking through one another (and
 * keep the left/right visual arrangement stable), like a real arcade
 * fighting game's stage collision. */
const MIN_SEPARATION = 46;
function enforceSeparation(a, b) {
  const dist = b.x - a.x;
  const absDist = Math.abs(dist);
  if (absDist >= MIN_SEPARATION || absDist === 0) return;
  const overlap = MIN_SEPARATION - absDist;
  const dir = dist >= 0 ? 1 : -1;
  const push = overlap / 2;
  a.x = Math.max(ARENA.minX, Math.min(ARENA.maxX, a.x - dir * push));
  b.x = Math.max(ARENA.minX, Math.min(ARENA.maxX, b.x + dir * push));
}

/* Resolve an in-progress attack against the opponent: checks range/timing,
 * applies the hit once, updates combo counters and attacker's meter. */
function resolveAttacks(a, b, engine) {
  [ [a, b], [b, a] ].forEach(([attacker, defender]) => {
    if (!attacker.isBusy() || attacker.state === "hit" || attacker.state === "ko") return;
    const move = attacker.currentMove;
    if (!move || attacker.attackHasHit) return;
    if (attacker.animTime < move.timing.hitAt) return;

    const dist = Math.abs(attacker.x - defender.x);
    const facingRight = (defender.x >= attacker.x);
    const facingCorrect = (facingRight && attacker.facing === 1) || (!facingRight && attacker.facing === -1);

    attacker.attackHasHit = true; // consume the hit window even on whiff

    if (dist > move.timing.range || !facingCorrect || defender.state === "ko") return;

    // combo scaling: each subsequent hit in an active combo does slightly less
    const scale = Math.max(0.4, 1 - attacker.comboCount * 0.08);
    const dmg = move.dmg * attacker.powerMult * scale;

    const result = defender.takeHit(dmg, move, attacker, engine);

    if (!result.blocked) {
      attacker.comboCount += 1;
      attacker.comboTimer = 1.1;
      attacker.stats.highestCombo = Math.max(attacker.stats.highestCombo, attacker.comboCount);
      attacker.meter = Math.min(100, attacker.meter + (move.kind === "special" || move.kind === "ultimate" ? 8 : move.kind.includes("Heavy") ? 5 : 3));
      if (attacker.comboCount >= 3) engine.ui.showComboText(attacker.comboCount);
    } else {
      attacker.comboCount = 0;
    }
  });
}
