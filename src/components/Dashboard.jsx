"use client";

import { useEffect, useRef } from "react";
import audioInstance from "../game-engine/audio";

export default function Dashboard({
  score,
  highScore,
  stardust,
  orbsLeft,
  upgrades,
  onBuyUpgrade,
  logs,
  isMobile,
  onClose,
}) {
  const terminalEndRef = useRef(null);

  // Auto-scroll the logger terminal console to the bottom
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <div
      className="glass-panel"
      style={{
        width: isMobile ? "100%" : "360px",
        height: "100%",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        borderRight: isMobile ? "none" : "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "0",
        backgroundColor: "rgba(3, 3, 12, 0.96)",
        overflowY: "auto",
        zIndex: 500,
        position: isMobile ? "absolute" : "relative",
        top: 0,
        left: 0,
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1
            className="neon-text"
            style={{
              fontSize: "1.75rem",
              fontWeight: "900",
              letterSpacing: "0.15em",
              background: "linear-gradient(45deg, #00f2fe, #ff007f)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NEON PLINKO
          </h1>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              color: "var(--gray-medium)",
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            CASCADE CATALYST v1.0
          </p>
        </div>

        {isMobile && (
          <button
            onClick={onClose}
            className="glass-button"
            style={{
              width: "36px",
              height: "36px",
              padding: "0",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              borderColor: "rgba(255, 255, 255, 0.15)",
              color: "var(--white)",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Telemetry Status Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.01)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--gray-medium)", letterSpacing: "0.05em" }}>
            SCORE
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontFamily: "var(--font-display)",
              color: "var(--white)",
              marginTop: "4px",
            }}
          >
            {score}
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.01)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--gray-medium)", letterSpacing: "0.05em" }}>
            HIGH SCORE
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontFamily: "var(--font-display)",
              color: "var(--cyan-glow)",
              marginTop: "4px",
            }}
          >
            {highScore}
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.01)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--gray-medium)", letterSpacing: "0.05em" }}>
            STARDUST
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontFamily: "var(--font-display)",
              color: "var(--gold-glow)",
              marginTop: "4px",
            }}
          >
            ✨ {stardust}
          </div>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: "12px",
            background: "rgba(255, 255, 255, 0.01)",
            textAlign: "center",
            border: orbsLeft <= 2 ? "1px solid rgba(255, 0, 127, 0.3)" : "1px solid var(--glass-border)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--gray-medium)", letterSpacing: "0.05em" }}>
            ORBS LEFT
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontFamily: "var(--font-display)",
              color: orbsLeft <= 2 ? "var(--magenta-glow)" : "var(--green-glow)",
              marginTop: "4px",
            }}
          >
            ● {orbsLeft}
          </div>
        </div>
      </div>

      {/* Upgrade Store */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          overflowY: "auto",
          background: "rgba(255, 255, 255, 0.005)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.85rem",
            letterSpacing: "0.1em",
            color: "var(--cyan-glow)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: "8px",
          }}
        >
          ALCHEMICAL UPGRADE SHOP
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {upgrades.map((upgrade) => {
            const isMax = upgrade.level >= upgrade.maxLevel;
            const canAfford = stardust >= upgrade.cost;
            
            return (
              <div
                key={upgrade.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "10px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      letterSpacing: "0.02em",
                      color: "var(--white)",
                    }}
                  >
                    {upgrade.name}
                  </span>
                  <span style={{ fontSize: "0.7rem", color: "var(--gray-medium)" }}>
                    Lvl {upgrade.level}/{upgrade.maxLevel}
                  </span>
                </div>
                
                <p style={{ fontSize: "0.68rem", color: "var(--gray-light)", lineHeight: "1.3" }}>
                  {upgrade.description}
                </p>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-display)",
                      color: isMax ? "var(--gray-medium)" : "var(--gold-glow)",
                      fontWeight: "bold",
                    }}
                  >
                    {isMax ? "MAX LEVEL" : `✨ ${Math.floor(upgrade.cost)}`}
                  </span>
                  
                  <button
                    disabled={isMax || !canAfford}
                    onClick={() => {
                      audioInstance.playRegister();
                      onBuyUpgrade(upgrade.id);
                    }}
                    className="glass-button green"
                    style={{
                      fontSize: "0.68rem",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      height: "26px",
                    }}
                  >
                    UPGRADE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal logs console */}
      <div
        className="glass-panel"
        style={{
          height: "120px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          background: "#010105",
          border: "1px solid rgba(255, 255, 255, 0.03)",
          fontFamily: "monospace",
          fontSize: "0.68rem",
          overflowY: "auto",
        }}
      >
        {logs.map((log, index) => {
          let color = "rgba(255, 255, 255, 0.6)";
          if (log.includes("[SYSTEM]")) color = "var(--gray-medium)";
          if (log.includes("[HIT]")) color = "var(--green-glow)";
          if (log.includes("[SHOP]")) color = "var(--gold-glow)";
          if (log.includes("[JACKPOT]")) color = "var(--magenta-glow)";
          
          return (
            <div key={index} style={{ color, wordBreak: "break-all", lineHeight: "1.3" }}>
              {log}
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
}
