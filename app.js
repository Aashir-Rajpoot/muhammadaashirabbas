'use strict';

/* =========================================================================
   AASHIR X — app.js
   RealityEngine
    ├── ThemeEngine     writes --environment-* CSS vars
    ├── TimeEngine      local clock + day-phase
    ├── LocationEngine  geolocation + reverse geocode
    ├── WeatherEngine   Open-Meteo (keyless) live conditions
    ├── ParticleEngine  living background canvas + hero glyph
    ├── CursorEngine    custom cursor + magnetic + light source
    ├── NavigationEngine secret radial nav + system panel
    ├── PortalEngine    3D worlds: tilt / flip / shuffle / launch
    └── EasterEngine    small discoveries
   ========================================================================= */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(pointer:fine)').matches;
const isLowPower = navigator.hardwareConcurrency ? navigator.hardwareConcurrency <= 4 : window.innerWidth < 700;

/* ========================================================================= REALITY ENGINE (shared state) */
const Reality = {
  phase: 'night',        // dawn | day | sunset | night
  weather: 'clear',       // clear | cloudy | rain | snow
  wind: 0,
  sunrise: null,
  sunset: null,
  locationLabel: null,
  theme: 'luxury',        // luxury | gaming | ai | cyber | space
};

/* ========================================================================= THEME ENGINE */
const ThemeEngine = {
  palettes: {
    dawn:   { primary: '242,166,90',  secondary: '201,139,217', glow: '229,156,96',  void: '14,10,7'  },
    day:    { primary: '217,181,140', secondary: '242,201,106', glow: '212,177,120', void: '16,13,10' },
    sunset: { primary: '239,131,84',  secondary: '201,106,217', glow: '224,140,92',  void: '13,9,7'   },
    night:  { primary: '197,164,108', secondary: '139,126,242', glow: '197,164,108', void: '10,8,6'   },
  },
  weatherOverride: {
    rain: { glow: '127,184,232' },
    snow: { glow: '223,233,242' },
  },
  apply(phase, weather) {
    const base = this.palettes[phase] || this.palettes.night;
    const root = document.documentElement.style;
    root.setProperty('--environment-primary', base.primary);
    root.setProperty('--environment-secondary', base.secondary);
    root.setProperty('--environment-void', base.void);
    const glow = (weather === 'rain' || weather === 'snow') ? this.weatherOverride[weather].glow : base.glow;
    root.setProperty('--environment-glow', glow);
  },
};

