class FissionAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.iosHapticCallback = null;
  }

  init() {
    if (typeof window === "undefined") return;
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setMute(mute) {
    this.muted = mute;
  }

  triggerHaptic(pattern) {
    if (this.muted) return;
    
    // 1. Standard Vibration API
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
        return;
      } catch (e) {
        // Safe silent fail
      }
    }

    // 2. iOS Safari Workaround Callback
    if (typeof window !== "undefined" && this.iosHapticCallback) {
      try {
        this.iosHapticCallback(pattern);
      } catch (e) {
        // Safe silent fail
      }
    }
  }

  resumeCtx() {
    this.init();
    if (this.ctx && (this.ctx.state === "suspended" || this.ctx.state === "interrupted")) {
      this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext:", e));
    }
  }

  playShoot() {
    this.triggerHaptic(12);
    this.resumeCtx();
    if (!this.ctx || this.muted) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      // Deep energy charge & release zap
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.linearRampToValueAtTime(45, t + 0.16);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.16);

      osc.start();
      osc.stop(t + 0.16);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  playHit() {
    this.triggerHaptic(28);
    this.resumeCtx();
    if (!this.ctx || this.muted) return;

    try {
      const t = this.ctx.currentTime;
      // Snappy metallic click + electronic pitch drop
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
      console.warn("Audio play failed:", e);
    }
  }

  playBounce() {
    this.triggerHaptic(5);
    this.resumeCtx();
    if (!this.ctx || this.muted) return;

    try {
      const t = this.ctx.currentTime;
      // Tiny, bright crystal reflection chime
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
      console.warn("Audio play failed:", e);
    }
  }

  playFission() {
    this.triggerHaptic([60, 40, 100]);
    this.resumeCtx();
    if (!this.ctx || this.muted) return;

    try {
      const t = this.ctx.currentTime;
      // 1. Deep low-frequency sub-bass boom
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

      // 2. High-pass crackling sound effect using noise buffer
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(150, t + 0.35);

      const noiseGain = this.ctx.createGain();
      noiseGain.connect(this.ctx.destination);
      noiseGain.gain.setValueAtTime(0.12, t);
      noiseGain.gain.linearRampToValueAtTime(0, t + 0.35);

      noise.connect(filter);
      filter.connect(noiseGain);

      noise.start();
      noise.stop(t + 0.35);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  }

  // Alchemical register / store click
  playRegister() {
    this.triggerHaptic(15);
    this.resumeCtx();
    if (!this.ctx || this.muted) return;

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
      console.warn("Audio play failed:", e);
    }
  }

  // Interfaces map to keep compatibility with other files calling old names
  playBouncePeg() { this.playBounce(); }
  playSplit() { this.playFission(); }
  playFireIgnite() { this.playHit(); }
  playIceFreeze() { this.playHit(); }
  playLightningZap() { this.playHit(); }
  playJackpot() { this.playRegister(); }
  updateAmbientPad() {}
}

const audioInstance = new FissionAudio();
export default audioInstance;
