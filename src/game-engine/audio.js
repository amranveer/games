import { MP3_ASSETS } from "./sound-assets";

class HTML5AudioPool {
  constructor(dataUri, size = 8) {
    this.dataUri = dataUri;
    this.size = size;
    this.pool = [];
    this.index = 0;
  }

  init(container) {
    if (typeof window === "undefined") return;
    this.pool = [];
    for (let i = 0; i < this.size; i++) {
      const audio = new Audio();
      audio.src = this.dataUri;
      audio.preload = "auto";
      // Aggressively load into browser memory
      audio.load();
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
      // Find an audio element that is currently paused/idle
      let audio = null;
      for (let i = 0; i < this.size; i++) {
        const checkIndex = (this.index + i) % this.size;
        const candidate = this.pool[checkIndex];
        if (candidate.paused || candidate.ended) {
          audio = candidate;
          this.index = (checkIndex + 1) % this.size;
          break;
        }
      }

      // If all elements in the pool are playing, rotate to the next one
      if (!audio) {
        audio = this.pool[this.index];
        this.index = (this.index + 1) % this.size;
        audio.pause();
        audio.currentTime = 0;
      }

      // Avoid expensive seek flushes on iOS if already at the start
      if (audio.currentTime > 0) {
        audio.currentTime = 0;
      }

      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.catch(() => {});
      }
    } catch (e) {
      console.warn("HTML5 play failed:", e);
    }
  }
}

class FissionAudio {
  constructor() {
    this.muted = false;
    this.pools = {};
    this.initLog = "await_init";
    this.initError = "";
    // Configured to run optimized HTML5 engine exclusively
    this.useHTML5 = true; 
  }

  prefetchSounds() {
    // Sound assets are embedded as Base64 strings, so prefetching is zero-cost/noop.
  }

  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }

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

      // Initialize and unlock each sound pool
      for (const [name, dataUri] of Object.entries(MP3_ASSETS)) {
        if (!this.pools[name]) {
          // Senior Optimization: allocate slightly larger pools for frequent sound types
          const poolSize = name === "bounce" ? 14 : (name === "hit" ? 10 : 6);
          const pool = new HTML5AudioPool(dataUri, poolSize);
          pool.init(container);
          pool.unlock();
          this.pools[name] = pool;
        } else {
          this.pools[name].unlock();
        }
      }

      this.initLog += "html5_pools_unlocked ";
    } catch (e) {
      this.initError = e.message || String(e);
      this.initLog += `init_err:${this.initError} `;
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
