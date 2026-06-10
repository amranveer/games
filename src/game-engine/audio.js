class HTML5AudioPool {
  constructor(url, size = 4) {
    this.url = url;
    this.size = size;
    this.pool = [];
    this.index = 0;
  }

  init(container) {
    if (typeof window === "undefined") return;
    this.pool = [];
    for (let i = 0; i < this.size; i++) {
      const audio = new Audio();
      audio.src = this.url;
      audio.preload = "auto";
      container.appendChild(audio);
      this.pool.push(audio);
    }
  }

  unlock() {
    this.pool.forEach(audio => {
      try {
        const p = audio.play();
        if (p && typeof p.then === "function") {
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
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.catch(e => console.warn("HTML5 play deferred:", e));
      }
      this.index = (this.index + 1) % this.size;
    } catch (e) {
      console.warn("HTML5 play failed:", e);
    }
  }
}

class FissionAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buffers = {};
    this.rawBuffers = {};
    
    // HTML5 fallback pools
    this.useHTML5 = false;
    this.pools = {};
    
    this.initLog = "await_init";
    this.initError = "";
  }

  // Pre-fetch MP3 files immediately when this module is imported on the client side
  async prefetchSounds() {
    if (typeof window === "undefined") return;
    const sounds = {
      shoot: "/sounds/shoot.mp3",
      hit: "/sounds/hit.mp3",
      bounce: "/sounds/bounce.mp3",
      fission: "/sounds/fission.mp3",
      register: "/sounds/register.mp3"
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

  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }

    if (this.ctx) {
      this.initLog += "ctx_already_exists ";
      this.resumeCtx();
      return;
    }

    try {
      this.initLog += `proto:${window.location.protocol} `;
      this.initLog += `has_AC:${typeof window.AudioContext !== "undefined" ? "yes" : "no"} `;
      this.initLog += `has_wAC:${typeof window.webkitAudioContext !== "undefined" ? "yes" : "no"} `;
      this.initLog += `ua:${navigator.userAgent.substring(0, 30)} `;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.initError = "Web Audio API disabled by browser security (Lockdown Mode)";
        this.initLog += "unsupported_browser (Lockdown Mode fallback activated) ";
        this.useHTML5 = true;
        this.initHTML5Pools();
        return;
      }

      this.ctx = new AudioContextClass();
      this.initLog += "context_created ";
      
      // Decode all pre-fetched ArrayBuffers immediately
      for (const [name, rawBuffer] of Object.entries(this.rawBuffers)) {
        try {
          const slice = rawBuffer.slice(0);
          this.ctx.decodeAudioData(slice, (decoded) => {
            this.buffers[name] = decoded;
          }, (err) => {
            console.warn(`Failed to decode ${name}:`, err);
          });
        } catch (e) {
          console.warn(`Error scheduling decode for ${name}:`, e);
        }
      }

      this.resumeCtx();

      // Warm up the hardware audio graph with a silent 1-sample buffer play
      try {
        const warmupBuffer = this.ctx.createBuffer(1, 1, 22050);
        const warmupSource = this.ctx.createBufferSource();
        warmupSource.buffer = warmupBuffer;
        warmupSource.connect(this.ctx.destination);
        warmupSource.start(0);
        this.initLog += "warmup_ok ";
      } catch (e) {
        this.initLog += `warmup_err:${e.message || e} `;
      }
    } catch (e) {
      this.initError = e.message || String(e);
      this.initLog += `init_err:${this.initError} `;
      this.useHTML5 = true;
      this.initHTML5Pools();
    }
  }

  initHTML5Pools() {
    try {
      let container = document.getElementById("html5-audio-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "html5-audio-container";
        container.style.position = "absolute";
        container.style.width = "0px";
        container.style.height = "0px";
        container.style.opacity = "0.01";
        container.style.pointerEvents = "none";
        container.style.overflow = "hidden";
        document.body.appendChild(container);
      }

      const sounds = {
        shoot: "/sounds/shoot.mp3",
        hit: "/sounds/hit.mp3",
        bounce: "/sounds/bounce.mp3",
        fission: "/sounds/fission.mp3",
        register: "/sounds/register.mp3"
      };

      for (const [name, url] of Object.entries(sounds)) {
        if (!this.pools[name]) {
          const poolSize = name === "bounce" ? 6 : (name === "hit" ? 4 : 3);
          const pool = new HTML5AudioPool(url, poolSize);
          pool.init(container);
          pool.unlock();
          this.pools[name] = pool;
        } else {
          this.pools[name].unlock();
        }
      }
      this.initLog += "html5_pools_unlocked ";
    } catch (e) {
      this.initLog += `html5_err:${e.message || e} `;
    }
  }

  resumeCtx() {
    if (this.ctx && (this.ctx.state === "suspended" || this.ctx.state === "interrupted")) {
      this.ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }
  }

  setMute(mute) {
    this.muted = mute;
  }

  triggerHaptic(pattern) {
    if (this.muted) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  playSound(name) {
    if (this.muted) return;

    // Use Web Audio API if supported and not in fallback mode
    if (!this.useHTML5 && this.ctx) {
      this.resumeCtx();
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
      }
    }

    // Otherwise use standard HTML5 Audio pool playing static MP3 files
    if (this.pools[name]) {
      this.pools[name].play();
    }
  }

  playShoot() {
    this.triggerHaptic(12);
    this.playSound("shoot");
  }

  playHit() {
    this.triggerHaptic(28);
    this.playSound("hit");
  }

  playBounce() {
    this.triggerHaptic(5);
    this.playSound("bounce");
  }

  playFission() {
    this.triggerHaptic([60, 40, 100]);
    this.playSound("fission");
  }

  playRegister() {
    this.triggerHaptic(15);
    this.playSound("register");
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
