/* ui.js
 * Draws the in-fight HUD (health bars, special meters, round/timer, combo
 * pop-ups, K.O./round banners) on top of the canvas. Menu screens (main
 * menu, character select, pause, victory/defeat) are plain DOM and are
 * managed directly in game.js / index.html for simplicity and accessibility.
 */

class UIManager {
  constructor(comboEl, bannerEl) {
    this.comboEl = comboEl;
    this.bannerEl = bannerEl;
    this.comboTimeout = null;
    this.bannerTimeout = null;
  }

  showComboText(count) {
    if (!this.comboEl) return;
    this.comboEl.textContent = `${count} HIT COMBO`;
    this.comboEl.classList.remove("pop");
    void this.comboEl.offsetWidth; // restart animation
    this.comboEl.classList.add("pop");
  }

  showBanner(text, duration = 1200) {
    if (!this.bannerEl) return;
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add("show");
    clearTimeout(this.bannerTimeout);
    if (duration) this.bannerTimeout = setTimeout(() => this.bannerEl.classList.remove("show"), duration);
  }

  hideBanner() {
    if (this.bannerEl) this.bannerEl.classList.remove("show");
  }

  drawHealthBar(ctx, x, y, w, h, pct, flip, color) {
    ctx.save();
    ctx.fillStyle = "rgba(10,10,20,0.7)";
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const innerW = (w - 6) * Math.max(0, pct);
    ctx.fillStyle = pct > 0.35 ? color : "#ff3b3b";
    if (flip) {
      roundRect(ctx, x + w - 3 - innerW, y + 3, innerW, h - 6, (h - 6) / 2);
    } else {
      roundRect(ctx, x + 3, y + 3, innerW, h - 6, (h - 6) / 2);
    }
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
    ctx.restore();
  }

  drawMeterBar(ctx, x, y, w, h, pct, flip, ready) {
    ctx.save();
    ctx.fillStyle = "rgba(10,10,20,0.7)";
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const innerW = (w - 4) * Math.max(0, Math.min(1, pct));
    ctx.fillStyle = ready ? "#ffd23f" : "#38f7ff";
    if (ready) {
      ctx.shadowColor = "#ffd23f";
      ctx.shadowBlur = 8;
    }
    if (flip) roundRect(ctx, x + w - 2 - innerW, y + 2, innerW, h - 4, (h - 4) / 2);
    else roundRect(ctx, x + 2, y + 2, innerW, h - 4, (h - 4) / 2);
    ctx.fill();
    ctx.restore();
  }

  drawHUD(ctx, w, h, p1, p2, round, timeLeft) {
    const barW = w * 0.36;
    const barH = 22;
    const topY = 22;

    ctx.save();
    ctx.font = "bold 15px 'Segoe UI', sans-serif";
    ctx.fillStyle = "#fff";

    // P1 (left)
    ctx.textAlign = "left";
    ctx.fillText(p1.char.name.toUpperCase(), 24, topY - 8);
    this.drawHealthBar(ctx, 24, topY, barW, barH, p1.health / p1.maxHealth, false, "#5ad1ff");
    this.drawMeterBar(ctx, 24, topY + barH + 6, barW * 0.62, 10, p1.meter / 100, false, p1.meter >= 100);

    // P2 (right)
    ctx.textAlign = "right";
    ctx.fillText(p2.char.name.toUpperCase(), w - 24, topY - 8);
    this.drawHealthBar(ctx, w - 24 - barW, topY, barW, barH, p2.health / p2.maxHealth, true, "#ff6b6b");
    this.drawMeterBar(ctx, w - 24 - barW * 0.62, topY + barH + 6, barW * 0.62, 10, p2.meter / 100, true, p2.meter >= 100);

    // round pips
    ctx.textAlign = "center";
    ctx.font = "bold 13px 'Segoe UI', sans-serif";
    ctx.fillText(`ROUND ${round}`, w / 2, topY - 4);

    // timer
    ctx.font = "bold 30px 'Segoe UI', sans-serif";
    ctx.fillStyle = timeLeft <= 10 ? "#ff5c5c" : "#fff";
    ctx.fillText(Math.max(0, Math.ceil(timeLeft)).toString(), w / 2, topY + 34);

    ctx.restore();
  }
}

/* roundRect() is shared from effects.js (loaded before this file). */
