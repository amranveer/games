class AudioPool {
  constructor(srcPath, size = 8) {
    this.srcPath = srcPath;
    this.size = size;
    this.pool = [];
    this.index = 0;
  }

  init() {
    if (typeof window === "undefined" || !this.srcPath) return;
    this.pool = [];

    let container = document.getElementById("audio-fallback-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "audio-fallback-container";
      container.style.position = "absolute";
      container.style.width = "0px";
      container.style.height = "0px";
      container.style.opacity = "0.01";
      container.style.pointerEvents = "none";
      container.style.overflow = "hidden";
      document.body.appendChild(container);
    }

    for (let i = 0; i < this.size; i++) {
      const audio = new Audio();
      audio.src = this.srcPath;
      audio.volume = 1.0;
      audio.preload = "auto";
      audio.load();
      container.appendChild(audio);
      this.pool.push(audio);
    }
  }

  unlock() {
    this.pool.forEach(audio => {
      try {
        const p = audio.play();
        if (p && p.then) {
          p.then(() => {
            audio.pause();
            audio.currentTime = 0;
          }).catch(() => {});
        } else {
          audio.pause();
          audio.currentTime = 0;
        }
      } catch (e) {}
    });
  }

  play() {
    if (this.pool.length === 0) return;
    try {
      const audio = this.pool[this.index];
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.warn("Pool play failed:", e);
        if (typeof window !== "undefined") {
          window.__audio_errors = window.__audio_errors || [];
          const errMsg = e.message || String(e);
          if (!window.__audio_errors.includes(errMsg)) {
            window.__audio_errors.push(errMsg);
          }
        }
      });
      this.index = (this.index + 1) % this.size;
    } catch (e) {
      console.warn("AudioPool play failed:", e);
      if (typeof window !== "undefined") {
        window.__audio_errors = window.__audio_errors || [];
        const errMsg = e.message || String(e);
        if (!window.__audio_errors.includes(errMsg)) {
          window.__audio_errors.push(`catch:${errMsg}`);
        }
      }
    }
  }
}

class FissionAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.iosHapticCallback = null;
    this.wavCached = false;
    this.fallbackUnlocked = false;

    this.shootPool = null;
    this.hitPool = null;
    this.bouncePool = null;
    this.fissionPool = null;
    this.registerPool = null;
  }

  cacheWavs() {
    if (this.wavCached) return;
    try {
      this.shootPool = new AudioPool("/sounds/shoot.wav", 3);
      this.hitPool = new AudioPool("/sounds/hit.wav", 4);
      this.bouncePool = new AudioPool("/sounds/bounce.wav", 6);
      this.fissionPool = new AudioPool("/sounds/fission.wav", 4);
      this.registerPool = new AudioPool("/sounds/register.wav", 2);

      this.shootPool.init();
      this.hitPool.init();
      this.bouncePool.init();
      this.fissionPool.init();
      this.registerPool.init();

      this.wavCached = true;
    } catch (e) {
      console.warn("Audio pool caching failed:", e);
    }
  }

  unlockPools() {
    if (this.muted) return;
    this.initLog += "unlockPools_triggered ";
    try {
      if (this.shootPool) this.shootPool.unlock();
      if (this.hitPool) this.hitPool.unlock();
      if (this.bouncePool) this.bouncePool.unlock();
      if (this.fissionPool) this.fissionPool.unlock();
      if (this.registerPool) this.registerPool.unlock();
      this.fallbackUnlocked = true;
      this.initLog += "unlockPools_ok ";
    } catch (e) {
      this.initLog += `unlockPools_err:${e.message || e} `;
    }
  }

  playWav(pool) {
    if (this.muted || !pool) return;
    pool.play();
  }

  // ONLY called from window touchend/click unlockAudio handler (a valid iOS gesture).
  // Never call this from physics callbacks, RAF loops, or touchstart handlers.
  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }
    
    // Always pre-generate WAV synthesis fallback assets on first gesture
    this.cacheWavs();
    
    if (this.ctx) {
      this.initLog += "ctx_already_exists ";
      return;
    }
    try {
      const AudioContextClass =
        (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
        (typeof globalThis !== "undefined" && (globalThis.AudioContext || globalThis.webkitAudioContext)) ||
        (typeof self !== "undefined" && (self.AudioContext || self.webkitAudioContext));
      
      this.initLog += `class_type:${typeof AudioContextClass} `;
      if (!AudioContextClass) {
        this.initError = "No AudioContext class found";
        this.initLog += "class_not_found ";
        return;
      }
      
      const instance = new AudioContextClass();
      this.initLog += `instantiated_ok(type:${typeof instance}) `;
      if (instance) {
        this.initLog += `instance_state:${instance.state} `;
        this.ctx = instance;
        this.initLog += `assigned_ctx_ok(has_ctx:${this.ctx ? "yes" : "no"}) `;
      } else {
        this.initLog += "instance_falsy ";
      }
    } catch (e) {
      this.initError = e.message || String(e);
      this.initLog += `catch_err:${e.message || String(e)} `;
      console.warn("Web Audio API not supported", e);
    }
  }

  setMute(mute) {
    this.muted = mute;
  }

  triggerHaptic(pattern) {
    if (this.muted) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); return; } catch (e) {}
    }
    if (typeof window !== "undefined" && this.iosHapticCallback) {
      try { this.iosHapticCallback(pattern); } catch (e) {}
    }
  }

  // Resumes a suspended/interrupted context. Does NOT create it.
  resumeCtx() {
    if (this.ctx && (this.ctx.state === "suspended" || this.ctx.state === "interrupted")) {
      this.ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }
  }

  // --- Play methods ---
  // All guards check: context must exist. We call resumeCtx() to ensure it wakes up,
  // and schedule nodes immediately (they will queue and play once resumed).

  playShoot() {
    this.triggerHaptic(12);
    if (this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") {
      this.playWav(this.shootPool);
      if (this.ctx) this.resumeCtx();
      return;
    }
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.linearRampToValueAtTime(45, t + 0.16);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.16);
      osc.start();
      osc.stop(t + 0.16);
    } catch (e) {
      console.warn("playShoot failed:", e);
      this.playWav(this.shootPool);
    }
  }

  playHit() {
    this.triggerHaptic(28);
    if (this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") {
      this.playWav(this.hitPool);
      if (this.ctx) this.resumeCtx();
      return;
    }
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(680, t);
      osc.frequency.linearRampToValueAtTime(180, t + 0.14);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.14);
      osc.start();
      osc.stop(t + 0.14);
    } catch (e) {
      console.warn("playHit failed:", e);
      this.playWav(this.hitPool);
    }
  }

  playBounce() {
    this.triggerHaptic(5);
    if (this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") {
      this.playWav(this.bouncePool);
      if (this.ctx) this.resumeCtx();
      return;
    }
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1600, t);
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.04);
      osc.start();
      osc.stop(t + 0.04);
    } catch (e) {
      console.warn("playBounce failed:", e);
      this.playWav(this.bouncePool);
    }
  }

  playFission() {
    this.triggerHaptic([60, 40, 100]);
    if (this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") {
      this.playWav(this.fissionPool);
      if (this.ctx) this.resumeCtx();
      return;
    }
    try {
      const t = this.ctx.currentTime;

      // Sub-bass boom
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.linearRampToValueAtTime(20, t + 0.45);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.45);
      osc.start();
      osc.stop(t + 0.45);

      // Noise crackle
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(150, t + 0.35);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, t);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.35);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noise.start();
      noise.stop(t + 0.35);
    } catch (e) {
      console.warn("playFission failed:", e);
      this.playWav(this.fissionPool);
    }
  }

  playRegister() {
    this.triggerHaptic(15);
    if (this.muted) return;
    if (!this.ctx || this.ctx.state !== "running") {
      this.playWav(this.registerPool);
      if (this.ctx) this.resumeCtx();
      return;
    }
    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(987.77, t);
      osc1.frequency.setValueAtTime(1318.51, t + 0.06);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1174.66, t);
      osc2.frequency.setValueAtTime(1567.98, t + 0.06);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc1.stop(t + 0.22);
      osc2.start();
      osc2.stop(t + 0.22);
    } catch (e) {
      console.warn("playRegister failed:", e);
      this.playWav(this.registerPool);
    }
  }

  playBouncePeg()   { this.playBounce(); }
  playSplit()       { this.playFission(); }
  playFireIgnite()  { this.playHit(); }
  playIceFreeze()   { this.playHit(); }
  playLightningZap(){ this.playHit(); }
  playJackpot()     { this.playRegister(); }
  updateAmbientPad() {}
}

const audioInstance = new FissionAudio();
export default audioInstance;
