import { project3D } from "./physics";

const RGBA_MAP = {
  "#ffb3ba": "255, 179, 186",
  "#ffdfba": "255, 223, 186",
  "#baffc9": "186, 255, 201",
  "#bae1ff": "186, 225, 255",
  "#e8c4ff": "232, 196, 255",
  "#ffc6ff": "255, 198, 255"
};

const COLOR_SHADES = {
  "#ffb3ba": { light: "#ffeef2", shadow: "#ffa1a8" },
  "#ffdfba": { light: "#fff6eb", shadow: "#ffd09e" },
  "#baffc9": { light: "#f0fff5", shadow: "#a5f0b7" },
  "#bae1ff": { light: "#f0f8ff", shadow: "#9fcfff" },
  "#e8c4ff": { light: "#faf0ff", shadow: "#d2a8ff" },
  "#ffc6ff": { light: "#fff0ff", shadow: "#ffa8ff" }
};

let cachedGrad = null;
let cachedWidth = 0;
let cachedHeight = 0;

// Clear and render the pastel scientific probability background
export function drawProbabilityCloud(ctx, center, time) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // 1. Clean light-pastel grey-blue background
  ctx.fillStyle = "#f4f6f9";
  ctx.fillRect(0, 0, width, height);

  // 2. Soft, subtle central cloud representing probability density
  if (!cachedGrad || cachedWidth !== width || cachedHeight !== height) {
    const baseDim = Math.min(width, height);
    const cloudRad = baseDim * 0.5;
    cachedGrad = ctx.createRadialGradient(center.x, center.y, 20, center.x, center.y, cloudRad);
    cachedGrad.addColorStop(0, "rgba(186, 225, 255, 0.22)");
    cachedGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    cachedWidth = width;
    cachedHeight = height;
  }

  ctx.save();
  ctx.fillStyle = cachedGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// Simple 3D rotation relative to the center
function projectRelative3D(x, y, z, yaw, pitch) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = y * cosP - z1 * sinP;
  const z2 = y * sinP + z1 * cosP;

  return { x: x1, y: y2, z: z2 };
}

const NUCLEON_SEEDS = [
  { x: 0.28, y: 0.2, z: 0.2, type: "proton" },
  { x: -0.28, y: -0.2, z: -0.2, type: "neutron" },
  { x: -0.25, y: 0.25, z: 0.25, type: "proton" },
  { x: 0.25, y: -0.25, z: -0.25, type: "neutron" },
  { x: 0.2, y: -0.2, z: 0.3, type: "proton" },
  { x: -0.2, y: 0.2, z: -0.3, type: "neutron" },
  { x: 0.08, y: 0.28, z: -0.2, type: "neutron" },
  { x: -0.08, y: -0.28, z: 0.2, type: "proton" },
];

