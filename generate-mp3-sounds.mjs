import fs from "fs";
import path from "path";
import * as lamejs from "@breezystack/lamejs";

function generateMp3(sampleRate, duration, filename, synthFn) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Int16Array(numSamples);

  // Generate samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = synthFn(t, duration);
    const intVal = Math.floor(sampleVal * 32767);
    samples[i] = Math.max(-32768, Math.min(32767, intVal));
  }

  // Encode with lamejs (Mono, 1 channel)
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Data = [];

  const mp3buf = encoder.encodeBuffer(samples);
  if (mp3buf.length > 0) {
    mp3Data.push(Buffer.from(mp3buf));
  }
  
  const flushBuf = encoder.flush();
  if (flushBuf.length > 0) {
    mp3Data.push(Buffer.from(flushBuf));
  }

  const finalBuffer = Buffer.concat(mp3Data);
  const outputDir = "./public/sounds";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, filename), finalBuffer);
  console.log(`Generated ${filename} (${finalBuffer.length} bytes)`);
}

const sampleRate = 44100; // Standard CD quality for MP3 compatibility

// 1. Shoot Sound
let shootPhase = 0;
generateMp3(sampleRate, 0.16, "shoot.mp3", (t, dur) => {
  const progress = t / dur;
  const freq = 360 - progress * (360 - 45);
  shootPhase += freq * (1 / sampleRate);
  const wave = (shootPhase % 1) * 2 - 1;
  const gain = 0.08 * (1 - progress);
  return wave * gain;
});

// 2. Hit Sound
let hitPhase = 0;
generateMp3(sampleRate, 0.14, "hit.mp3", (t, dur) => {
  const progress = t / dur;
  const freq = 680 - progress * (680 - 180);
  hitPhase += freq * (1 / sampleRate);
  const wave = Math.abs((hitPhase % 1) * 4 - 2) - 1;
  const gain = 0.12 * (1 - progress);
  return wave * gain;
});

// 3. Bounce Sound
generateMp3(sampleRate, 0.04, "bounce.mp3", (t, dur) => {
  const progress = t / dur;
  const wave = Math.sin(2 * Math.PI * 1600 * t);
  const gain = 0.04 * (1 - progress);
  return wave * gain;
});

// 4. Fission Sound
let fissionBoomPhase = 0;
let noisePrev = 0;
generateMp3(sampleRate, 0.45, "fission.mp3", (t, dur) => {
  const progress = t / dur;
  const boomFreq = 100 - progress * (100 - 20);
  fissionBoomPhase += boomFreq * (1 / sampleRate);
  const boomWave = Math.sin(2 * Math.PI * fissionBoomPhase);
  const boomGain = 0.25 * (1 - progress);

  const whiteNoise = Math.random() * 2 - 1;
  const cutoff = 800 - progress * (800 - 150);
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);
  noisePrev = noisePrev + alpha * (whiteNoise - noisePrev);
  const noiseGain = 0.12 * (1 - progress);

  return (boomWave * boomGain) + (noisePrev * noiseGain);
});

// 5. Register Sound
generateMp3(sampleRate, 0.22, "register.mp3", (t, dur) => {
  const progress = t / dur;
  const isSecondPart = t >= 0.06;
  const f1 = isSecondPart ? 1318.51 : 987.77;
  const f2 = isSecondPart ? 1567.98 : 1174.66;
  const wave = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.5;
  const gain = 0.08 * (1 - progress);
  return wave * gain;
});