/* ========================================================================= THEME SYSTEM (5-theme experience) */
const ThemeSystem = {
  ids: ['luxury', 'gaming', 'ai', 'cyber', 'space'],
  storageKey: 'portfolio-theme',
  current: 'luxury',
  buttons: [],
  badgeText: {
    gaming: '// HUD ONLINE',
    ai: '◍ NEURAL LINK ACTIVE',
    cyber: 'SECURITY STATUS: ACTIVE · ENCRYPTED CONNECTION',
    space: 'TRANSMISSION FROM DEEP SPACE',
  },

  init() {
    this.buttons = $$('.theme-btn');
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.setTheme(btn.dataset.themeBtn));
    });

    let saved = null;
    try { saved = localStorage.getItem(this.storageKey); } catch (e) { /* storage unavailable */ }
    const initial = this.ids.includes(saved) ? saved : 'luxury';
    this.apply(initial, { initial: true });
  },

  setTheme(id) {
    if (!this.ids.includes(id) || id === this.current) return;

    if (reduceMotion) { this.apply(id); return; }

    const overlay = $('#theme-transition');
    document.body.classList.add('theme-switching');
    overlay.classList.add('active');

    setTimeout(() => {
      this.apply(id);
      setTimeout(() => {
        overlay.classList.remove('active');
        document.body.classList.remove('theme-switching');
      }, 70);
    }, 430);
  },

  apply(id, opts = {}) {
    this.current = id;
    Reality.theme = id;
    document.documentElement.setAttribute('data-theme', id);

    if (!opts.initial) {
      try { localStorage.setItem(this.storageKey, id); } catch (e) { /* storage unavailable */ }
    }

    this.buttons.forEach((btn) => {
      const active = btn.dataset.themeBtn === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const badge = $('#theme-badge');
    if (badge) badge.textContent = this.badgeText[id] || '';

    if (id === 'luxury') {
      ThemeEngine.apply(Reality.phase, Reality.weather);
    } else {
      // ThemeEngine writes --environment-* as inline styles on <html>, which
      // would otherwise outrank the html[data-theme="…"] stylesheet rules.
      const rootStyle = document.documentElement.style;
      ['--environment-primary', '--environment-secondary', '--environment-glow', '--environment-void']
        .forEach((prop) => rootStyle.removeProperty(prop));
    }
    if (ParticleEngine.canvas) ParticleEngine.reseed();
  },
};

/* ========================================================================= BOOT ENGINE */
const BootEngine = {
  messages: ['INITIALIZING ENVIRONMENT', 'SYNCING LOCAL TIME', 'READING ATMOSPHERE', 'SYSTEM ONLINE'],
  init() {
    const el = $('#boot-line');
    const boot = $('#boot');
    const canvas = $('#boot-canvas');
    this.drawParticles(canvas);

    let i = 0;
    const step = () => {
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = this.messages[i];
        el.style.opacity = '1';
        i++;
        if (i < this.messages.length) setTimeout(step, reduceMotion ? 40 : 380);
        else setTimeout(finish, reduceMotion ? 40 : 420);
      }, 40);
    };
    const finish = () => {
      boot.classList.add('hide');
      boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    };
    setTimeout(step, reduceMotion ? 20 : 260);
  },
  drawParticles(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const n = reduceMotion ? 0 : 60;
    const pts = Array.from({ length: n }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.2, a: Math.random() * Math.PI * 2,
    }));
    let raf;
    let frames = 0;
    const draw = () => {
      frames++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach((p) => {
        p.a += 0.01;
        ctx.globalAlpha = 0.25 + Math.sin(p.a) * 0.2;
        ctx.fillStyle = '#e7e6ed';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (frames < 140 && document.body.contains(canvas)) raf = requestAnimationFrame(draw);
    };
    if (!reduceMotion) draw();
  },
};

/* ========================================================================= TIME ENGINE */
const TimeEngine = {
  computePhase(date, sunrise, sunset) {
    const now = date.getHours() * 60 + date.getMinutes();
    if (sunrise && sunset) {
      const sr = sunrise.getHours() * 60 + sunrise.getMinutes();
      const ss = sunset.getHours() * 60 + sunset.getMinutes();
      if (now < sr - 40 || now > ss + 50) return 'night';
      if (now < sr + 60) return 'dawn';
      if (now > ss - 40) return 'sunset';
      return 'day';
    }
    const h = date.getHours();
    if (h < 5 || h >= 20) return 'night';
    if (h < 8) return 'dawn';
    if (h < 17) return 'day';
    return 'sunset';
  },
  tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const clock = $('#env-clock');
    if (clock) clock.textContent = `${hh}:${mm}`;
    const nextPhase = this.computePhase(now, Reality.sunrise, Reality.sunset);
    if (nextPhase !== Reality.phase) {
      Reality.phase = nextPhase;
      if (Reality.theme === 'luxury') {
        ThemeEngine.apply(Reality.phase, Reality.weather);
        ParticleEngine.reseed();
      }
    }
  },
  init() {
    this.tick();
    setInterval(() => this.tick(), 15000);
  },
};

