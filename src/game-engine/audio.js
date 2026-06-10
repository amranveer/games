class FissionAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buffers = {};
    this.rawBuffers = {};
    this.initLog = "await_init";
    this.initError = "";
  }

  // Pre-fetch array buffers immediately when this module is imported on the client side
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
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.initError = "Web Audio API not supported by browser";
        this.initLog += "unsupported_browser ";
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

  playSound(name) {
    if (this.muted) return;

    if (this.ctx) {
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
      } else if (this.rawBuffers[name]) {
        try {
          const slice = this.rawBuffers[name].slice(0);
          this.ctx.decodeAudioData(slice, (decoded) => {
            this.buffers[name] = decoded;
            try {
              const source = this.ctx.createBufferSource();
              source.buffer = decoded;
              source.connect(this.ctx.destination);
              source.start(0);
            } catch (innerErr) {}
          });
        } catch (e) {}
      } else {
        this.loadAndPlayOnDemand(name, `/sounds/${name}.wav`);
      }
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
