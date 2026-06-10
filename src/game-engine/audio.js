class HTML5AudioPool {
  constructor(name, size = 4) {
    this.name = name;
    this.size = size;
    this.pool = [];
  }

  init() {
    if (typeof window === "undefined") return;
    this.pool = [];
    for (let i = 0; i < this.size; i++) {
      const audio = document.getElementById(`audio-${this.name}-${i}`);
      if (audio) {
        this.pool.push(audio);
      }
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
      // Find the first idle (paused or ended) audio channel
      const audio = this.pool.find(a => a.paused || a.ended);
      if (audio) {
        const p = audio.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {});
        }
      }
    } catch (e) {
      console.warn(`HTML5 play failed for ${this.name}:`, e);
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
    // Sound elements are rendered statically in the HTML DOM, so no-op.
  }

  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }

    try {
      const soundConfig = {
        shoot: 3,
        hit: 4,
        bounce: 6,
        fission: 2,
        register: 2
      };

      // Find and unlock each statically declared sound pool
      for (const [name, poolSize] of Object.entries(soundConfig)) {
        if (!this.pools[name]) {
          const pool = new HTML5AudioPool(name, poolSize);
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
