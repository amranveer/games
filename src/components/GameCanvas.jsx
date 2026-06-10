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
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  // Game/Audio states
  const [gameStarted, setGameStarted] = useState(false);
  const [audioStatus, setAudioStatus] = useState("LOCKED");
  const [audioDiagnostic, setAudioDiagnostic] = useState("await_gesture");

  // Synchronous audio initiation inside a concrete button's click event handler
  const handleStartGame = useCallback(() => {
    let log = "gesture_fired ";
    try {
      // 1. Prefetch sounds in case it hasn't finished (it's safe to call multiple times)
      audioInstance.prefetchSounds();
      
      // 2. Call synchronous init (resumes AudioContext, creates warmup node)
      audioInstance.init();
      
      if (audioInstance.ctx) {
        log += `ctx_ok(state:${audioInstance.ctx.state}) `;
      } else {
        log += `ctx_failed(err:${audioInstance.initError || "none"}) `;
      }
    } catch (err) {
      log += `err:${err.message || err} `;
    }
    setAudioDiagnostic(log);
    setGameStarted(true);
  }, []);

  // Prefetch sounds on client-side mount
  useEffect(() => {
    audioInstance.prefetchSounds();
  }, []);

  // Poll state of the context to update HUD dynamically
  useEffect(() => {
    const checkStatus = () => {
      if (audioInstance.muted) {
        setAudioStatus("MUTED");
      } else if (audioInstance.ctx) {
        setAudioStatus(audioInstance.ctx.state.toUpperCase());
      } else {
        setAudioStatus("LOCKED");
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 300);
    return () => clearInterval(interval);
  }, []);

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
    handleLaunchParticle(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
    if (e.touches.length !== 1) return;
    handleLaunchParticle(e.touches[0].clientX, e.touches[0].clientY);
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
      {/* Tap to Start / Audio Unlock Overlay */}
      {!gameStarted && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(244, 246, 249, 0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "24px",
            textAlign: "center"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              borderRadius: "24px",
              padding: "40px",
              boxShadow: "0 20px 40px -15px rgba(148, 163, 184, 0.15)",
              maxWidth: "400px",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            <h1
              style={{
                fontFamily: "monospace",
                fontSize: "1.4rem",
                color: "#1e293b",
                margin: "0 0 12px 0",
                letterSpacing: "0.05em",
                textTransform: "uppercase"
              }}
            >
              Neon Plinko Cascade
            </h1>
            <p
              style={{
                fontFamily: "monospace",
                fontSize: "0.8rem",
                color: "#64748b",
                margin: "0 0 32px 0",
                lineHeight: "1.6",
                letterSpacing: "0.02em"
              }}
            >
              Experience high-fidelity, zero-latency synthesizer sounds optimized for iOS.
            </p>
            <button
              onClick={handleStartGame}
              style={{
                width: "100%",
                background: "#0f172a",
                border: "none",
                borderRadius: "12px",
                padding: "16px 24px",
                fontSize: "0.85rem",
                color: "#ffffff",
                cursor: "pointer",
                fontFamily: "monospace",
                fontWeight: "bold",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                boxShadow: "0 10px 20px -10px rgba(15, 23, 42, 0.3)",
                transition: "all 0.2s ease",
                outline: "none"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#1e293b";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0f172a";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Tap to Start
            </button>
          </div>
        </div>
      )}

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
          <div>
            AUDIO <span style={{
              color: audioStatus === "RUNNING" ? "#39ff14" : audioStatus === "MUTED" ? "#707080" : "#ff007f",
              fontWeight: "bold",
              fontSize: "1.01rem",
              marginLeft: "6px",
              textShadow: audioStatus === "RUNNING" ? "0 0 10px rgba(57,255,20,0.3)" : "none"
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
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          cursor: "crosshair"
        }}
      />

      {/* Telemetry Debug Log Console */}
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
        SYS DIAG: {audioDiagnostic} | INIT_LOG: {audioInstance.initLog || "none"}
      </div>
    </div>
  );
}
