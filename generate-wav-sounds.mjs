import fs from "fs";
import path from "path";

function createWavBuffer(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + samples.length * 2, true); // chunk size
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, 1, true); // channels (1 = Mono)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align (channels * bitsPerSample / 8)
  view.setUint16(34, 16, true); // bits per sample (16-bit)

  // data sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, samples.length * 2, true); // data chunk size

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return Buffer.from(buffer);
}

function generateWav(sampleRate, duration, filename, synthFn) {
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Int16Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = synthFn(t, duration);
    const intVal = Math.floor(sampleVal * 32767);
    samples[i] = Math.max(-32768, Math.min(32767, intVal));
  }

  const wavBuffer = createWavBuffer(samples, sampleRate);
  const outputDir = "./public/sounds";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, filename), wavBuffer);
  console.log(`Generated ${filename} (${wavBuffer.length} bytes)`);
  return wavBuffer.toString("base64");
}

const sampleRate = 22050; // 22050Hz is perfect for retro arcade effects, halving space and load times
const base64Data = {};

// 1. Shoot Sound
let shootPhase = 0;
base64Data.shoot = "data:audio/wav;base64," + generateWav(sampleRate, 0.16, "shoot.wav", (t, dur) => {
  const progress = t / dur;
  const freq = 360 - progress * (360 - 45);
  shootPhase += freq * (1 / sampleRate);
  const wave = (shootPhase % 1) * 2 - 1;
  const gain = 0.08 * (1 - progress);
  return wave * gain;
});

// 2. Hit Sound
let hitPhase = 0;
base64Data.hit = "data:audio/wav;base64," + generateWav(sampleRate, 0.14, "hit.wav", (t, dur) => {
  const progress = t / dur;
  const freq = 680 - progress * (680 - 180);
  hitPhase += freq * (1 / sampleRate);
  const wave = Math.abs((hitPhase % 1) * 4 - 2) - 1;
  const gain = 0.12 * (1 - progress);
  return wave * gain;
});

// 3. Bounce Sound
base64Data.bounce = "data:audio/wav;base64," + generateWav(sampleRate, 0.04, "bounce.wav", (t, dur) => {
  const progress = t / dur;
  const wave = Math.sin(2 * Math.PI * 1600 * t);
  const gain = 0.04 * (1 - progress);
  return wave * gain;
});

// 4. Fission Sound
let fissionBoomPhase = 0;
let noisePrev = 0;
base64Data.fission = "data:audio/wav;base64," + generateWav(sampleRate, 0.45, "fission.wav", (t, dur) => {
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
base64Data.register = "data:audio/wav;base64," + generateWav(sampleRate, 0.22, "register.wav", (t, dur) => {
  const progress = t / dur;
  const isSecondPart = t >= 0.06;
  const f1 = isSecondPart ? 1318.51 : 987.77;
  const f2 = isSecondPart ? 1567.98 : 1174.66;
  const wave = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.5;
  const gain = 0.08 * (1 - progress);
  return wave * gain;
});

// Write to sound assets file
fs.writeFileSync("./src/game-engine/sound-assets.js", `export const WAV_ASSETS = ${JSON.stringify(base64Data, null, 2)};\n`);
console.log("Written WAV assets to src/game-engine/sound-assets.js");
