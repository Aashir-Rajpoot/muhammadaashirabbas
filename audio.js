/* audio.js
 * All sound effects are synthesized locally with the Web Audio API.
 * No sound files, no CDN, no copyrighted assets — everything is generated
 * on the fly, so the game works fully offline and stays tiny.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.volume = 0.7;
    this.musicNodes = [];
  }

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  setMuted(m) { this.muted = m; }
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }

  _env(gainNode, attack, decay, peak, t0) {
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  }

  _tone(freq, dur, type, peak, glideTo) {
    const ctx = this.ensureCtx();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    this._env(gain, 0.005, dur, peak * this.volume, t0);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise(dur, peak, filterFreq) {
    const ctx = this.ensureCtx();
    if (!ctx || this.muted) return;
    const t0 = ctx.currentTime;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq || 2000;
    const gain = ctx.createGain();
    this._env(gain, 0.002, dur, peak * this.volume, t0);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  punch() { this._tone(160, 0.08, "square", 0.5, 70); this._noise(0.05, 0.3, 1200); }
  kick() { this._tone(110, 0.1, "square", 0.6, 50); this._noise(0.07, 0.4, 900); }
  hit() { this._noise(0.1, 0.5, 700); this._tone(90, 0.12, "sawtooth", 0.4, 40); }
  block() { this._tone(600, 0.06, "square", 0.35, 800); this._noise(0.04, 0.25, 3000); }
  jump() { this._tone(300, 0.15, "sine", 0.3, 500); }
  land() { this._noise(0.06, 0.3, 500); }
  dash() { this._tone(400, 0.15, "sawtooth", 0.25, 900); }
  special() { this._tone(220, 0.3, "sawtooth", 0.4, 660); this._noise(0.2, 0.2, 2500); }
  ultimate() { this._tone(120, 0.6, "sawtooth", 0.55, 900); this._noise(0.4, 0.35, 4000); }
  ko() { this._tone(200, 0.5, "square", 0.5, 40); }
  menu() { this._tone(500, 0.06, "square", 0.3, 700); }
  confirm() { this._tone(400, 0.1, "square", 0.35, 900); }
  victory() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, "square", 0.35), i * 110));
  }
  defeat() {
    [400, 320, 260, 180].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, "sawtooth", 0.35), i * 130));
  }
}

const AUDIO = new AudioEngine();