/* ========================================================================= WEATHER + LOCATION ENGINE */
const WeatherEngine = {
  codeToState(code) {
    if ([61, 63, 65, 66, 67, 80, 81, 82, 51, 53, 55, 95, 96, 99].includes(code)) return { weather: 'rain', label: code >= 95 ? 'Thunderstorm' : 'Rain', thunder: code >= 95 };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { weather: 'snow', label: 'Snow' };
    if ([1, 2, 3, 45, 48].includes(code)) return { weather: 'cloudy', label: 'Cloudy' };
    return { weather: 'clear', label: 'Clear Sky' };
  },
  async fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=sunrise,sunset&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error('weather failed');
    return res.json();
  },
  async fetchPlace(lat, lon) {
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error('geocode failed');
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || 'Unknown';
      const country = data.countryCode || '';
      return country ? `${city}, ${country}` : city;
    } catch { return null; }
  },
  fallback(reason) {
    $('#env-loc').textContent = reason;
    $('#env-temp').textContent = '—';
    $('#env-ribbon').classList.add('visible');
    $('#sys-loc').textContent = reason.toUpperCase();
    $('#sys-weather').textContent = 'FALLBACK';
    $('#sys-env').textContent = 'LOCAL TIME ONLY';
    if (Reality.theme === 'luxury') {
      ThemeEngine.apply(Reality.phase, 'clear');
      ParticleEngine.reseed();
    }
  },
  init() {
    if (!('geolocation' in navigator)) { this.fallback('Location unavailable'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const [weatherData, place] = await Promise.all([
            this.fetchWeather(latitude, longitude),
            this.fetchPlace(latitude, longitude),
          ]);
          const cur = weatherData.current || {};
          const wx = this.codeToState(cur.weather_code);

          if (weatherData.daily) {
            Reality.sunrise = new Date(weatherData.daily.sunrise[0]);
            Reality.sunset = new Date(weatherData.daily.sunset[0]);
          }
          Reality.wind = cur.wind_speed_10m || 0;
          Reality.weather = wx.weather;
          Reality.locationLabel = place;

          const locLabel = place ? place.toUpperCase() : 'NEARBY';
          $('#env-loc').textContent = locLabel;
          $('#env-temp').textContent = Math.round(cur.temperature_2m) + '°C · ' + wx.label;
          $('#env-ribbon').classList.add('visible');

          $('#sys-loc').textContent = 'DETECTED';
          $('#sys-weather').textContent = 'LIVE — ' + wx.label.toUpperCase();
          $('#sys-env').textContent = 'SYNCED';

          Reality.phase = TimeEngine.computePhase(new Date(), Reality.sunrise, Reality.sunset);
          if (Reality.theme === 'luxury') {
            ThemeEngine.apply(Reality.phase, Reality.weather);
            ParticleEngine.reseed();
          }

          if (wx.thunder) EasterEngine.lightning();
        } catch (err) {
          this.fallback('Signal lost');
        }
      },
      () => this.fallback('Permission denied'),
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  },
};

