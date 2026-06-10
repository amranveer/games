function generateWavDataUri(sampleRate, duration, synthFn) {
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit signed PCM = 2 bytes per sample
  const buffer = new Uint8Array(44 + dataSize);

  // RIFF header
  buffer[0] = 0x52; buffer[1] = 0x49; buffer[2] = 0x46; buffer[3] = 0x46; // "RIFF"
  const fileLength = 36 + dataSize;
  buffer[4] = fileLength & 0xFF;
  buffer[5] = (fileLength >> 8) & 0xFF;
  buffer[6] = (fileLength >> 16) & 0xFF;
  buffer[7] = (fileLength >> 24) & 0xFF;

  // WAVE identifier
  buffer[8] = 0x57; buffer[9] = 0x41; buffer[10] = 0x56; buffer[11] = 0x45; // "WAVE"

  // FMT sub-chunk
  buffer[12] = 0x66; buffer[13] = 0x6d; buffer[14] = 0x74; buffer[15] = 0x20; // "fmt "
  buffer[16] = 16; buffer[17] = 0; buffer[18] = 0; buffer[19] = 0; // FMT chunk size (16)
  buffer[20] = 1; buffer[21] = 0; // Audio format (1 = PCM)
  buffer[22] = 1; buffer[23] = 0; // Number of channels (1 = Mono)
  buffer[24] = sampleRate & 0xFF;
  buffer[25] = (sampleRate >> 8) & 0xFF;
  buffer[26] = (sampleRate >> 16) & 0xFF;
  buffer[27] = (sampleRate >> 24) & 0xFF;
  const byteRate = sampleRate * 2; // 16-bit = 2 bytes per sample
  buffer[28] = byteRate & 0xFF;
  buffer[29] = (byteRate >> 8) & 0xFF;
  buffer[30] = (byteRate >> 16) & 0xFF;
  buffer[31] = (byteRate >> 24) & 0xFF;
  buffer[32] = 2; buffer[33] = 0; // Block align (2 bytes)
  buffer[34] = 16; buffer[35] = 0; // Bits per sample (16 bits)

  // DATA sub-chunk
  buffer[36] = 0x64; buffer[37] = 0x61; buffer[38] = 0x74; buffer[39] = 0x61; // "data"
  buffer[40] = dataSize & 0xFF;
  buffer[41] = (dataSize >> 8) & 0xFF;
  buffer[42] = (dataSize >> 16) & 0xFF;
  buffer[43] = (dataSize >> 24) & 0xFF;

  // Generate 16-bit samples (little endian signed 16-bit)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = synthFn(t, duration); // Returns value in range [-1, 1]
    
    // Scale to signed 16-bit range: [-32768, 32767]
    const intVal = Math.floor(sampleVal * 32767);
    const clampedVal = Math.max(-32768, Math.min(32767, intVal));
    
    // Convert to 16-bit unsigned (for the byte buffer)
    const uShort = clampedVal < 0 ? clampedVal + 65536 : clampedVal;
    
    const byteIndex = 44 + i * 2;
    buffer[byteIndex] = uShort & 0xFF;
    buffer[byteIndex + 1] = (uShort >> 8) & 0xFF;
  }

  // Convert to Base64
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return "data:audio/wav;base64," + btoa(binary);
}

class AudioPool {
  constructor(dataUri, size = 8) {
    this.dataUri = dataUri;
    this.size = size;
    this.pool = [];
    this.index = 0;
  }

  init() {
    if (typeof window === "undefined" || !this.dataUri) return;
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
      audio.src = this.dataUri;
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
    
    this.shootWav = null;
    this.hitWav = null;
    this.bounceWav = null;
    this.fissionWav = null;
    this.registerWav = null;

    this.shootPool = null;
    this.hitPool = null;
    this.bouncePool = null;
    this.fissionPool = null;
    this.registerPool = null;
  }

  cacheWavs() {
    if (this.wavCached) return;
    try {
      this._shootPhase = 0;
      this.shootWav = generateWavDataUri(22050, 0.16, (t, dur) => {
        const progress = t / dur;
        const freq = 360 - progress * (360 - 45);
        this._shootPhase += freq * (1 / 22050);
        const wave = (this._shootPhase % 1) * 2 - 1;
        const gain = 0.08 * (1 - progress);
        return wave * gain;
      });

      this._hitPhase = 0;
      this.hitWav = generateWavDataUri(22050, 0.14, (t, dur) => {
        const progress = t / dur;
        const freq = 680 - progress * (680 - 180);
        this._hitPhase += freq * (1 / 22050);
        const wave = Math.abs((this._hitPhase % 1) * 4 - 2) - 1;
        const gain = 0.12 * (1 - progress);
        return wave * gain;
      });

      this.bounceWav = generateWavDataUri(22050, 0.04, (t, dur) => {
        const progress = t / dur;
        const wave = Math.sin(2 * Math.PI * 1600 * t);
        const gain = 0.04 * (1 - progress);
        return wave * gain;
      });

      this._fissionBoomPhase = 0;
      this._noisePrev = 0;
      this.fissionWav = generateWavDataUri(22050, 0.45, (t, dur) => {
        const progress = t / dur;
        
        // Boom sub-bass
        const boomFreq = 100 - progress * (100 - 20);
        this._fissionBoomPhase += boomFreq * (1 / 22050);
        const boomWave = Math.sin(2 * Math.PI * this._fissionBoomPhase);
        const boomGain = 0.25 * (1 - progress);
        
        // Noise crackle with a basic lowpass cutoff sweep
        const whiteNoise = Math.random() * 2 - 1;
        const cutoff = 800 - progress * (800 - 150);
        const dt = 1 / 22050;
        const rc = 1 / (2 * Math.PI * cutoff);
        const alpha = dt / (rc + dt);
        this._noisePrev = this._noisePrev + alpha * (whiteNoise - this._noisePrev);
        const noiseGain = 0.12 * (1 - progress);
        
        return (boomWave * boomGain) + (this._noisePrev * noiseGain);
      });

      this.registerWav = generateWavDataUri(22050, 0.22, (t, dur) => {
        const progress = t / dur;
        const isSecondPart = t >= 0.06;
        const f1 = isSecondPart ? 1318.51 : 987.77;
        const f2 = isSecondPart ? 1567.98 : 1174.66;
        
        const wave = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.5;
        const gain = 0.08 * (1 - progress);
        return wave * gain;
      });

      // Initialize audio pools (optimized sizes for iOS Safari concurrency limits)
      this.shootPool = new AudioPool(this.shootWav, 3);
      this.hitPool = new AudioPool(this.hitWav, 4);
      this.bouncePool = new AudioPool(this.bounceWav, 6);
      this.fissionPool = new AudioPool(this.fissionWav, 4);
      this.registerPool = new AudioPool(this.registerWav, 2);

      this.shootPool.init();
      this.hitPool.init();
      this.bouncePool.init();
      this.fissionPool.init();
      this.registerPool.init();

      this.wavCached = true;
    } catch (e) {
      console.warn("WAV synthesis caching failed:", e);
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