// Draw a single cohesive 3D nucleon cluster with an energy envelope background
function drawSingleNucleusCluster(ctx, cx, cy, rad, cameraYaw, cameraPitch, time, isUnstable, unstableFactor = 0, hitsLeft = 1, maxHits = 1) {
  const excitement = (maxHits - hitsLeft) / maxHits;

  // 1. Draw the cohesive binding energy envelope (strong force envelope)
  ctx.save();
  ctx.translate(cx, cy);

  const envGrad = ctx.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
  if (isUnstable) {
    const flashSelect = Math.sin(time * 0.05) > 0;
    if (flashSelect) {
      envGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
      envGrad.addColorStop(0.4, "rgba(0, 242, 254, 0.45)");
      envGrad.addColorStop(1, "rgba(0, 242, 254, 0)");
    } else {
      envGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
      envGrad.addColorStop(0.4, "rgba(255, 0, 127, 0.45)");
      envGrad.addColorStop(1, "rgba(255, 0, 127, 0)");
    }
  } else if (excitement > 0) {
    // Excited state: blend normal pink core with neon magenta excitement border
    envGrad.addColorStop(0, "rgba(255, 238, 242, 0.6)");
    envGrad.addColorStop(0.4, `rgba(255, 179, 186, ${0.3 + excitement * 0.2})`);
    envGrad.addColorStop(0.85, `rgba(255, 0, 127, ${excitement * 0.35})`);
    envGrad.addColorStop(1, "rgba(255, 0, 127, 0)");
  } else {
    envGrad.addColorStop(0, "rgba(255, 238, 242, 0.5)");
    envGrad.addColorStop(0.5, "rgba(255, 179, 186, 0.3)");
    envGrad.addColorStop(1, "rgba(255, 179, 186, 0)");
  }
  ctx.fillStyle = envGrad;
  ctx.beginPath();
  ctx.arc(0, 0, rad, 0, Math.PI * 2);
  ctx.fill();

  // If excited, draw a glowing border ring proportional to excitement
  if (excitement > 0 && !isUnstable) {
    ctx.strokeStyle = `rgba(0, 242, 254, ${excitement * 0.65})`;
    ctx.lineWidth = 1.0 + excitement * 1.5;
    ctx.stroke();
  }
  ctx.restore();

  // 2. Determine how many nucleons to draw based on radius
  let nucleonCount = 4;
  if (rad > 24) nucleonCount = 8;
  else if (rad > 15) nucleonCount = 6;
  else nucleonCount = 4;

  // 3. Project nucleons in 3D
  const projected = [];
  for (let i = 0; i < nucleonCount; i++) {
    const seed = NUCLEON_SEEDS[i % NUCLEON_SEEDS.length];
    
    // Animate orbital jitter/vibration if unstable or excited
    const jitterSpeed = isUnstable ? 0.06 : 0.03;
    const jitterStrength = isUnstable ? 0.08 : (excitement * 0.04);
    const jitter = (isUnstable || excitement > 0) ? Math.sin(time * jitterSpeed + i) * jitterStrength : 0;
    
    // Scale position relative to radius
    const rx = seed.x * rad * (1 + jitter);
    const ry = seed.y * rad * (1 + jitter);
    const rz = seed.z * rad * (1 + jitter);
    
    // Rotate relative to camera
    const rot = projectRelative3D(rx, ry, rz, cameraYaw, cameraPitch);
    projected.push({
      x: cx + rot.x,
      y: cy + rot.y,
      z: rot.z,
      type: seed.type
    });
  }

  // 4. Depth-sort nucleons from back to front (lowest z first)
  projected.sort((a, b) => a.z - b.z);

  // 5. Draw nucleons
  const nRad = rad * 0.42;
  projected.forEach(n => {
    ctx.save();
    ctx.translate(n.x, n.y);

    const highlightX = -nRad * 0.22;
    const highlightY = -nRad * 0.22;

    const grad = ctx.createRadialGradient(highlightX, highlightY, 1, 0, 0, nRad);
    if (isUnstable) {
      if (n.type === "proton") {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#ff007f"); // neon hot pink
        grad.addColorStop(1, "#9c0043");
      } else {
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#00f2fe"); // neon cyan
        grad.addColorStop(1, "#006d77");
      }
    } else {
      if (n.type === "proton") {
        grad.addColorStop(0, "#ffeef2");
        grad.addColorStop(0.5, "#ffb3ba"); // soft pink
        grad.addColorStop(1, "#e5989b");
      } else {
        grad.addColorStop(0, "#e0f7fa");
        grad.addColorStop(0.5, "#bae1ff"); // soft blue
        grad.addColorStop(1, "#8ecae6");
      }
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, nRad, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight overlay
    const specGrad = ctx.createRadialGradient(highlightX * 1.2, highlightY * 1.2, 1, highlightX * 1.2, highlightY * 1.2, nRad * 0.5);
    specGrad.addColorStop(0, "rgba(255, 255, 255, 0.75)");
    specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(0, 0, nRad, 0, Math.PI * 2);
    ctx.fill();

    // Outline
    ctx.strokeStyle = isUnstable ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();
  });
}

// Render the single unified nucleus sphere or a splitting double-lobe mitosis during instability
function renderNucleusCore(ctx, projX, projY, scale, nucleusRadius, cameraYaw, cameraPitch, time, isUnstable, unstableFrames = 0, impactVx = 0, impactVy = 0, hitsLeft = 1, maxHits = 1, wobbleAmp = 0, wobbleAngle = 0, wobblePhase = 0) {
  ctx.save();
  ctx.translate(projX, projY);
  ctx.shadowBlur = 0;

  // Pulse breathing
  const pulseSpeed = isUnstable ? 0.03 : 0.0016;
  const pulseStrength = isUnstable ? 0.08 : 0.02;
  const pulse = 1.0 + pulseStrength * Math.sin(time * pulseSpeed);
  const rad = nucleusRadius * scale * pulse;

  if (rad > 0.1) {
    if (isUnstable) {
      // Progress of split: t goes from 0.0 (just hit) to 1.0 (explodes)
      const t = Math.min(1.0, Math.max(0.0, (36 - unstableFrames) / 36));
      
      // Calculate split axis from impact velocity direction
      const angle = Math.atan2(impactVy || 0, impactVx || 0.1);
      
      // Separate lobes along impact axis
      const sep = rad * 0.95 * t;
      const dx1 = Math.cos(angle) * sep;
      const dy1 = Math.sin(angle) * sep;
      const dx2 = -Math.cos(angle) * sep;
      const dy2 = -Math.sin(angle) * sep;
      
      // Conserve volume: R^3 = 2 * r^3 -> r = R / 1.26
      const lobeRad = rad * (1.0 - 0.21 * t);

      if (lobeRad > 0.1) {
        // 1. Draw connecting plasma neck (electric bridge)
        const neckWidth = lobeRad * (1.0 - t) * 0.95;
        if (neckWidth > 0.5) {
          // Draw a background plasma envelope glow
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(dx1, dy1);
          ctx.lineTo(dx2, dy2);
          ctx.lineWidth = neckWidth * 2.2;
          ctx.lineCap = "round";
          
          const neckGrad = ctx.createLinearGradient(dx1, dy1, dx2, dy2);
          neckGrad.addColorStop(0, "#00f2fe");
          neckGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
          neckGrad.addColorStop(1, "#ff007f");
          ctx.strokeStyle = neckGrad;
          ctx.stroke();
          ctx.restore();

          // Draw crackling lightning arcs
          const segments = 6;
          const dev = neckWidth * 0.45;

          // Cyan crackle
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = neckWidth * 0.75;
          ctx.strokeStyle = "#00f2fe";
          drawLightningArc(ctx, dx1, dy1, dx2, dy2, segments, dev);
          ctx.restore();

          // Inner white hot core filament crackle
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = neckWidth * 0.35;
          ctx.strokeStyle = "#ffffff";
          drawLightningArc(ctx, dx1, dy1, dx2, dy2, segments, dev * 0.7);
          ctx.restore();
        }

        // 2. Draw both splitting lobes as individual 3D nucleon clusters
        drawSingleNucleusCluster(ctx, dx1, dy1, lobeRad, cameraYaw, cameraPitch, time, true, t, 0, 1);
        drawSingleNucleusCluster(ctx, dx2, dy2, lobeRad, cameraYaw, cameraPitch, time, true, t, 0, 1);
      }
    } else {
      // Standard stable 3D nucleon cluster nucleus (with liquid drop wobble deformation)
      const hasWobble = wobbleAmp > 0;
      if (hasWobble) {
        const stretch = 1.0 + wobbleAmp * Math.sin(wobblePhase);
        const squish = 1.0 / stretch;
        ctx.save();
        ctx.rotate(wobbleAngle);
        ctx.scale(stretch, squish);
        ctx.rotate(-wobbleAngle); // unrotate to keep internal coords projected relative to camera yaw/pitch
      }

      drawSingleNucleusCluster(ctx, 0, 0, rad, cameraYaw, cameraPitch, time, false, 0, hitsLeft, maxHits);

      if (hasWobble) {
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function drawLightningArc(ctx, x1, y1, x2, y2, segments, dev) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / dist;
  const py = dx / dist;

  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const envelope = Math.sin(t * Math.PI);
    const offset = (Math.random() - 0.5) * dev * envelope * 2.0;
    ctx.lineTo(cx + px * offset, cy + py * offset);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

// Render a single electron with its 3D projected trail
function renderElectronNode(ctx, el, cameraYaw, cameraPitch, center) {
  // 1. Draw thin, clean desaturated trail matching electron's custom color
  if (el.projTrail && el.projTrail.length > 1) {
    ctx.save();
    ctx.shadowBlur = 0;
    const baseRgba = RGBA_MAP[el.color] || "255, 224, 130";

    ctx.beginPath();
    ctx.moveTo(el.projTrail[0].x, el.projTrail[0].y);
    for (let i = 1; i < el.projTrail.length; i++) {
      ctx.lineTo(el.projTrail[i].x, el.projTrail[i].y);
    }
    ctx.strokeStyle = `rgba(${baseRgba}, 0.28)`;
    ctx.lineWidth = 1.8 * el.scale;
    ctx.stroke();
    ctx.restore();
  }

  // 2. Draw electron sphere
  ctx.save();
  ctx.translate(el.projX, el.projY);
  ctx.shadowBlur = 0;

  const size = 7.0 * el.scale;
  if (size > 0.1) {
    const grad = ctx.createRadialGradient(-size * 0.25, -size * 0.25, 1, 0, 0, size);
    const shades = COLOR_SHADES[el.color] || { light: "#fffde7", shadow: "#ffd54f" };
    grad.addColorStop(0, shades.light);
    grad.addColorStop(0.5, el.color);
    grad.addColorStop(1, shades.shadow);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    // Rim lighting
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Minus symbol (-)
    ctx.fillStyle = "rgba(60, 60, 67, 0.8)";
    ctx.font = `bold ${Math.round(8 * el.scale)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("-", 0, -0.5);
  }

  ctx.restore();
}

// Render a single 3D orbital shell ring line
function drawOrbitShell(ctx, center, r, yaw, pitch, roll, cameraYaw, cameraPitch, strokeStyle, lineDash = [4, 4]) {
  ctx.save();
  ctx.beginPath();
  for (let s = 0; s <= 24; s++) {
    const theta = (s * Math.PI * 2) / 24;
    const px = r * Math.cos(theta);
    const py = r * Math.sin(theta);
    const rotated = applyOrbitRotation(px, py, 0, yaw, pitch, roll);
    // Project using project3D relative to the atom center
    const proj = project3D(rotated.x, rotated.y, rotated.z, cameraYaw, cameraPitch, center.x, center.y);
    if (s === 0) {
      ctx.moveTo(proj.x, proj.y);
    } else {
      ctx.lineTo(proj.x, proj.y);
    }
  }
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1.0;
  if (lineDash) ctx.setLineDash(lineDash);
  ctx.stroke();
  ctx.restore();
}

const GOLDEN_ANGLE = 137.5 * (Math.PI / 180);

function applyOrbitRotation(x, y, z, yaw, pitch, roll) {
  // Rotate Yaw
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  let x1 = x * cosY - z * sinY;
  let z1 = x * sinY + z * cosY;

  // Rotate Pitch
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  let y2 = y * cosP - z1 * sinP;
  let z2 = y * sinP + z1 * cosP;

  // Rotate Roll
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  let x3 = x1 * cosR - y2 * sinR;
  let y3 = x1 * sinR + y2 * cosR;

  return { x: x3, y: y3, z: z2 };
}

// Unified 3D depth-sorted rendering call (painter's algorithm)
export function draw3DAtom(ctx, center, electrons, cameraYaw, cameraPitch, nucleusRadius, time, isUnstable, unstableFrames = 0, impactVx = 0, impactVy = 0, hitsLeft = 1, maxHits = 1, dissolvingRings = [], wobbleAmp = 0, wobbleAngle = 0, wobblePhase = 0) {
  // Draw the active 3D orbital shell rings first (behind/below particles for layering)
  if (!isUnstable) {
    electrons.forEach((el, idx) => {
      const r = nucleusRadius + 14 + idx * 8.5;
      const yaw = idx * GOLDEN_ANGLE;
      const pitch = Math.acos(1 - 2 * (idx + 0.5) / maxHits);
      const roll = (idx * Math.PI) / 4;
      drawOrbitShell(ctx, center, r, yaw, pitch, roll, cameraYaw, cameraPitch, "rgba(0, 242, 254, 0.16)", [4, 4]);
    });

    // Draw dissolving rings (shattering/expanding orbital shells)
    dissolvingRings.forEach(ring => {
      const r = ring.radius * (1.0 + (1.0 - ring.life) * 0.35);
      const idx = ring.idx || 0;
      const yaw = idx * GOLDEN_ANGLE;
      const pitch = Math.acos(1 - 2 * (idx + 0.5) / maxHits);
      const roll = (idx * Math.PI) / 4;
      const opacity = ring.life * 0.5;
      const color = `rgba(255, 0, 127, ${opacity})`;
      drawOrbitShell(ctx, center, r, yaw, pitch, roll, cameraYaw, cameraPitch, color, [8, 6]);
    });
  }

  const renderNodes = [];

  // Add the central nucleus at (0, 0, 0)
  const nucleusProj = project3D(0, 0, 0, cameraYaw, cameraPitch, center.x, center.y);
  renderNodes.push({
    type: "nucleus",
    z: nucleusProj.z,
    projX: nucleusProj.x,
    projY: nucleusProj.y,
    scale: nucleusProj.scale,
    nucleusRadius,
    isUnstable,
    unstableFrames,
    impactVx,
    impactVy,
    hitsLeft,
    maxHits,
    wobbleAmp,
    wobbleAngle,
    wobblePhase
  });

  const colors = ["#ffb3ba", "#ffdfba", "#baffc9", "#bae1ff", "#e8c4ff", "#ffc6ff"];

  // Project and add all electrons
  electrons.forEach((el, idx) => {
    const elProj = project3D(el.x3d, el.y3d, el.z3d, cameraYaw, cameraPitch, center.x, center.y);
    const projTrail = (el.trail || []).map(pt => 
      project3D(pt.x, pt.y, pt.z, cameraYaw, cameraPitch, center.x, center.y)
    );

    const elColor = colors[idx % colors.length];

    renderNodes.push({
      type: "electron",
      z: elProj.z,
      projX: elProj.x,
      projY: elProj.y,
      scale: elProj.scale,
      projTrail,
      color: elColor
    });
  });

  // Depth sort nodes from back to front (Painter's algorithm: draw highest Z first)
  renderNodes.sort((a, b) => b.z - a.z);

  // Render sorted nodes sequentially
  renderNodes.forEach(node => {
    if (node.type === "nucleus") {
      renderNucleusCore(
        ctx,
        node.projX,
        node.projY,
        node.scale,
        node.nucleusRadius,
        cameraYaw,
        cameraPitch,
        time,
        node.isUnstable,
        node.unstableFrames,
        node.impactVx,
        node.impactVy,
        node.hitsLeft,
        node.maxHits,
        node.wobbleAmp,
        node.wobbleAngle,
        node.wobblePhase
      );
    } else {
      renderElectronNode(ctx, node, cameraYaw, cameraPitch, center);
    }
  });
}

// Draw dynamic heavy projectiles and free neutrons
export function drawProjectiles(ctx, projectiles) {
  projectiles.forEach(p => {
    // 1. Draw glowing projectile trail
    if (p.trail && p.trail.length > 1) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      
      const strokeColor = p.isEjectedElectron
        ? "rgba(255, 0, 127, 0.45)"
        : p.isNeutron
        ? "rgba(79, 195, 247, 0.45)"
        : "rgba(255, 112, 67, 0.45)";
        
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = p.isEjectedElectron ? 1.6 : p.isNeutron ? 2.2 : 3.2;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw projectile particle core
    ctx.save();
    if (p.isEjectedElectron) {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#ff007f";
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = p.isNeutron ? "#e0f7fa" : "#ff7043"; // cyan-white vs coral
      ctx.strokeStyle = p.isNeutron ? "#4fc3f7" : "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.isNeutron ? 3.8 : 5.5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

// Draw fission energy sparks
export function drawSparks(ctx, sparks) {
  ctx.save();
  sparks.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.life;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// Draw the dynamic pivoting heavy particle launcher
export function drawLauncher(ctx, x, y, angle, recoil, flashIntensity) {
  const barrelLength = 34;
  const barrelWidth = 12;
  const recoilX = -recoil;

  // 1. Draw the rotatable cannon barrel
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowBlur = 0;

  // Outer Pivot Base Arc
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cannon Cylinder Barrel Rect
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.rect(recoilX, -barrelWidth / 2, barrelLength, barrelWidth);
  ctx.fill();
  ctx.stroke();

  // Metallic Specular Reflection Line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(recoilX + 3, -barrelWidth / 4);
  ctx.lineTo(recoilX + barrelLength - 3, -barrelWidth / 4);
  ctx.stroke();

  // Charged aperture tip
  ctx.fillStyle = "#ff7043"; // orange charging indicator
  ctx.beginPath();
  ctx.arc(recoilX + barrelLength, 0, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // Inner hub dot
  ctx.fillStyle = "rgba(148, 163, 184, 0.65)";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 2. Draw expansion muzzle flash ring if active
  if (flashIntensity > 0.01) {
    ctx.save();
    ctx.translate(x, y);

    // Compute muzzle tip coordinate
    const tipX = (barrelLength - recoil) * Math.cos(angle);
    const tipY = (barrelLength - recoil) * Math.sin(angle);
    ctx.translate(tipX, tipY);

    // Expanding shock ring
    ctx.strokeStyle = `rgba(255, 112, 67, ${flashIntensity * 0.95})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * (1 - flashIntensity + 0.1), 0, Math.PI * 2);
    ctx.stroke();

    // Muzzle glow gradient radial
    const rad = 25 * flashIntensity;
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, rad);
    grad.addColorStop(0, `rgba(255, 112, 67, ${flashIntensity * 0.5})`);
    grad.addColorStop(1, "rgba(255, 112, 67, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// Unused legacy grid guidelines
export function draw3DShells(ctx, center, cameraYaw, cameraPitch) {
  return [];
}
export function draw3DNucleus(ctx, center, nucleons, cameraYaw, cameraPitch, time) {
  return [];
}
export function draw3DElectrons(ctx, center, electrons, cameraYaw, cameraPitch, projectedNucleons, time) {
  return [];
}
