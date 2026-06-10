"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  createAtom,
  updateGameAtoms,
  updateProjectiles,
  updateSparks,
  checkFissionCollisions
} from "../game-engine/physics";
import {
  draw3DAtom,
  drawProbabilityCloud,
  drawProjectiles,
  drawSparks,
  drawLauncher
} from "../game-engine/renderer";
import audioInstance from "../game-engine/audio";
import SoundToggle from "./SoundToggle";

export default function GameCanvas() {
  const iosHapticInputRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  // Set up iOS Safari Web Audio unlocker and hidden Switch haptics
  const [audioStatus, setAudioStatus] = useState("LOCKED");
  const [audioDiagnostic, setAudioDiagnostic] = useState("await_gesture");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const unlockedRef = useRef(false);

  // Audio unlock — fires on first valid iOS gesture (touchend or click).
  // Correct order: audioSession → silent HTML5 audio → init() → resume → warmup buffer.
  // Must be 100% synchronous — any await breaks the iOS user gesture chain.
  const unlockAudio = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    let log = "start ";
    try {
      // Step 1: Elevate audio session BEFORE creating the AudioContext.
      if (typeof navigator !== "undefined" && navigator.audioSession) {
        try {
          navigator.audioSession.type = "playback";
          log += "session_playback ";
        } catch (e) {
          log += `session_err:${e.message || e} `;
        }
      } else {
        log += "no_session_api ";
      }

      // Step 2: Play a looping silent HTML5 <audio> tag.
      const silenceAudio = document.getElementById("silence-audio");
      if (silenceAudio) {
        log += "found_silence_tag ";
        try {
          const p = silenceAudio.play();
          if (p && typeof p.then === "function") {
            p.then(() => { log += "play_ok "; })
             .catch(e => { log += `play_err:${e.message || e} `; });
          } else {
            log += "play_sync_ok ";
          }
        } catch (e) {
          log += `play_err:${e.message || e} `;
        }
      } else {
        log += "no_silence_tag ";
      }

      // Step 3: Create the AudioContext — now inside a valid touchend/click call stack.
      log += `keys:${Object.keys(audioInstance).join(",")} type_init:${typeof audioInstance.init} has_ctx:${audioInstance.ctx !== undefined ? (audioInstance.ctx ? "yes" : "falsy") : "no"} calling_init `;
      audioInstance.init();

      if (audioInstance.ctx) {
        log += `ctx_ok(state:${audioInstance.ctx.state}) `;
      } else {
        log += `ctx_null(err:${audioInstance.initError || "none"}) `;
      }

      // Step 4: Unlock the HTML5 Audio pools for fallback playback.
      log += "unlocking_pools ";
      audioInstance.unlockPools();

      // Step 5: Resume the context if suspended or interrupted.
      log += "calling_resume ";
      audioInstance.resumeCtx();

      // Step 6: Play a 1-sample silent buffer to prime the hardware audio graph.
      if (audioInstance.ctx) {
        try {
          const warmupBuffer = audioInstance.ctx.createBuffer(1, 1, 22050);
          const warmupSource = audioInstance.ctx.createBufferSource();
          warmupSource.buffer = warmupBuffer;
          warmupSource.connect(audioInstance.ctx.destination);
          warmupSource.start(0);
          log += "warmup_started ";
        } catch (e) {
          log += `warmup_err:${e.message || e} `;
        }
      }
    } catch (err) {
      log += `global_err:${err.message || err} `;
    }

    setAudioDiagnostic(log);

    // Step 6: Remove listeners — only one unlock needed per session.
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchend", unlockAudio);
  }, []);

  // Poll state of the context to update HUD dynamically
  useEffect(() => {
    const checkStatus = () => {
      if (audioInstance.muted) {
        setAudioStatus("MUTED");
      } else if (audioInstance.ctx) {
        setAudioStatus(audioInstance.ctx.state.toUpperCase());
      } else if (audioInstance.fallbackUnlocked) {
        setAudioStatus("RUNNING (FALLBACK)");
      } else {
        setAudioStatus("LOCKED");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 300);
    return () => clearInterval(interval);
  }, []);

  // Set up iOS Safari Web Audio unlocker and hidden Switch haptics
  useEffect(() => {
    // 1. Add switch attribute to input ref to enable Safari system haptics
    if (iosHapticInputRef.current) {
      iosHapticInputRef.current.setAttribute("switch", "");
    }

    // 2. Wire up audioInstance.iosHapticCallback to programmatically toggle the switch
    audioInstance.iosHapticCallback = (pattern) => {
      const label = document.getElementById("haptic-trigger");
      if (label) { label.click(); }
    };

    // touchend and click are the ONLY gestures iOS Safari accepts for AudioContext creation.
    // passive: false ensures the handler can call preventDefault if needed.
    window.addEventListener("touchend", unlockAudio, { passive: false });
    window.addEventListener("click", unlockAudio, { passive: false });

    return () => {
      audioInstance.iosHapticCallback = null;
      window.removeEventListener("touchend", unlockAudio);
      window.removeEventListener("click", unlockAudio);
    };
  }, [unlockAudio]);

  // Responsive canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const dimensionsRef = useRef({ width: 800, height: 600 });
  const [hasInitializedAtoms, setHasInitializedAtoms] = useState(false);

  // Score HUD states
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [fissionCount, setFissionCount] = useState(0);

  // Game entity refs
  const atomsRef = useRef([]);
  const projectilesRef = useRef([]);
  const sparksRef = useRef([]);

  // Cannon state refs for pivoting heavy particle shooter
  const barrelAngleRef = useRef(-Math.PI / 2);
  const recoilRef = useRef(0);
  const flashIntensityRef = useRef(0);
  const mousePosRef = useRef({ x: 400, y: 0 });

  // Prefetch audio assets on mount
  useEffect(() => {
    if (audioInstance.prefetchSounds) {
      audioInstance.prefetchSounds();
    }
  }, []);

  // Initialize canvas size and trackResize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const updateSize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(200, Math.floor(rect.height));

      // Calculate the difference
      const current = dimensionsRef.current;
      const dx = Math.abs(current.width - w);
      const dy = Math.abs(current.height - h);

      // Only update if dimensions change significantly (e.g. > 25px) or it's the initial load
      if (dx > 25 || dy > 25 || current.width === 800) {
        dimensionsRef.current = { width: w, height: h };
        setDimensions({ width: w, height: h });
      }
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(parent);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Spawn 4 large atoms once dimensions are known
  const resetGame = useCallback(() => {
    const { width, height } = dimensionsRef.current;
    if (width <= 200 || height <= 200) return;

    // Spawn 4 large atoms tightly clustered at the center
    const cx = width / 2;
    const cy = height / 2;
    const offset = 18;

    atomsRef.current = [
      createAtom(cx - offset, cy - offset, "large"),
      createAtom(cx + offset, cy - offset, "large"),
      createAtom(cx - offset, cy + offset, "large"),
      createAtom(cx + offset, cy + offset, "large")
    ];

    projectilesRef.current = [];
    sparksRef.current = [];
    setScore(0);
    setShots(0);
    setFissionCount(0);
    setHasInitializedAtoms(true);
  }, []);

  // Handle dimensions change to trigger initial reset
  useEffect(() => {
    if (dimensions.width > 200 && dimensions.height > 200 && !hasInitializedAtoms) {
      resetGame();
    }
  }, [dimensions.width, dimensions.height, hasInitializedAtoms, resetGame]);

  // Click or touch to fire a heavy particle from the bottom center
  const handleLaunchParticle = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger audio playback
    audioInstance.playShoot();

    const rect = canvas.getBoundingClientRect();
    const targetX = clientX - rect.left;
    const targetY = clientY - rect.top;

    // Launch coordinates: bottom center
    const startX = dimensionsRef.current.width / 2;
    const startY = dimensionsRef.current.height;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Particle velocity
    const speed = 9.5;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    projectilesRef.current.push({
      id: `proj-${Math.random()}`,
      x: startX,
      y: startY,
      vx,
      vy,
      trail: []
    });

    // Set cannon recoil and muzzle flash triggers
    recoilRef.current = 14;
    flashIntensityRef.current = 1.0;

    setShots(s => s + 1);
  };

  const handleMouseDown = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    unlockAudio();
    handleLaunchParticle(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    if (e.touches.length !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  const handleTouchEnd = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    if (e.changedTouches.length !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Unlock audio first
    unlockAudio();

    // Launch particle at touch end coordinates
    handleLaunchParticle(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  };

  // Main animation / update loop
  const updateAndRender = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const evapSparks = updateGameAtoms(atomsRef.current, dimensionsRef.current.width, dimensionsRef.current.height, timestamp);
    if (evapSparks && evapSparks.length > 0) {
      sparksRef.current.push(...evapSparks);
    }
    projectilesRef.current = updateProjectiles(projectilesRef.current, dimensionsRef.current.width, dimensionsRef.current.height);
    sparksRef.current = updateSparks(sparksRef.current);

    // 2. Perform projectile-nucleus collision checks and fission splits
    const { nextProjectiles, nextAtoms, newSparks } = checkFissionCollisions(
      atomsRef.current,
      projectilesRef.current,
      (tier) => {
        let points = 50;
        if (tier === "medium") points = 100;
        if (tier === "small") points = 250;
        setScore(s => s + points);
        setFissionCount(f => f + 1);
      }
    );

    atomsRef.current = nextAtoms;
    projectilesRef.current = nextProjectiles;
    if (newSparks.length > 0) {
      sparksRef.current = [...sparksRef.current, ...newSparks];
    }

    // 3. Render scene
    const center = { x: dimensionsRef.current.width / 2, y: dimensionsRef.current.height / 2 };
    drawProbabilityCloud(ctx, center, timestamp);

    // Render active sparks
    drawSparks(ctx, sparksRef.current);

    // Render active heavy projectiles
    drawProjectiles(ctx, projectilesRef.current);

    // Render all active atoms in depth-sorted 3D
    atomsRef.current.forEach(atom => {
      atom.electrons.forEach(el => {
        const trail = el.trail ? [...el.trail] : [];
        trail.push({ x: el.x3d, y: el.y3d, z: el.z3d });
        if (trail.length > 60) trail.shift();
        el.trail = trail;
      });

      draw3DAtom(
        ctx,
        { x: atom.x + (atom.shakeX || 0), y: atom.y + (atom.shakeY || 0) },
        atom.electrons,
        atom.cameraYaw,
        atom.cameraPitch,
        atom.nucleusRadius,
        timestamp,
        atom.unstable,
        atom.unstableFrames,
        atom.impactVx,
        atom.impactVy,
        atom.hitsLeft,
        atom.maxHits,
        atom.dissolvingRings || [],
        atom.wobbleAmp || 0,
        atom.wobbleAngle || 0,
        atom.wobblePhase || 0
      );
    });

    // 4. Calculate dynamic aiming angle and draw pivoting heavy particle shooter
    const startX = dimensionsRef.current.width / 2;
    const startY = dimensionsRef.current.height;
    const dx = mousePosRef.current.x - startX;
    const dy = mousePosRef.current.y - startY;
    const targetAngle = Math.atan2(dy, dx);

    // Smooth aim interpolation
    barrelAngleRef.current = barrelAngleRef.current * 0.8 + targetAngle * 0.2;

    // Decay recoil and muzzle flash
    recoilRef.current *= 0.84;
    flashIntensityRef.current = Math.max(0, flashIntensityRef.current - 0.08);

    drawLauncher(ctx, startX, startY, barrelAngleRef.current, recoilRef.current, flashIntensityRef.current);

  }, []);

  // Sync requestAnimationFrame
  useEffect(() => {
    const loop = (timestamp) => {
      updateAndRender(timestamp);
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateAndRender]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#f4f6f9",
        touchAction: "none"
      }}
    >
      {/* Dynamic Fission HUD Overlay */}
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          right: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          zIndex: 10,
          fontFamily: "monospace",
          fontSize: "0.85rem",
          color: "#64748b",
          letterSpacing: "0.05em"
        }}
      >
        <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
          <div>
            SCORE <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{score}</span>
          </div>
          <div>
            PROJECTILES <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{shots}</span>
          </div>
          <div>
            FISSIONS <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{fissionCount}</span>
          </div>
          <div
            onClick={() => setShowDiagnostics(prev => !prev)}
            style={{ cursor: "pointer", pointerEvents: "auto" }}
            title="Click to toggle diagnostics telemetry"
          >
            AUDIO <span style={{
              color: audioStatus.startsWith("RUNNING") ? "#39ff14" : audioStatus === "MUTED" ? "#707080" : "#ff007f",
              fontWeight: "bold",
              fontSize: "1.01rem",
              marginLeft: "6px",
              textShadow: audioStatus.startsWith("RUNNING") ? "0 0 10px rgba(57,255,20,0.3)" : "none"
            }}>{audioStatus}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", pointerEvents: "auto" }}>
          <SoundToggle size="small" />
          <button
            onClick={resetGame}
            style={{
              background: "#ffffff",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "0.75rem",
              color: "#64748b",
              cursor: "pointer",
              fontFamily: "monospace",
              boxShadow: "0 2px 10px rgba(148, 163, 184, 0.05)",
              transition: "all 0.15s ease",
              outline: "none"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#334155";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(226, 232, 240, 0.8)";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            RESET LATTICE
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "crosshair"
        }}
      />
       {/* Hidden iOS Safari haptic toggle elements */}
      <input
        ref={iosHapticInputRef}
        type="checkbox"
        id="haptic-switch"
        style={{ display: "none" }}
      />
      <label
        id="haptic-trigger"
        htmlFor="haptic-switch"
        style={{ display: "none" }}
      />
      {/* Telemetry Debug Log Console */}
      {showDiagnostics && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "16px",
            pointerEvents: "none",
            zIndex: 10,
            fontFamily: "monospace",
            fontSize: "0.68rem",
            color: "rgba(100, 116, 139, 0.7)",
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            maxWidth: "320px",
            wordBreak: "break-all"
          }}
        >
          SYS DIAG: {audioDiagnostic} | INIT_LOG: {audioInstance.initLog || "none"} | ERRORS: {typeof window !== "undefined" && window.__audio_errors ? window.__audio_errors.slice(-3).join(",") : "none"}
        </div>
      )}
      {/* Silent HTML5 audio tag to force audio session output category (bypasses phone silent ring switch) */}
      <audio
        id="silence-audio"
        loop
        playsInline
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0.01,
          pointerEvents: "none"
        }}
      />
    </div>
  );
}
