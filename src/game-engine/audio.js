class FissionAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.iosHapticCallback = null;
  }

  // ONLY called from window touchend/click unlockAudio handler (a valid iOS gesture).
  // Never call this from physics callbacks, RAF loops, or touchstart handlers.
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
  // All guards check: context must exist AND be running. No init(), no resumeCtx() inside.

  playShoot() {
    this.triggerHaptic(12);
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
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
    }
  }

  playHit() {
    this.triggerHaptic(28);
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
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
    }
  }

  playBounce() {
    this.triggerHaptic(5);
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
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
    }
  }

  playFission() {
    this.triggerHaptic([60, 40, 100]);
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
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
    }
  }

  playRegister() {
    this.triggerHaptic(15);
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
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
