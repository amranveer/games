import fs from "fs";
import path from "path";

const sounds = ["shoot", "hit", "bounce", "fission", "register"];
const output = {};

sounds.forEach(name => {
  const filePath = `./public/sounds/${name}.mp3`;
  if (fs.existsSync(filePath)) {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString("base64");
    output[name] = `data:audio/mp3;base64,${base64}`;
    console.log(`Encoded ${name}.mp3: ${output[name].length} chars`);
  } else {
    console.error(`File not found: ${filePath}`);
  }
});

fs.writeFileSync("./src/game-engine/sound-assets.js", `export const MP3_ASSETS = ${JSON.stringify(output, null, 2)};\n`);
console.log("Written to src/game-engine/sound-assets.js");
