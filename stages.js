/* stages.js
 * Original arena backdrops. Every stage is drawn procedurally with canvas
 * gradients and shapes — no external images required, so the game stays
 * fully offline-capable and lightweight.
 */

const STAGES = {
  neonCity: {
    id: "neonCity",
    name: "Neon City",
    desc: "A rain-slicked rooftop above a glowing night skyline.",
    sky: ["#0a0a2a", "#241a4a", "#3a1c52"],
    ground: "#141024",
    accent: "#ff3cac",
    draw(ctx, w, h, t) {
      drawSkyGradient(ctx, w, h, this.sky);
      // distant skyline
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const bw = 30 + (i * 37) % 60;
        const bx = (i * 61) % w;
        const bh = 60 + (i * 53) % 160;
        ctx.fillStyle = i % 3 === 0 ? "#221a3a" : "#1a1430";
        ctx.fillRect(bx, h * 0.55 - bh, bw, bh);
        ctx.fillStyle = ["#ff3cac", "#3cf5ff", "#f7ff3c"][i % 3];
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t / 400 + i);
        for (let wx = 4; wx < bw - 4; wx += 10) {
          for (let wy = 6; wy < bh - 4; wy += 14) {
            if ((wx + wy + i) % 22 < 10) ctx.fillRect(bx + wx, h * 0.55 - bh + wy, 4, 6);
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      groundPlane(ctx, w, h, "#1c1630", "#0e0a1c");
      neonLine(ctx, w, h * 0.56, w, "#ff3cac", t);
    },
  },

  ancientTemple: {
    id: "ancientTemple",
    name: "Ancient Temple",
    desc: "Weathered stone ruins high in the mountain mist.",
    sky: ["#3a4a5a", "#6a7a8a", "#9aa8ad"],
    ground: "#4a4234",
    accent: "#d9c48a",
    draw(ctx, w, h, t) {
      drawSkyGradient(ctx, w, h, this.sky);
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse((i * 210 + (t / 60) % w) % (w + 200) - 100, h * 0.25 + i * 18, 140, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const px = w * (0.08 + i * 0.21);
        ctx.fillStyle = "#5a5142";
        ctx.fillRect(px, h * 0.3, 26, h * 0.28);
        ctx.fillStyle = "#3f3829";
        ctx.fillRect(px - 4, h * 0.28, 34, 10);
      }
      groundPlane(ctx, w, h, "#5a5240", "#332c20");
    },
  },

  desertArena: {
    id: "desertArena",
    name: "Desert Arena",
    desc: "A sun-bleached battle pit ringed by dunes.",
    sky: ["#e8a55a", "#f2c778", "#f7e0a0"],
    ground: "#c9995c",
    accent: "#ffefc2",
    draw(ctx, w, h, t) {
      drawSkyGradient(ctx, w, h, this.sky);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.18, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9a869";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(w * (0.2 * i + 0.1), h * 0.5, 200, 40, 0, Math.PI, 0, true);
        ctx.fill();
      }
      groundPlane(ctx, w, h, "#caa06a", "#8a6a3e");
    },
  },

  fightClub: {
    id: "fightClub",
    name: "Underground Fight Club",
    desc: "A dim industrial basement lit by a single hanging lamp.",
    sky: ["#111", "#1c1c1c", "#262626"],
    ground: "#181818",
    accent: "#ffcf5c",
    draw(ctx, w, h, t) {
      drawSkyGradient(ctx, w, h, this.sky);
      // hanging lamp cone
      const cx = w / 2;
      const grad = ctx.createRadialGradient(cx, h * 0.15, 10, cx, h * 0.55, 320);
      grad.addColorStop(0, "rgba(255,207,92,0.35)");
      grad.addColorStop(1, "rgba(255,207,92,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 6;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h * 0.2 * i);
        ctx.lineTo(w, h * 0.2 * i);
        ctx.stroke();
      }
      groundPlane(ctx, w, h, "#222", "#0a0a0a");
    },
  },

  cyberArena: {
    id: "cyberArena",
    name: "Cyber Arena",
    desc: "A sleek competition ring inside a data-lit tower.",
    sky: ["#050b18", "#08182e", "#0d2440"],
    ground: "#08101c",
    accent: "#38f7ff",
    draw(ctx, w, h, t) {
      drawSkyGradient(ctx, w, h, this.sky);
      ctx.strokeStyle = "rgba(56,247,255,0.25)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h * 0.56);
        ctx.stroke();
      }
      groundPlane(ctx, w, h, "#0c1826", "#020608");
      neonLine(ctx, w, h * 0.56, w, "#38f7ff", t);
    },
  },
};

const STAGE_ORDER = ["neonCity", "ancientTemple", "desertArena", "fightClub", "cyberArena"];

function drawSkyGradient(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.6);
}

function groundPlane(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, h * 0.56, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.56, w, h * 0.44);
}

function neonLine(ctx, w, y, width, color, t) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.7 + 0.2 * Math.sin(t / 300);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.restore();
}