/* ========================================================================= PARTICLE ENGINE (living background) */
const ParticleEngine = {
  canvas: null, ctx: null, dpr: 1, particles: [], raf: null, hidden: false,
  pointer: { x: window.innerWidth / 2, y: window.innerHeight / 2, vx: 0, vy: 0, lastX: window.innerWidth / 2, lastY: window.innerHeight / 2 },

  init() {
    this.canvas = $('#reality-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => { this.resize(); this.reseed(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { this.hidden = document.hidden; });

    if (isFinePointer) {
      window.addEventListener('mousemove', (e) => {
        this.pointer.vx = e.clientX - this.pointer.lastX;
        this.pointer.vy = e.clientY - this.pointer.lastY;
        this.pointer.lastX = e.clientX; this.pointer.lastY = e.clientY;
        this.pointer.x = e.clientX; this.pointer.y = e.clientY;
      }, { passive: true });
    }

    this.reseed();
    if (!reduceMotion) this.loop(); else this.drawStatic();
  },
  resize() {
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },
  glowColor() {
    return `rgba(${getVar('--environment-glow')},`;
  },
  reseed() {
    const w = window.innerWidth, h = window.innerHeight;
    const density = isLowPower ? 0.45 : 1;
    this.particles = [];
    let count, factory;
    const theme = Reality.theme;

    if (theme === 'gaming') {
      count = Math.floor(70 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.4, vy: -(0.15 + Math.random() * 0.4), o: 0.14 + Math.random() * 0.34, tw: Math.random() * Math.PI * 2 });
      for (let i = 0; i < count; i++) this.particles.push(factory());
      return;
    }
    if (theme === 'ai') {
      count = Math.floor(44 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 1.6, vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16, o: 0.24 + Math.random() * 0.3 });
      for (let i = 0; i < count; i++) this.particles.push(factory());
      return;
    }
    if (theme === 'cyber') {
      count = Math.floor(50 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, len: 8 + Math.random() * 22, speed: 0.5 + Math.random() * 1.1, o: 0.1 + Math.random() * 0.2 });
      for (let i = 0; i < count; i++) this.particles.push(factory());
      return;
    }
    if (theme === 'space') {
      count = Math.floor(160 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.5 + 0.2, tw: Math.random() * Math.PI * 2, speed: 0.01 + Math.random() * 0.02, big: Math.random() > 0.92 });
      for (let i = 0; i < count; i++) this.particles.push(factory());
      return;
    }

    // luxury (default) — original weather/time-of-day driven field
    if (Reality.weather === 'rain') {
      count = Math.floor(85 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, len: 14 + Math.random() * 16, speed: 9 + Math.random() * 6, drift: Reality.wind / 14, o: 0.16 + Math.random() * 0.24 });
    } else if (Reality.weather === 'snow') {
      count = Math.floor(65 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.6, speed: 0.5 + Math.random() * 1.1, drift: Reality.wind / 20, sway: Math.random() * Math.PI * 2, o: 0.3 + Math.random() * 0.4, depth: Math.random() });
    } else if (Reality.phase === 'night') {
      count = Math.floor(110 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h * 0.8, r: Math.random() * 1.3 + 0.3, tw: Math.random() * Math.PI * 2, speed: 0.02 + Math.random() * 0.03 });
    } else {
      count = Math.floor(42 * density);
      factory = () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.6 + Math.random() * 1.6, speed: 0.1 + Math.random() * 0.16, drift: (Reality.wind / 30) + 0.04, o: 0.1 + Math.random() * 0.18 });
    }
    for (let i = 0; i < count; i++) this.particles.push(factory());
  },
  drawStatic() {
    const w = window.innerWidth, h = window.innerHeight;
    this.ctx.clearRect(0, 0, w, h);
  },
  loop() {
    this.raf = requestAnimationFrame(() => this.loop());
    if (this.hidden) return;
    const w = window.innerWidth, h = window.innerHeight;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    const px = this.pointer.x, py = this.pointer.y;
    const vx = this.pointer.vx * 0.02, vy = this.pointer.vy * 0.02;
    this.pointer.vx *= 0.9; this.pointer.vy *= 0.9;
    const theme = Reality.theme;

    if (theme === 'gaming') {
      ctx.fillStyle = `rgb(${getVar('--environment-glow')})`;
      this.particles.forEach((p) => {
        p.tw += 0.02;
        ctx.globalAlpha = clamp(p.o + Math.sin(p.tw) * 0.16, 0, 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      });
      ctx.globalAlpha = 1;
      return;
    }
    if (theme === 'ai') {
      this.particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      });
      const glow = getVar('--environment-glow');
      ctx.strokeStyle = `rgba(${glow},0.12)`; ctx.lineWidth = 1;
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const a = this.particles[i], b = this.particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.globalAlpha = (1 - d / 130) * 0.5;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgb(${glow})`;
      this.particles.forEach((p) => {
        ctx.globalAlpha = p.o;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      return;
    }
    if (theme === 'cyber') {
      ctx.strokeStyle = `rgba(${getVar('--environment-glow')},0.4)`; ctx.lineWidth = 1;
      this.particles.forEach((p) => {
        ctx.globalAlpha = p.o;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
        p.y += p.speed;
        if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
      });
      ctx.globalAlpha = 1;
      return;
    }
    if (theme === 'space') {
      const secondary = getVar('--environment-secondary');
      this.particles.forEach((p) => {
        p.tw += p.speed;
        const d = Math.hypot(p.x - px, p.y - py);
        const push = d < 160 ? (160 - d) / 160 : 0;
        ctx.globalAlpha = clamp(0.3 + Math.sin(p.tw) * 0.3 + push * 0.3, 0, 1);
        ctx.fillStyle = p.big ? `rgb(${secondary})` : '#eef0ff';
        const r = p.big ? p.r * 1.9 : p.r;
        ctx.beginPath(); ctx.arc(p.x - vx * push * 3, p.y - vy * push * 3, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;
      return;
    }

    if (Reality.weather === 'rain') {
      ctx.strokeStyle = 'rgba(200,220,240,0.5)'; ctx.lineWidth = 1;
      this.particles.forEach((p) => {
        ctx.globalAlpha = p.o;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.drift * 4, p.y + p.len); ctx.stroke();
        p.y += p.speed; p.x += p.drift;
        if (p.y > h) { p.y = -20; p.x = Math.random() * w; }
      });
    } else if (Reality.weather === 'snow') {
      this.particles.forEach((p) => {
        p.sway += 0.01;
        ctx.globalAlpha = p.o * (0.5 + p.depth * 0.5);
        ctx.fillStyle = '#eef4fa';
        ctx.beginPath(); ctx.arc(p.x + Math.sin(p.sway) * 8, p.y, p.r * (0.6 + p.depth), 0, Math.PI * 2); ctx.fill();
        p.y += p.speed * (0.6 + p.depth); p.x += p.drift;
        if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
      });
    } else if (Reality.phase === 'night') {
      this.particles.forEach((p) => {
        p.tw += p.speed;
        const d = Math.hypot(p.x - px, p.y - py);
        const push = d < 140 ? (140 - d) / 140 : 0;
        ctx.globalAlpha = clamp(0.3 + Math.sin(p.tw) * 0.3 + push * 0.4, 0, 1);
        ctx.fillStyle = '#e7e6ed';
        ctx.beginPath(); ctx.arc(p.x - vx * push * 4, p.y - vy * push * 4, p.r + push * 1.2, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      this.particles.forEach((p) => {
        ctx.globalAlpha = p.o;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        p.y -= p.speed; p.x += p.drift;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x > w + 10) p.x = -10;
      });
    }
    ctx.globalAlpha = 1;
  },
};

function getVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '110,231,216';
}

/* ========================================================================= HERO GLYPH ("A" made of particles) */
const GlyphEngine = {
  init() {
    const canvas = $('#glyph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => Math.min(window.innerWidth * 0.8, 700);

    const resize = () => {
      const s = size();
      canvas.width = s * dpr; canvas.height = s * dpr;
      canvas.style.width = s + 'px'; canvas.style.height = s + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed(s);
    };

    let pts = [];
    function seed(s) {
      pts = [];
      const density = isLowPower ? 0.5 : 1;
      const n = Math.floor(260 * density);
      // sample points inside an "A" glyph shape drawn to an offscreen canvas
      const off = document.createElement('canvas');
      off.width = s; off.height = s;
      const octx = off.getContext('2d');
      octx.fillStyle = '#fff';
      octx.font = `800 ${s * 0.82}px Sora, sans-serif`;
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText('A', s / 2, s / 2 + s * 0.03);
      const data = octx.getImageData(0, 0, s, s).data;
      let tries = 0;
      while (pts.length < n && tries < n * 40) {
        tries++;
        const x = Math.random() * s, y = Math.random() * s;
        const idx = (Math.floor(y) * s + Math.floor(x)) * 4 + 3;
        if (data[idx] > 120) pts.push({ x, y, ox: x, oy: y, tw: Math.random() * Math.PI * 2 });
      }
    }

    let raf;
    function draw() {
      raf = requestAnimationFrame(draw);
      const s = size();
      ctx.clearRect(0, 0, s, s);
      const glow = getVar('--environment-glow');
      pts.forEach((p) => {
        p.tw += 0.012;
        const a = 0.06 + Math.sin(p.tw) * 0.04;
        ctx.fillStyle = `rgba(${glow},${clamp(a, 0.02, 0.14)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
      });
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    if (!reduceMotion) {
      draw();
    } else {
      const s = size();
      ctx.clearRect(0, 0, s, s);
      const glow = getVar('--environment-glow');
      ctx.fillStyle = `rgba(${glow},0.08)`;
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill(); });
    }
  },
};

