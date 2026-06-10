import audioInstance from "./audio";

// 3D Perspective Projection Matrix
export function project3D(x, y, z, yaw, pitch, cx, cy, fov = 650) {
  // Rotate Y
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  // Rotate X
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = y * cosP - z1 * sinP;
  const z2 = y * sinP + z1 * cosP;

  // Perspective scaling
  const scale = fov / (fov + z2);
  return {
    x: cx + x1 * scale,
    y: cy + y2 * scale,
    z: z2,
    scale
  };
}

const GOLDEN_ANGLE = 2.39996; // Golden angle in radians

// Helper to rotate a point on an orbit by the orbit's 3D tilt angles
export function applyOrbitRotation(x, y, z, yaw, pitch, roll) {
  // Yaw (Z)
  let cos = Math.cos(yaw), sin = Math.sin(yaw);
  let x1 = x * cos - y * sin;
  let y1 = x * sin + y * cos;
  let z1 = z;

  // Pitch (X)
  cos = Math.cos(pitch); sin = Math.sin(pitch);
  let x2 = x1;
  let y2 = y1 * cos - z1 * sin;
  let z2 = y1 * sin + z1 * cos;

  // Roll (Y)
  cos = Math.cos(roll); sin = Math.sin(roll);
  let x3 = x2 * cos + z2 * sin;
  let y3 = y2;
  let z3 = -x2 * sin + z2 * cos;

  return { x: x3, y: y3, z: z3 };
}

// Create an atom of a specific fission tier
export function createAtom(x, y, sizeTier) {
  let nucleusRadius = 18;
  let electronCount = 1;
  let maxHits = 1;

  if (sizeTier === "large") {
    nucleusRadius = 46;
    electronCount = 4;
    maxHits = 3;
  } else if (sizeTier === "medium") {
    nucleusRadius = 28;
    electronCount = 2;
    maxHits = 2;
  }

  const electrons = [];
  for (let i = 0; i < electronCount; i++) {
    electrons.push({
      id: `el-${Math.random()}-${i}`,
      trail: []
    });
  }

  return {
    id: `atom-${Math.random()}`,
    x,
    y,
    vx: (Math.random() - 0.5) * 1.6,
    vy: (Math.random() - 0.5) * 1.6,
    sizeTier,
    nucleusRadius,
    electrons,
    cameraYaw: Math.random() * Math.PI * 2,
    cameraPitch: 0.3 + Math.random() * 0.4,
    unstable: false,
    unstableFrames: 0,
    shouldSplit: false,
    shakeX: 0,
    shakeY: 0,
    impactVx: 0,
    impactVy: 0,
    hitX: 0,
    hitY: 0,
    maxHits,
    hitsLeft: maxHits,
    wobbleAmp: 0,
    wobblePhase: 0,
    wobbleAngle: 0
  };
}

