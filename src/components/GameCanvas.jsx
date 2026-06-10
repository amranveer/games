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

export default function GameCanvas() {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  // Responsive canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
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
      const w = Math.max(200, rect.width);
      const h = Math.max(200, rect.height);
      setDimensions({ width: w, height: h });
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
    const { width, height } = dimensions;
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
  }, [dimensions]);

  // Handle dimensions change to trigger initial reset
  useEffect(() => {
    if (dimensions.width > 200 && dimensions.height > 200 && !hasInitializedAtoms) {
      resetGame();
    }
  }, [dimensions, hasInitializedAtoms, resetGame]);

  // Click or touch to fire a heavy particle from the bottom center
  const handleLaunchParticle = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger audio context
    audioInstance.init();

    const rect = canvas.getBoundingClientRect();
    const targetX = clientX - rect.left;
    const targetY = clientY - rect.top;

    // Launch coordinates: bottom center
    const startX = dimensions.width / 2;
    const startY = dimensions.height;

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

    // 1. Update velocities and coordinate positions
    updateGameAtoms(atomsRef.current, dimensions.width, dimensions.height, timestamp);
    projectilesRef.current = updateProjectiles(projectilesRef.current, dimensions.width, dimensions.height);
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
    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };
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
        atom.maxHits
      );
    });

    // 4. Calculate dynamic aiming angle and draw pivoting heavy particle shooter
    const startX = dimensions.width / 2;
    const startY = dimensions.height;
    const dx = mousePosRef.current.x - startX;
    const dy = mousePosRef.current.y - startY;
    const targetAngle = Math.atan2(dy, dx);

    // Smooth aim interpolation
    barrelAngleRef.current = barrelAngleRef.current * 0.8 + targetAngle * 0.2;

    // Decay recoil and muzzle flash
    recoilRef.current *= 0.84;
    flashIntensityRef.current = Math.max(0, flashIntensityRef.current - 0.08);

    drawLauncher(ctx, startX, startY, barrelAngleRef.current, recoilRef.current, flashIntensityRef.current);

  }, [dimensions]);

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
        <div style={{ display: "flex", gap: "28px" }}>
          <div>
            SCORE <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{score}</span>
          </div>
          <div>
            PROJECTILES <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{shots}</span>
          </div>
          <div>
            FISSIONS <span style={{ color: "#334155", fontWeight: "bold", fontSize: "1.05rem", marginLeft: "6px" }}>{fissionCount}</span>
          </div>
        </div>

        <button
          onClick={resetGame}
          style={{
            pointerEvents: "auto",
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
    </div>
  );
}
