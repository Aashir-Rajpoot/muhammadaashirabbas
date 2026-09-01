/* effects.js
 * Procedural fighter rendering + particle/impact effects, all drawn with
 * canvas primitives so no sprite sheets or image assets are required.
 */

class Particle {
  constructor(x, y, vx, vy, life, color, size, gravity = 0) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life; this.color = color;
    this.size = size; this.gravity = gravity;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() { this.particles = []; this.shake = 0; }
  spawnHitSpark(x, y, color = "#fff") {
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 140;
      this.particles.push(new Particle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.25 + Math.random() * 0.15, color, 4 + Math.random() * 3));
    }
  }
  spawnDust(x, y, color = "#d8c9a8") {
    for (let i = 0; i < 6; i++) {
      this.particles.push(new Particle(x + (Math.random() - 0.5) * 20, y, (Math.random() - 0.5) * 40, -20 - Math.random() * 30, 0.4, color, 5, 60));
    }
  }
  spawnEnergy(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 200;
      this.particles.push(new Particle(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.5 + Math.random() * 0.3, color, 3 + Math.random() * 4));
    }
  }
  addShake(amount) { this.shake = Math.min(24, this.shake + amount); }
  update(dt) {
    this.particles = this.particles.filter((p) => p.update(dt));
    this.shake = Math.max(0, this.shake - dt * 60);
  }
  draw(ctx) { this.particles.forEach((p) => p.draw(ctx)); }
  getShakeOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
  }
}

/* ---------- Procedural fighter rendering ---------- *
 * A shared humanoid rig is posed per animation state, then colored /
 * scaled per character so every fighter reads as visually distinct
 * without needing individual sprite art.
 */