// Update all active floating atoms, boundary limits, and orbital electron rings
export function updateGameAtoms(atoms, width, height, time) {
  const timeSec = time * 0.001;
  const localSparks = [];

  atoms.forEach(atom => {
    // Jitter shake coordinates if unstable
    if (atom.unstable) {
      const t = Math.min(1.0, Math.max(0.0, (36 - atom.unstableFrames) / 36));
      // Shake amplitude starts at 2.0 and ramps up to 8.5
      const shakeAmp = 2.0 + t * 6.5;
      atom.shakeX = (Math.random() - 0.5) * shakeAmp;
      atom.shakeY = (Math.random() - 0.5) * shakeAmp;
      atom.unstableFrames--;
      if (atom.unstableFrames <= 0) {
        atom.shouldSplit = true;
      }
    } else if (atom.hitsLeft < atom.maxHits) {
      // Excitement ratio (e.g. 0.33 to 0.67 for a 3-hit atom)
      const excitement = (atom.maxHits - atom.hitsLeft) / atom.maxHits;
      const shakeAmp = excitement * 2.5; // persistent excited vibration
      atom.shakeX = (Math.random() - 0.5) * shakeAmp;
      atom.shakeY = (Math.random() - 0.5) * shakeAmp;
    } else {
      atom.shakeX = 0;
      atom.shakeY = 0;
    }

    // Update liquid drop wobble decay
    if (atom.wobbleAmp > 0) {
      atom.wobblePhase += 0.45;
      atom.wobbleAmp *= 0.88; // dampening
      if (atom.wobbleAmp < 0.01) {
        atom.wobbleAmp = 0;
      }
    }

    // Spawn subatomic excitement evaporation sparks
    if (atom.hitsLeft < atom.maxHits && !atom.unstable) {
      const excitement = (atom.maxHits - atom.hitsLeft) / atom.maxHits;
      if (Math.random() < excitement * 0.18) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * atom.nucleusRadius;
        localSparks.push({
          x: atom.x + Math.cos(angle) * dist,
          y: atom.y + Math.sin(angle) * dist,
          vx: atom.vx + (Math.random() - 0.5) * 0.8,
          vy: atom.vy + (Math.random() - 0.5) * 0.8,
          color: Math.random() > 0.5 ? "#00f2fe" : "#ff007f",
          life: 0.8,
          decay: 0.035,
          radius: 0.8 + Math.random() * 1.2
        });
      }
    }

    // Update dissolving rings
    if (atom.dissolvingRings) {
      atom.dissolvingRings.forEach(ring => {
        ring.life -= ring.decay;
      });
      atom.dissolvingRings = atom.dissolvingRings.filter(ring => ring.life > 0);
    }

    // 1. Move 2D position
    atom.x += atom.vx;
    atom.y += atom.vy;

    // 2. Center gravity pull (keeps the whole structure centered horizontally and vertically)
    const targetCenterX = width / 2;
    const targetCenterY = height / 2;
    const dcx = targetCenterX - atom.x;
    const dcy = targetCenterY - atom.y;
    const distToCenter = Math.sqrt(dcx * dcx + dcy * dcy) || 1;

    // Smooth centering pull (force increases with distance)
    const centerPull = 0.08 * (distToCenter / 100);
    atom.vx += (dcx / distToCenter) * centerPull;
    atom.vy += (dcy / distToCenter) * centerPull;

    // 3. Keep within boundary padding (giving room for electron trails)
    const margin = atom.nucleusRadius + 32;
    if (atom.x < margin) {
      atom.x = margin;
      atom.vx = Math.abs(atom.vx);
    }
    if (atom.x > width - margin) {
      atom.x = width - margin;
      atom.vx = -Math.abs(atom.vx);
    }
    if (atom.y < margin) {
      atom.y = margin;
      atom.vy = Math.abs(atom.vy);
    }
    if (atom.y > height - margin) {
      atom.y = height - margin;
      atom.vy = -Math.abs(atom.vy);
    }

    // 4. Update the 3D circular orbiting electrons
    atom.electrons.forEach((el, idx) => {
      const r = atom.nucleusRadius + 14 + idx * 8.5;
      const speed = 1.0 + (80 / r) * 1.5;
      const angle = timeSec * speed + idx * 1.618;

      const yaw = idx * GOLDEN_ANGLE;
      const pitch = Math.acos(1 - 2 * (idx + 0.5) / atom.electrons.length);
      const roll = (idx * Math.PI) / 4;

      const planeX = r * Math.cos(angle);
      const planeY = r * Math.sin(angle);
      const planeZ = 0;

      const rotated = applyOrbitRotation(planeX, planeY, planeZ, yaw, pitch, roll);
      el.x3d = rotated.x;
      el.y3d = rotated.y;
      el.z3d = rotated.z;
    });

    // 4. Update dynamic camera spin angle
    atom.cameraYaw += 0.005;
  });

  // 5. Apply strong spring attraction forces to fuse atoms into a single ball
  for (let i = 0; i < atoms.length; i++) {
    const a1 = atoms[i];

    // Damping to keep the coalesced compound stable
    a1.vx *= 0.98;
    a1.vy *= 0.98;

    for (let j = i + 1; j < atoms.length; j++) {
      const a2 = atoms[j];
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Allow significant overlapping to make them fuse visually
      const minSolidDist = a1.nucleusRadius + a2.nucleusRadius - 16;
      const repulsionRadius = a1.nucleusRadius + a2.nucleusRadius + 12;

      // Spring-like attraction (stronger as they pull apart)
      const f_attr = 0.08 * (dist / 100);

      // Repulsion active only at very close range
      let f_rep = 0;
      if (dist < repulsionRadius) {
        f_rep = 2.5 * Math.pow(repulsionRadius / dist, 2);
      }

      const force = f_attr - f_rep;
      const ax = (dx / dist) * force * 0.085;
      const ay = (dy / dist) * force * 0.085;

      a1.vx += ax;
      a1.vy += ay;
      a2.vx -= ax;
      a2.vy -= ay;

      // Solid overlapping bounce
      if (dist < minSolidDist) {
        const overlap = minSolidDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        a1.x -= nx * overlap * 0.5;
        a1.y -= ny * overlap * 0.5;
        a2.x += nx * overlap * 0.5;
        a2.y += ny * overlap * 0.5;

        const kx = a1.vx - a2.vx;
        const ky = a1.vy - a2.vy;
        const p = 2 * (nx * kx + ny * ky) / 2;
        a1.vx -= nx * p;
        a1.vy -= ny * p;
        a2.vx += nx * p;
        a2.vy += ny * p;
      }
    }
  }
  return localSparks;
}

