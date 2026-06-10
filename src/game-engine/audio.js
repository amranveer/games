import { MP3_ASSETS } from "./sound-assets";

class HTML5AudioPool {
  constructor(dataUri, size = 3) {
    this.dataUri = dataUri;
    this.size = size;
    this.pool = [];
    this.index = 0;
  }

  init() {
    if (typeof window === "undefined") return;
    this.pool = [];
    for (let i = 0; i < this.size; i++) {
      const audio = new Audio();
      audio.src = this.dataUri;
      audio.preload = "auto";
      // Load into memory
      audio.load();
      this.pool.push(audio);
    }
  }

  unlock() {
    this.pool.forEach(audio => {
      try {
        // Unlock silently by muting before calling play
        audio.muted = true;
        const p = audio.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            audio.pause();
            audio.muted = false;
            audio.currentTime = 0;
          }).catch(() => {
            audio.muted = false;
          });
        } else {
          audio.pause();
          audio.muted = false;
          audio.currentTime = 0;
        }
      } catch (e) {
        audio.muted = false;
      }
    });
  }

  play() {
    if (this.pool.length === 0) return;
    try {
      const audio = this.pool[this.index];
      this.index = (this.index + 1) % this.size;
      
      // Senior Optimization: only seek if the audio is currently playing.
      // If it is paused or has ended, we don't need to seek to 0, avoiding thread-blocking iOS decoder flushes.
      if (!audio.paused && !audio.ended) {
        audio.currentTime = 0;
      }
      
      audio.play().catch(() => {});
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
      // Initialize and unlock each sound pool
      for (const [name, dataUri] of Object.entries(MP3_ASSETS)) {
        if (!this.pools[name]) {
          // Optimized: keep pool size small and lightweight (13 channels total) to avoid memory footprint issues
          const poolSize = name === "bounce" ? 4 : (name === "hit" ? 3 : 2);
          const pool = new HTML5AudioPool(dataUri, poolSize);
          pool.init();
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
    // navigator.vibrate is completely disabled/noop on iOS to prevent main-thread layout hiccups
  }

  playSound(name) {
    if (this.muted) return;
    if (this.pools[name]) {
      this.pools[name].play();
    }
  }

  playShoot() {
    this.playSound("shoot");
  }

  playHit() {
    this.playSound("hit");
  }

  playBounce() {
    this.playSound("bounce");
  }

  playFission() {
    this.playSound("fission");
  }

  playRegister() {
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