function drawFighter(ctx, f, t) {
  const c = f.char;
  const pal = c.palette;
  const facing = f.facing; // 1 = right, -1 = left
  const scaleH = c.build.height;
  const scaleW = c.build.width;
  const baseX = f.x;
  const baseY = f.y; // feet position (ground level for this fighter)

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(facing, 1);

  const legLen = 46 * scaleH;
  const torsoLen = 44 * scaleH;
  const headR = 13 * scaleW;
  const armLen = 34 * scaleH;
  const bodyW = 20 * scaleW;

  // pose offsets by state
  let crouch = f.state === "crouch" || f.state === "crouchBlock" ? 14 * scaleH : 0;
  let leanX = 0, leanY = 0, armSwing = 0, legSpread = 6;
  const anim = f.animTime;

  if (f.state === "walk") { legSpread = 12 + Math.sin(anim * 12) * 6; leanX = Math.sin(anim * 12) * 2; }
  if (f.state === "jump") { legSpread = 4; leanY = -Math.min(1, anim * 3) * 0; }
  if (f.state === "punchLight" || f.state === "punchHeavy") { armSwing = Math.min(1, anim * 8); leanX = 6 * scaleW; }
  if (f.state === "kickLight" || f.state === "kickHeavy") { armSwing = Math.min(1, anim * 6); leanX = 4 * scaleW; }
  if (f.state === "block" || f.state === "crouchBlock") { armSwing = 1; leanX = -4; }
  if (f.state === "hit") { leanX = -8 * scaleW; }
  if (f.state === "special" || f.state === "ultimate") { armSwing = 1; }
  if (f.state === "ko") { crouch = 30 * scaleH; leanX = 10; }

  const groundY = -crouch;

  // shadow
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 4, 26 * scaleW, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.translate(leanX, leanY);

  // legs
  ctx.strokeStyle = pal.secondary;
  ctx.lineWidth = 9 * scaleW;
  ctx.lineCap = "round";
  const hipY = groundY - legLen - crouch * 0.3;
  ctx.beginPath();
  ctx.moveTo(-legSpread * 0.5, hipY);
  ctx.lineTo(-legSpread, groundY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(legSpread * 0.5, hipY);
  ctx.lineTo(legSpread, groundY);
  ctx.stroke();

  // torso
  ctx.fillStyle = pal.primary;
  const torsoTop = hipY - torsoLen;
  roundRect(ctx, -bodyW / 2, torsoTop, bodyW, torsoLen, 6 * scaleW);
  ctx.fill();
  // chest accent
  ctx.fillStyle = pal.accent;
  ctx.globalAlpha = 0.85;
  roundRect(ctx, -bodyW / 2, torsoTop, bodyW, 8, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  // arms
  ctx.strokeStyle = pal.primary;
  ctx.lineWidth = 8 * scaleW;
  const shoulderY = torsoTop + 6;
  let frontArmAng = -0.3 + armSwing * 1.6;
  let backArmAng = 0.5 - armSwing * 0.4;
  if (f.state === "block" || f.state === "crouchBlock") { frontArmAng = -1.3; backArmAng = -1.1; }
  drawLimb(ctx, 6, shoulderY, armLen, frontArmAng, pal.skin);
  drawLimb(ctx, -6, shoulderY, armLen * 0.9, backArmAng, pal.skin);

  // head
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, torsoTop - headR - 2, headR, 0, Math.PI * 2);
  ctx.fill();
  // hair/mask accent per character
  ctx.fillStyle = pal.secondary;
  ctx.beginPath();
  ctx.arc(0, torsoTop - headR - 2, headR, Math.PI, Math.PI * 2);
  ctx.fill();

  // character-specific accessory flourishes (kept lightweight)
  drawAccessory(ctx, c.id, { torsoTop, headR, bodyW, pal, armSwing, t });

  // special/ultimate glow
  if (f.state === "special" || f.state === "ultimate" || f.superChargeVisual) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t / 60);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, torsoTop - 10, 40 * scaleW, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // flash on hit
  if (f.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.6, f.hitFlash);
    ctx.fillStyle = "#fff";
    roundRect(ctx, -bodyW / 2, torsoTop, bodyW, torsoLen, 6);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawLimb(ctx, x, y, len, angle, color) {
  const ex = x + Math.cos(angle) * len;
  const ey = y + Math.sin(angle) * len;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ex, ey, 5, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawAccessory(ctx, id, info) {
  const { torsoTop, headR, bodyW, pal, armSwing, t } = info;
  ctx.save();
  switch (id) {
    case "thrax": // wide belt
      ctx.fillStyle = pal.accent;
      ctx.fillRect(-bodyW / 2 - 2, torsoTop + 30, bodyW + 4, 6);
      break;
    case "nyssa": // half mask
      ctx.fillStyle = pal.secondary;
      ctx.fillRect(-headR, torsoTop - headR - 6, headR * 2, 7);
      break;
    case "jinho": // staff
      ctx.strokeStyle = "#7a5a34";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-30, torsoTop - 30);
      ctx.lineTo(30, torsoTop + 40);
      ctx.stroke();
      break;
    case "pyra": // glowing forearm vents
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t / 80);
      ctx.beginPath();
      ctx.arc(18, torsoTop + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "kobra": // sash
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-bodyW / 2, torsoTop + 10);
      ctx.lineTo(bodyW / 2, torsoTop + 34);
      ctx.stroke();
      break;
    case "rex": // open jacket flaps
      ctx.fillStyle = pal.secondary;
      ctx.fillRect(-bodyW / 2 - 3, torsoTop + 4, 5, 30);
      ctx.fillRect(bodyW / 2 - 2, torsoTop + 4, 5, 30);
      break;
    case "otto": // padded vest lines
      ctx.strokeStyle = pal.secondary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, torsoTop + 6);
      ctx.lineTo(0, torsoTop + 34);
      ctx.stroke();
      break;
    case "vela": // storm collar
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-bodyW / 2 - 1, torsoTop, bodyW + 2, 5);
      break;
  }
  ctx.restore();
}