// Update high-energy heavy projectile positions and coordinate trails
export function updateProjectiles(projectiles, width, height) {
  return projectiles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;

    // Save trail history
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 20) p.trail.shift();

    const buffer = 80;
    return (
      p.x >= -buffer &&
      p.x <= width + buffer &&
      p.y >= -buffer &&
      p.y <= height + buffer
    );
  });
}

// Update particle sparks
export function updateSparks(sparks) {
  return sparks.filter(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.96; // spark air drag
    s.vy *= 0.96;
    s.life -= s.decay;
    return s.life > 0;
  });
}

// Detect collisions between projectiles and atom nucleus cores, trigger fission
export function checkFissionCollisions(atoms, projectiles, onFission) {
  const nextProjectiles = [...projectiles];
  const newSparks = [];
  let nextAtoms = [...atoms];

  // 1. Process active collisions of projectiles with STABLE atoms
  nextProjectiles.forEach((p, pIdx) => {
    // Ignore already absorbed projectiles and ejected electrons
    if (p.absorbed || p.isEjectedElectron) return;

    for (let i = 0; i < nextAtoms.length; i++) {
      const atom = nextAtoms[i];
      // Only hit stable, non-exploding atoms
      if (atom.unstable || atom.shouldSplit) continue;

      const dx = p.x - atom.x;
      const dy = p.y - atom.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < atom.nucleusRadius + 6) {
        // Secondary neutrons have an 88% chance to deflect/bounce instead of causing stability damage
        if (p.isNeutron && Math.random() > 0.12) {
          audioInstance.playBounce();
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          
          // Elastic reflection formula with speed damping and minor scattering noise
          const dot = p.vx * nx + p.vy * ny;
          p.vx = (p.vx - 2 * dot * nx) * 0.82 + (Math.random() - 0.5) * 0.6;
          p.vy = (p.vy - 2 * dot * ny) * 0.82 + (Math.random() - 0.5) * 0.6;
          
          // Move the neutron outside the collision zone to prevent sticking
          p.x = atom.x + nx * (atom.nucleusRadius + 8);
          p.y = atom.y + ny * (atom.nucleusRadius + 8);

          // Add distinctive deflection sparks (cool blue/cyan)
          for (let s = 0; s < 3; s++) {
            const sAngle = Math.random() * Math.PI * 2;
            const sSpeed = 0.8 + Math.random() * 1.5;
            newSparks.push({
              x: p.x,
              y: p.y,
              vx: nx * 1.5 + Math.cos(sAngle) * sSpeed,
              vy: ny * 1.5 + Math.sin(sAngle) * sSpeed,
              color: "#00f2fe",
              life: 0.6,
              decay: 0.06,
              radius: 0.8 + Math.random() * 1.2
            });
          }
          continue; // Skip triggering fission
        }

        // Flag projectile to be deleted
        p.absorbed = true;

        // Apply momentum transfer: push the atom along the projectile's trajectory
        atom.vx += p.vx * 0.12;
        atom.vy += p.vy * 0.12;

        // Decrement hit counter
        atom.hitsLeft--;
        audioInstance.playHit();

        // Set wobble impact distortion
        atom.wobbleAmp = 0.35;
        atom.wobbleAngle = Math.atan2(p.vy, p.vx);
        atom.wobblePhase = 0;

        // Electron Ejection & Orbit Dissolution
        if (!atom.dissolvingRings) atom.dissolvingRings = [];
        if (atom.electrons.length > 0) {
          const ejectedEl = atom.electrons.pop();
          
          // Add dissolving ring structure
          atom.dissolvingRings.push({
            radius: atom.nucleusRadius + 14 + (atom.electrons.length) * 8.5,
            life: 1.0,
            decay: 0.035,
            idx: atom.electrons.length // index for 3D rotation alignment
          });

          // Spawn high-speed ejected electron projectile
          const eAngle = Math.atan2(ejectedEl.y3d || 1, ejectedEl.x3d || 1) + (Math.random() - 0.5) * 0.5;
          const eSpeed = 3.5 + Math.random() * 2.0;
          nextProjectiles.push({
            id: `ejected-${Math.random()}`,
            x: atom.x + (ejectedEl.x3d || 0),
            y: atom.y + (ejectedEl.y3d || 0),
            vx: Math.cos(eAngle) * eSpeed + atom.vx,
            vy: Math.sin(eAngle) * eSpeed + atom.vy,
            trail: [],
            isEjectedElectron: true
          });
        }

        if (atom.hitsLeft <= 0) {
          // Trigger unstable phase for the final split
          atom.unstable = true;
          atom.unstableFrames = 36; // ~600ms charging visual for smooth mitosis animation
          atom.impactVx = p.vx;
          atom.impactVy = p.vy;
          atom.hitX = p.x;
          atom.hitY = p.y;

          // Visual final charging impact sparks (glowing yellow/orange)
          for (let s = 0; s < 12; s++) {
            const sAngle = Math.random() * Math.PI * 2;
            const sSpeed = 1.5 + Math.random() * 3.5;
            newSparks.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(sAngle) * sSpeed + p.vx * 0.25,
              vy: Math.sin(sAngle) * sSpeed + p.vy * 0.25,
              color: "#ffca28",
              life: 1.0,
              decay: 0.035,
              radius: 1.2 + Math.random() * 2.0
            });
          }
        } else {
          // Non-splitting excitation hit sparks (bright white-cyan energy burst)
          for (let s = 0; s < 8; s++) {
            const sAngle = Math.random() * Math.PI * 2;
            const sSpeed = 1.0 + Math.random() * 2.5;
            newSparks.push({
              x: p.x,
              y: p.y,
              vx: Math.cos(sAngle) * sSpeed + p.vx * 0.15,
              vy: Math.sin(sAngle) * sSpeed + p.vy * 0.15,
              color: "#ffffff",
              life: 0.7,
              decay: 0.05,
              radius: 1.0 + Math.random() * 1.5
            });
          }
        }
        break;
      }
    }
  });

  // Filter out absorbed projectiles
  const finalProjectiles = nextProjectiles.filter(p => !p.absorbed);

  // 2. Process unstable atoms that have finished charging (shouldSplit = true)
  const explodingAtoms = nextAtoms.filter(a => a.shouldSplit);
  explodingAtoms.forEach(atom => {
    audioInstance.playFission();
    // Remove from the active atoms list
    nextAtoms = nextAtoms.filter(a => a.id !== atom.id);

    // Trigger score callback
    onFission(atom.sizeTier);

    // Large burst of fission energy sparks
    const sparkCount = atom.sizeTier === "large" ? 42 : atom.sizeTier === "medium" ? 26 : 14;
    const colors = ["#ffb3ba", "#ffdfba", "#baffc9", "#bae1ff", "#e8c4ff", "#ffc6ff"];
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0;
      newSparks.push({
        x: atom.x,
        y: atom.y,
        vx: Math.cos(angle) * speed + atom.impactVx * 0.45,
        vy: Math.sin(angle) * speed + atom.impactVy * 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        radius: 1.2 + Math.random() * 2.5
      });
    }

    // Propagate shockwave to all other neighboring atoms
    nextAtoms.forEach(a => {
      const dx = a.x - atom.hitX;
      const dy = a.y - atom.hitY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist < 320) {
        const pushIntensity = (320 - dist) / 320;
        a.vx += (dx / dist) * pushIntensity * 4.6 + atom.impactVx * 0.58 * pushIntensity;
        a.vy += (dy / dist) * pushIntensity * 4.6 + atom.impactVy * 0.58 * pushIntensity;
      }
    });

    const impactVx = atom.impactVx * 0.95;
    const impactVy = atom.impactVy * 0.95;

    // Split atom into lower tiers or disintegrate
    if (atom.sizeTier === "large") {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6;
      const offset = 20;

      const m1 = createAtom(atom.x + Math.cos(angle) * offset, atom.y + Math.sin(angle) * offset, "medium");
      m1.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVx;
      m1.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVy;

      const m2 = createAtom(atom.x - Math.cos(angle) * offset, atom.y - Math.sin(angle) * offset, "medium");
      m2.vx = -Math.cos(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVx;
      m2.vy = -Math.sin(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVy;

      nextAtoms.push(m1, m2);

      // Launch 1 free cascade neutron
      const neutronSpeed = 5.4;
      const nAngle = Math.random() * Math.PI * 2;
      finalProjectiles.push({
        id: `neutron-${Math.random()}`,
        x: atom.x,
        y: atom.y,
        vx: Math.cos(nAngle) * neutronSpeed,
        vy: Math.sin(nAngle) * neutronSpeed,
        trail: [],
        isNeutron: true
      });
    } else if (atom.sizeTier === "medium") {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.2;
      const offset = 12;

      const s1 = createAtom(atom.x + Math.cos(angle) * offset, atom.y + Math.sin(angle) * offset, "small");
      s1.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVx;
      s1.vy = Math.sin(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVy;

      const s2 = createAtom(atom.x - Math.cos(angle) * offset, atom.y - Math.sin(angle) * offset, "small");
      s2.vx = -Math.cos(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVx;
      s2.vy = -Math.sin(angle) * speed + (Math.random() - 0.5) * 0.4 + impactVy;

      nextAtoms.push(s1, s2);

      // Launch 1 free cascade neutron
      const neutronSpeed = 5.8;
      const nAngle = Math.random() * Math.PI * 2;
      finalProjectiles.push({
        id: `neutron-${Math.random()}`,
        x: atom.x,
        y: atom.y,
        vx: Math.cos(nAngle) * neutronSpeed,
        vy: Math.sin(nAngle) * neutronSpeed,
        trail: [],
        isNeutron: true
      });
    } else if (atom.sizeTier === "small") {
      // Small atom final disintegration fires NO active cascade neutrons (only visual sparks)
      // This breaks runaway chain reactions, forcing the player to play actively!
    }
  });

  return {
    nextProjectiles: finalProjectiles,
    nextAtoms,
    newSparks
  };
}

// Preserve interface compliance
export function getPacked3DNucleons(protonCount, neutronCount, time = 0) {
  return [];
}
export const ORBIT_CONFIGS = [];
export function update3DElectrons(electrons, time) {
  return [];
}
