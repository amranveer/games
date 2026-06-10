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

    this.buffers = {};      // Decoded AudioBuffers
    this.rawBuffers = {};   // Raw ArrayBuffers fetched on startup

    this.shootPool = null;
    this.hitPool = null;
    this.bouncePool = null;
    this.fissionPool = null;
    this.registerPool = null;
    this.initLog = "await_init";
  }

  // Pre-fetch the physical files on page load
  async prefetchSounds() {
    if (typeof window === "undefined") return;
    const sounds = {
      shoot: "/sounds/shoot.wav",
      hit: "/sounds/hit.wav",
      bounce: "/sounds/bounce.wav",
      fission: "/sounds/fission.wav",
      register: "/sounds/register.wav"
    };

    for (const [name, url] of Object.entries(sounds)) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          this.rawBuffers[name] = await response.arrayBuffer();
        }
      } catch (e) {
        console.warn(`Failed to prefetch sound ${name}:`, e);
      }
    }
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

  // ONLY called from window touchend/click unlockAudio handler (a valid iOS gesture).
  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }

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

        // Synchronously trigger decoding of pre-fetched ArrayBuffers
        for (const [name, rawBuffer] of Object.entries(this.rawBuffers)) {
          try {
            const slice = rawBuffer.slice(0);
            this.ctx.decodeAudioData(slice, (decoded) => {
              this.buffers[name] = decoded;
            }, (err) => {
              console.warn(`Failed to decode ${name}:`, err);
            });
          } catch (e) {
            console.warn(`Error triggering decoding for ${name}:`, e);
          }
        }
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

  resumeCtx() {
    if (this.ctx && (this.ctx.state === "suspended" || this.ctx.state === "interrupted")) {
      this.ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }
  }

  // Load and play a sound buffer dynamically on-demand
  async loadAndPlayOnDemand(name, url) {
    try {
      const response = await fetch(url);
      const raw = await response.arrayBuffer();
      if (!this.ctx) return;
      this.ctx.decodeAudioData(raw, (decoded) => {
        this.buffers[name] = decoded;
        if (this.ctx) {
          const source = this.ctx.createBufferSource();
          source.buffer = decoded;
          source.connect(this.ctx.destination);
          source.start(0);
        }
      });
    } catch (e) {
      console.warn(`loadAndPlayOnDemand failed for ${name}:`, e);
    }
  }

  // Master play routing helper
  playSound(name, pool) {
    if (this.muted) return;

    if (this.ctx) {
      if (this.ctx.state === "suspended" || this.ctx.state === "interrupted") {
        this.resumeCtx();
      }

      const buffer = this.buffers[name];
      if (buffer) {
        try {
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.ctx.destination);
          source.start(0);
          return;
        } catch (e) {
          console.warn(`Buffer play failed for ${name}:`, e);
        }
      } else if (this.rawBuffers[name]) {
        // Decodes synchronously when available
        try {
          const slice = this.rawBuffers[name].slice(0);
          this.ctx.decodeAudioData(slice, (decoded) => {
            this.buffers[name] = decoded;
            try {
              const source = this.ctx.createBufferSource();
              source.buffer = decoded;
              source.connect(this.ctx.destination);
              source.start(0);
            } catch (inner) {}
          });
          return;
        } catch (e) {}
      } else {
        this.loadAndPlayOnDemand(name, `/sounds/${name}.wav`);
        return;
      }
    }

    if (pool) {
      pool.play();
    }
  }

  playShoot() {
    this.triggerHaptic(12);
    this.playSound("shoot", this.shootPool);
  }

  playHit() {
    this.triggerHaptic(28);
    this.playSound("hit", this.hitPool);
  }

  playBounce() {
    this.triggerHaptic(5);
    this.playSound("bounce", this.bouncePool);
  }

  playFission() {
    this.triggerHaptic([60, 40, 100]);
    this.playSound("fission", this.fissionPool);
  }

  playRegister() {
    this.triggerHaptic(15);
    this.playSound("register", this.registerPool);
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
