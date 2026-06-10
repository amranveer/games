"use client";

import dynamic from "next/dynamic";

const GameCanvas = dynamic(() => import("../../components/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f6f9",
        fontFamily: "monospace",
        fontSize: "1.1rem",
        letterSpacing: "0.15em",
        color: "#8a8a9e",
      }}
    >
      INITIALIZING QUANTUM ORBITALS...
    </div>
  ),
});

export default function GamePage() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "#f4f6f9",
        overflow: "hidden"
      }}
    >
      <GameCanvas />
    </div>
  );
}
