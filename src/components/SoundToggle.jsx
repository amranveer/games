"use client";

import { useState } from "react";
import audioInstance from "../game-engine/audio";

export default function SoundToggle({ size }) {
  const [isMuted, setIsMuted] = useState(false);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioInstance.setMute(nextMuted);
    
    // Trigger initialization on click to handle browser restrictions
    audioInstance.init();
  };

  const isSmall = size === "small";

  return (
    <button
      onClick={toggleSound}
      className={`glass-button ${isMuted ? "" : "active"}`}
      style={{
        width: isSmall ? "32px" : "42px",
        height: isSmall ? "32px" : "42px",
        padding: "0",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isSmall ? "0.95rem" : "1.1rem",
        boxShadow: isMuted ? "none" : "0 0 10px rgba(0, 242, 254, 0.25)",
      }}
      title={isMuted ? "Unmute sound" : "Mute sound"}
    >
      {isMuted ? (
        // Speaker muted SVG
        <svg
          width={isSmall ? "14" : "18"}
          height={isSmall ? "14" : "18"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Speaker active SVG
        <svg
          width={isSmall ? "14" : "18"}
          height={isSmall ? "14" : "18"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      )}
    </button>
  );
}