/* ========================================================================= CURSOR ENGINE */
const CursorEngine = {
  init() {
    if (!isFinePointer) { document.body.classList.add('no-fine-pointer'); return; }
    const dot = $('#cursor-dot'), ring = $('#cursor-ring'), label = $('#cursor-label');
    let mx = -100, my = -100, rx = -100, ry = -100;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
      document.documentElement.style.setProperty('--mx', mx + 'px');
      document.documentElement.style.setProperty('--my', my + 'px');
    }, { passive: true });

    const raf = () => {
      rx = lerp(rx, mx, 0.18); ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(raf);
    };
    raf();

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('.index-row')) { ring.classList.add('ring-row'); label.textContent = 'View'; }
      else if (e.target.closest('a,button,[data-magnetic]')) { ring.classList.add('ring-hover'); }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest('.index-row')) ring.classList.remove('ring-row');
      if (e.target.closest('a,button,[data-magnetic]')) ring.classList.remove('ring-hover');
    });
    document.addEventListener('mouseleave', () => { dot.style.opacity = '0'; ring.style.opacity = '0'; });
    document.addEventListener('mouseenter', () => { dot.style.opacity = '1'; ring.style.opacity = '1'; });
  },
};

/* ========================================================================= NAVIGATION ENGINE */
const NavigationEngine = {
  init() {
    const orb = $('#nav-orb'), menu = $('#radial-menu');
    orb.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      orb.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#secret-nav') && menu.classList.contains('open')) {
        menu.classList.remove('open'); orb.setAttribute('aria-expanded', 'false');
      }
    });
    $$('#radial-menu a').forEach((a) => a.addEventListener('click', () => {
      menu.classList.remove('open'); orb.setAttribute('aria-expanded', 'false');
    }));

    const panel = $('#system-panel');
    $('#system-open').addEventListener('click', () => {
      panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
      menu.classList.remove('open'); orb.setAttribute('aria-expanded', 'false');
    });
    $('#system-close').addEventListener('click', () => this.closeSystem());
    panel.addEventListener('click', (e) => { if (e.target === panel) this.closeSystem(); });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeSystem();
        menu.classList.remove('open'); orb.setAttribute('aria-expanded', 'false');
        PortalEngine.closeAll();
      }
    });
  },
  closeSystem() {
    const panel = $('#system-panel');
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
  },
};

