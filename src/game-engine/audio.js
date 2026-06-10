class PlinkoAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    
    // Background ambient pad nodes
    this.ambientGain = null;
    this.ambientFilter = null;
    this.ambOsc1 = null;
    this.ambOsc2 = null;

    // Pentatonic scale: C4, D4, E4, G4, A4, C5, D5, E5, G5, A5, C6, D6, E6
    this.scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Start the background cosmic synth pad
      this.startAmbientPad();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  setMute(mute) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      const targetGain = mute ? 0 : 0.45;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.1);
    }
  }

  // Create and play a background detuned analog synthesizer pad
  startAmbientPad() {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    
    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = "lowpass";
    this.ambientFilter.frequency.setValueAtTime(180, t); // deep muffled cutoff

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(0.06, t); // soft volume

    // Low C2 and G2 detuned sawtooths
    this.ambOsc1 = this.ctx.createOscillator();
    this.ambOsc1.type = "sawtooth";
    this.ambOsc1.frequency.setValueAtTime(65.41, t); // C2
    this.ambOsc1.detune.setValueAtTime(-8, t); // detuned

    this.ambOsc2 = this.ctx.createOscillator();
    this.ambOsc2.type = "sawtooth";
    this.ambOsc2.frequency.setValueAtTime(98.00, t); // G2
    this.ambOsc2.detune.setValueAtTime(8, t); // detuned

    this.ambOsc1.connect(this.ambientFilter);
    this.ambOsc2.connect(this.ambientFilter);
    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambOsc1.start(t);
    this.ambOsc2.start(t);
  }

  // Dynamically filter background pad based on number of active balls on screen
  updateAmbientPad(activeOrbsCount) {
    if (!this.ctx || !this.ambientFilter || !this.ambientGain) return;
    
    const t = this.ctx.currentTime;
    
    // As action increases, filter opens up (higher cut) and volume swells
    const targetCutoff = 180 + Math.min(activeOrbsCount * 35, 450);
    const targetVol = 0.06 + Math.min(activeOrbsCount * 0.015, 0.08);

    this.ambientFilter.frequency.setValueAtTime(this.ambientFilter.frequency.value, t);
    this.ambientFilter.frequency.exponentialRampToValueAtTime(targetCutoff, t + 0.15);

    this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, t);
    this.ambientGain.gain.linearRampToValueAtTime(targetVol, t + 0.15);
  }

  // Standard peg bounce note (tuned for richer metallic/glassy chimes)
  playBounce(combo = 0) {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    const noteIndex = combo % this.scale.length;
    const freq = this.scale[noteIndex];
    
    // Fundamental note
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(freq, t);
    
    // High-pitched harmonic for metallic strike impact
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 3.01, t); // detuned third harmonic

    // Envelopes
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.06, t + 0.003);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.22); // longer decay for chime resonance

    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.03, t + 0.001);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.04); // very rapid decay for impact strike

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(120, t); // filter out low rumble

    osc1.connect(gain1);
    osc2.connect(gain2);
    
    gain1.connect(filter);
    gain2.connect(filter);
    filter.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    
    osc1.stop(t + 0.3);
    osc2.stop(t + 0.15);
  }

  // Splitter duplication bubble sweep
  playSplit() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.09);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // Fire peg ignition burst
  playFireIgnite() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Crackling frequency sweeps
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.12);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, t);
    filter.Q.setValueAtTime(3, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  // Ice peg freeze cracking sound
  playIceFreeze() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    // High-pitched glass chime
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(2200, t);
    osc1.frequency.linearRampToValueAtTime(2900, t + 0.06);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(3100, t);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc1.stop(t + 0.16);
    osc2.start(t);
    osc2.stop(t + 0.16);
  }

  // Lightning electric discharge zap
  playLightningZap() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "square";
    // rapid jitter sweep
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.linearRampToValueAtTime(200, t + 0.05);

    filter.type = "highpass";
    filter.frequency.setValueAtTime(800, t);

    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Gold upgrade sound
  playRegister() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(987.77, t);
    osc1.frequency.setValueAtTime(1318.51, t + 0.07);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, t);
    osc2.frequency.setValueAtTime(1567.98, t + 0.07);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc1.stop(t + 0.24);
    osc2.start(t);
    osc2.stop(t + 0.24);
  }

  // Major chord arpeggio for jackpot (boosted with deep sub-bass impact)
  playJackpot() {
    this.init();
    if (!this.ctx || this.muted) return;

    const t = this.ctx.currentTime;
    
    // 1. Deep Sub-bass Drop
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(90, t);
    subOsc.frequency.exponentialRampToValueAtTime(45, t + 0.18); // pitch sweep down
    
    subGain.gain.setValueAtTime(0.25, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25); // quick bass envelope
    
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    
    subOsc.start(t);
    subOsc.stop(t + 0.3);

    // 2. High Arpeggio Chords
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const delay = idx * 0.05;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.07, t + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.35); // longer resonance

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + delay);
      osc.stop(t + delay + 0.4);
    });
  }
}

const audioInstance = typeof window !== "undefined" ? new PlinkoAudio() : {
  init: () => {},
  setMute: () => {},
  updateAmbientPad: () => {},
  playBounce: () => {},
  playSplit: () => {},
  playFireIgnite: () => {},
  playIceFreeze: () => {},
  playLightningZap: () => {},
  playRegister: () => {},
  playJackpot: () => {},
};

export default audioInstance;
