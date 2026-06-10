"use client";

import Link from "next/link";
import SoundToggle from "../components/SoundToggle";

export default function Home() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        position: "relative",
        background: "radial-gradient(circle at 50% 50%, #0c0920 0%, #020208 100%)",
        overflow: "hidden",
      }}
    >
      {/* Decorative vector background clouds */}
      <div
        className="floating"
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 0, 127, 0.06) 0%, rgba(0, 0, 0, 0) 70%)",
          top: "10%",
          left: "20%",
          pointerEvents: "none",
          filter: "blur(60px)",
        }}
      />
      <div
        className="floating"
        style={{
          position: "absolute",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0, 242, 254, 0.06) 0%, rgba(0, 0, 0, 0) 70%)",
          bottom: "10%",
          right: "20%",
          pointerEvents: "none",
          filter: "blur(60px)",
          animationDelay: "-2s",
        }}
      />

      {/* Floating Audio in top-right */}
      <div style={{ position: "absolute", top: "24px", right: "24px", zIndex: 10 }}>
        <SoundToggle />
      </div>

      {/* Landing Center Area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          zIndex: 5,
          textAlign: "center",
        }}
      >
        <h1
          className="neon-text"
          style={{
            fontSize: "4.5rem",
            letterSpacing: "0.25em",
            fontWeight: "900",
            background: "linear-gradient(45deg, #00f2fe, #ff007f)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 30px rgba(0, 242, 254, 0.2)",
            margin: "0 0 16px 0",
            paddingLeft: "0.25em", // center offset alignment for tracking
          }}
        >
          ATOM
        </h1>

        <Link href="/game" passHref style={{ display: "inline-block" }}>
          <button
            className="glass-button primary"
            style={{
              fontSize: "1.2rem",
              padding: "16px 54px",
              borderRadius: "50px",
              letterSpacing: "0.15em",
              fontWeight: "600",
              boxShadow: "0 0 30px rgba(0, 242, 254, 0.3)",
              transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
              textTransform: "uppercase",
            }}
          >
            START
          </button>
        </Link>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "24px",
          fontSize: "0.65rem",
          letterSpacing: "0.15em",
          color: "rgba(255, 255, 255, 0.25)",
          textTransform: "uppercase",
          fontFamily: "monospace",
        }}
      >
        ACTIVE ORBITAL CORE
      </div>
    </div>
  );
}