/* ========================================================================= INDEX ENGINE (portals as an editorial list) */
const PortalEngine = {
  list: null, rows: [], preview: null,
  target: { x: 0, y: 0 }, pos: { x: 0, y: 0 }, active: false,

  init() {
    this.list = $('#index-list');
    this.rows = $$('.index-row', this.list);
    this.preview = $('#preview-float');

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('in-view'), i * 70);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      this.rows.forEach((r) => io.observe(r));
    } else {
      this.rows.forEach((r) => r.classList.add('in-view'));
    }

    this.rows.forEach((row) => {
      const accent = row.dataset.accent;
      const url = row.dataset.url;
      const title = $('.row-title', row).textContent;
      row.style.setProperty('--row-accent', accent);

      const launch = () => launchProject(url, title);
      row.addEventListener('click', launch);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); launch(); }
      });

      if (isFinePointer && !reduceMotion) {
        row.addEventListener('mouseenter', () => {
          this.active = true;
          this.preview.style.borderColor = `rgba(${accent},0.55)`;
          $('.preview-ring', this.preview).style.background = `rgb(${accent})`;
          $('.preview-label', this.preview).style.color = `rgb(${accent})`;
          this.preview.classList.add('visible');
        });
        row.addEventListener('mouseleave', () => {
          this.active = false;
          this.preview.classList.remove('visible');
        });
      }
    });

    if (isFinePointer && !reduceMotion) {
      this.pos.x = this.target.x = window.innerWidth / 2;
      this.pos.y = this.target.y = window.innerHeight / 2;
      window.addEventListener('mousemove', (e) => {
        this.target.x = e.clientX; this.target.y = e.clientY;
      }, { passive: true });
      const raf = () => {
        this.pos.x = lerp(this.pos.x, this.target.x, 0.18);
        this.pos.y = lerp(this.pos.y, this.target.y, 0.18);
        const scale = this.active ? 1 : 0;
        this.preview.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px) translate(-50%,-50%) scale(${scale})`;
        requestAnimationFrame(raf);
      };
      raf();
    }

    const shuffleBtn = $('#shuffle-btn');
    if (shuffleBtn) shuffleBtn.addEventListener('click', () => this.shuffle());
  },

  closeAll() { /* no expandable state to close in the list layout */ },

  shuffle() {
    if (reduceMotion) return;
    const rows = this.rows;
    const first = rows.map((r) => r.getBoundingClientRect());
    const shuffled = [...rows].sort(() => Math.random() - 0.5);
    shuffled.forEach((r) => this.list.appendChild(r));
    const last = rows.map((r) => r.getBoundingClientRect());
    rows.forEach((r, i) => {
      const dx = first[i].left - last[i].left;
      const dy = first[i].top - last[i].top;
      if (!dx && !dy) return;
      r.style.transition = 'none';
      r.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        r.style.transition = 'transform .75s cubic-bezier(.16,.84,.44,1)';
        r.style.transform = '';
      });
    });
  },
};

function launchProject(url, title) {
  const overlay = $('#launch-overlay');
  const titleEl = $('#launch-title');
  titleEl.textContent = 'ENTERING ' + title.toUpperCase() + '…';
  overlay.classList.add('active');
  const delay = reduceMotion ? 60 : 480;
  setTimeout(() => {
    window.open(url, '_blank', 'noopener');
    setTimeout(() => overlay.classList.remove('active'), 260);
  }, delay);
}

/* ========================================================================= MAGNETIC + SKILLS + REVEAL */
function initMagnetic() {
  if (!isFinePointer || reduceMotion) return;
  $$('[data-magnetic], #shuffle-btn, .closing-links a').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

function initSkillOrbit() {
  const items = $$('#skill-index li');
  const blurb = $('#skill-blurb');
  items.forEach((li) => {
    const show = () => {
      items.forEach((o) => o.classList.remove('active'));
      li.classList.add('active');
      blurb.textContent = li.dataset.blurb;
      blurb.classList.add('visible');
    };
    li.addEventListener('mouseenter', show);
    li.addEventListener('click', show);
    li.addEventListener('focus', show);
  });
}

function initReveal() {
  const targets = $$('.about-block, .closing, .worlds-head');
  targets.forEach((t) => t.setAttribute('data-reveal', ''));
  if (!('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('revealed')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  targets.forEach((t) => io.observe(t));
}

/* ========================================================================= EASTER ENGINE */
const EasterEngine = {
  init() {
    const name = $('.hero-name');
    let clicks = 0, clickTimer;
    name.addEventListener('dblclick', () => this.altState());

    const portrait = $('#hero-portrait');
    let pressTimer;
    const startPress = () => { pressTimer = setTimeout(() => portrait.classList.add('pulse'), 550); };
    const endPress = () => { clearTimeout(pressTimer); setTimeout(() => portrait.classList.remove('pulse'), 900); };
    portrait.addEventListener('mousedown', startPress);
    portrait.addEventListener('touchstart', startPress, { passive: true });
    ['mouseup', 'mouseleave', 'touchend'].forEach((ev) => portrait.addEventListener(ev, endPress));

    document.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey && document.activeElement.tagName !== 'INPUT') {
        portrait.classList.add('pulse');
        setTimeout(() => portrait.classList.remove('pulse'), 700);
      }
    });
  },
  altState() {
    if (Reality.theme !== 'luxury') return;
    const root = document.documentElement.style;
    const prev = getVar('--environment-glow');
    const alt = prev.split(',').reverse().join(',');
    root.setProperty('--environment-glow', alt);
    setTimeout(() => ThemeEngine.apply(Reality.phase, Reality.weather), 1800);
  },
  lightning() {
    if (reduceMotion) return;
    const flash = $('#lightning-flash');
    const strike = () => { flash.classList.remove('flash'); void flash.offsetWidth; flash.classList.add('flash'); };
    strike();
    setTimeout(strike, 4000 + Math.random() * 6000);
  },
};

/* ========================================================================= SYSTEM MOTION FLAG */
function updateMotionStatus() {
  const el = $('#sys-motion');
  if (el) el.textContent = reduceMotion ? 'REDUCED' : 'ACTIVE';
}

/* ========================================================================= INIT */
document.addEventListener('DOMContentLoaded', () => {
  $('#year') && ($('#year').textContent = new Date().getFullYear());

  BootEngine.init();
  ThemeSystem.init();
  if (Reality.theme === 'luxury') ThemeEngine.apply(Reality.phase, Reality.weather);
  TimeEngine.init();
  ParticleEngine.init();
  GlyphEngine.init();
  CursorEngine.init();
  NavigationEngine.init();
  PortalEngine.init();
  initMagnetic();
  initSkillOrbit();
  initReveal();
  EasterEngine.init();
  updateMotionStatus();
  WeatherEngine.init();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}
