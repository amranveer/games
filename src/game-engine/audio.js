import { MP3_ASSETS } from "./sound-assets";

// Helper to translate Base64 string to a local binary Blob URL
function base64ToBlobUrl(base64Data, contentType = "audio/mp3") {
  if (typeof window === "undefined") return "";
  try {
    const base64Str = base64Data.split(",")[1];
    const byteCharacters = atob(base64Str);
    const sliceSize = 512;
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: contentType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Failed to convert base64 to Blob URL:", e);
    return base64Data; // fallback to raw base64
  }
}

class HTML5AudioPool {
  constructor(blobUrl, size = 4) {
    this.blobUrl = blobUrl;
    this.size = size;
    this.pool = [];
  }

  init() {
    if (typeof window === "undefined" || !this.blobUrl) return;
    this.pool = [];
    for (let i = 0; i < this.size; i++) {
      const audio = new Audio();
      audio.src = this.blobUrl;
      audio.preload = "auto";
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
      // Senior Optimization: Find the first idle (paused or ended) audio channel.
      // We do NOT call currentTime = 0 or pause() here during gameplay.
      // This completely avoids iOS WebKit thread-blocking media decoder flushes.
      // If all channels are currently busy, we drop the playback request to maintain 60fps.
      const audio = this.pool.find(a => a.paused || a.ended);
      if (audio) {
        const p = audio.play();
        if (p && typeof p.then === "function") {
          p.catch(() => {});
        }
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
    this.blobUrls = {};
    this.initLog = "await_init";
    this.initError = "";
    this.useHTML5 = true; 
  }

  prefetchSounds() {
    if (typeof window === "undefined") return;
    
    // Translate Base64 MP3s to local Blob URLs exactly once on startup
    if (Object.keys(this.blobUrls).length === 0) {
      for (const [name, base64] of Object.entries(MP3_ASSETS)) {
        this.blobUrls[name] = base64ToBlobUrl(base64);
      }
    }
  }

  init() {
    this.initLog = "init_start ";
    if (typeof window === "undefined") {
      this.initLog += "window_undef ";
      return;
    }

    try {
      // Ensure blobs are generated
      this.prefetchSounds();

      // Initialize and unlock each sound pool
      for (const [name, blobUrl] of Object.entries(this.blobUrls)) {
        if (!this.pools[name]) {
          // Senior Polyphony Tuning: balanced size to avoid drops without overloading the OS mixer
          const poolSize = name === "bounce" ? 6 : (name === "hit" ? 4 : (name === "shoot" ? 3 : 2));
          const pool = new HTML5AudioPool(blobUrl, poolSize);
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
