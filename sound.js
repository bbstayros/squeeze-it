// sound.js — Minimal, high-quality WebAudio sound system

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.fxGain = null;
    this.musicGain = null;

    this.enabled = true;
    this.unlocked = false;

    this.buffers = new Map();
    this.activeAmbient = null;

    this._lastTapTs = 0; // optional anti-spam
  }

  // Call once early (but audio will only work after unlock on user gesture)
  init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      console.warn("WebAudio not supported");
      return false;
    }

    this.ctx = new AudioCtx();

    // Master chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.9;

    this.fxGain = this.ctx.createGain();
    this.fxGain.gain.value = 0.9;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.25;

    // Subtle dynamics to avoid harsh peaks on mobile speakers
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    this.fxGain.connect(compressor);
    this.musicGain.connect(compressor);
    compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    return true;
  }

  // Must be triggered by user gesture (pointerdown/touchstart/click)
  async unlock() {
    if (!this.ctx) this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }

    // iOS Safari “unlock” trick: play a silent buffer
    const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.masterGain);
    src.start(0);

    this.unlocked = true;
    return true;
  }

  setEnabled(isOn) {
    this.enabled = !!isOn;

    // Hard mute by master gain (keeps nodes alive)
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.9 : 0.0001, this.ctx.currentTime, 0.015);
    }

    // Stop ambient when disabling
    if (!this.enabled) this.stopAmbient();
  }

  isEnabled() {
    return this.enabled;
  }

  // Load audio files into AudioBuffers
  async load(name, url) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    this.buffers.set(name, buf);
  }

  async loadAll(manifest) {
    // manifest: [{name, url}, ...]
    const tasks = manifest.map(x => this.load(x.name, x.url));
    await Promise.all(tasks);
  }

  _playBuffer(name, { volume = 1, rate = 1, when = 0, bus = "fx" } = {}) {
    if (!this.enabled || !this.unlocked || !this.ctx) return;
    const buf = this.buffers.get(name);
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const g = this.ctx.createGain();
    g.gain.value = Math.max(0, volume);

    if (bus === "music") {
      src.connect(g);
      g.connect(this.musicGain);
    } else {
      src.connect(g);
      g.connect(this.fxGain);
    }

    src.start(this.ctx.currentTime + when);
    return src;
  }

  // ---------- SFX API ----------
  tap(intensity01 = 0.5) {
    // Optional: avoid machine-gun if pointer events fire too fast
    const now = performance.now();
    if (now - this._lastTapTs < 12) return;
    this._lastTapTs = now;

    // Small pitch randomization = “juicy” feel without being noisy
    const rate = 0.96 + Math.random() * 0.10;
    const vol = 0.30 + intensity01 * 0.35;
    this._playBuffer("tap", { volume: vol, rate, bus: "fx" });
  }

  combo(comboCount) {
    // Escalation: higher combo -> slightly higher pitch + volume
    const capped = Math.min(comboCount, 20);
    const rate = 1.0 + capped * 0.015;
    const vol = 0.25 + capped * 0.02;
    this._playBuffer("combo", { volume: Math.min(vol, 0.75), rate, bus: "fx" });
  }

  milestoneClaim(tier = "common") {
    // tiers: common/rare/epic -> choose different buffers or change pitch
    if (this.buffers.has(`claim_${tier}`)) {
      this._playBuffer(`claim_${tier}`, { volume: 0.75, rate: 1.0, bus: "fx" });
    } else {
      // fallback on generic claim with small tier flavor
      const rate = tier === "epic" ? 1.08 : tier === "rare" ? 1.04 : 1.0;
      this._playBuffer("claim", { volume: 0.75, rate, bus: "fx" });
    }
  }

  levelUp() {
    this._playBuffer("levelup", { volume: 0.9, rate: 1.0, bus: "fx" });
  }

  // ---------- Ambient ----------
  startAmbient() {
    if (!this.enabled || !this.unlocked || !this.ctx) return;
    if (this.activeAmbient) return;

    // looped buffer
    const buf = this.buffers.get("ambient");
    if (!buf) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const g = this.ctx.createGain();
    g.gain.value = 0.0; // fade in

    src.connect(g);
    g.connect(this.musicGain);

    src.start();

    // gentle fade in
    g.gain.setTargetAtTime(0.38, this.ctx.currentTime, 0.8);

    this.activeAmbient = { src, gain: g };
  }

  stopAmbient() {
    if (!this.activeAmbient || !this.ctx) return;

    const { src, gain } = this.activeAmbient;

    // fade out then stop
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.35);
    try {
      src.stop(this.ctx.currentTime + 0.5);
    } catch {}
    this.activeAmbient = null;
  }
}
