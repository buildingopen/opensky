"use client";

import { useTheme } from "./ThemeProvider";

// Deterministic star positions seeded from index (avoids hydration mismatch)
const STAR_COUNT = 80;
const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
  // Simple hash from index for deterministic positioning
  const x = ((i * 7919 + 104729) % 10000) / 100;
  const y = ((i * 6271 + 97213) % 10000) / 100;
  const sizeClass = i % 10 < 6 ? 1 : i % 10 < 9 ? 1.5 : 2;
  const speedClass = i % 3 === 0 ? "star-slow" : i % 3 === 1 ? "star-med" : "star-fast";
  const delay = ((i * 3571) % 7000) / 1000; // 0-7s staggered delay
  return { x, y, size: sizeClass, speed: speedClass, delay };
});

function StarsLayer() {
  return (
    <>
      {stars.map((s, i) => (
        <div
          key={i}
          className={s.speed}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: "50%",
            background: "white",
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function CloudOrbs() {
  return (
    <>
      {/* Primary cloud mass - upper left, white */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "600px",
          height: "350px",
          top: "-100px",
          left: "-120px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 40%, transparent 70%)",
          filter: "blur(40px)",
          animationDuration: "10s",
        }}
      />
      {/* Upper right, green tint */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "500px",
          height: "300px",
          top: "-50px",
          right: "-80px",
          background: "radial-gradient(ellipse, var(--cloud-green-start) 0%, var(--cloud-green-end) 40%, transparent 70%)",
          filter: "blur(50px)",
          animationDelay: "-3s",
          animationDuration: "12s",
        }}
      />
      {/* Mid-left wisp, white */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "450px",
          height: "220px",
          top: "28%",
          left: "-60px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 45%, transparent 70%)",
          filter: "blur(35px)",
          animationDelay: "-5s",
          animationDuration: "13s",
        }}
      />
      {/* Center-right, larger, subtle white */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "700px",
          height: "350px",
          top: "18%",
          right: "-180px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 45%, transparent 65%)",
          filter: "blur(45px)",
          animationDelay: "-7s",
          animationDuration: "15s",
        }}
      />
      {/* Lower left, green accent */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "500px",
          height: "260px",
          bottom: "12%",
          left: "8%",
          background: "radial-gradient(ellipse, var(--cloud-green-start) 0%, var(--cloud-green-end) 40%, transparent 70%)",
          filter: "blur(40px)",
          animationDelay: "-9s",
          animationDuration: "11s",
        }}
      />
      {/* Bottom right, white */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "550px",
          height: "300px",
          bottom: "-80px",
          right: "3%",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 40%, transparent 70%)",
          filter: "blur(45px)",
          animationDelay: "-2s",
          animationDuration: "14s",
        }}
      />
    </>
  );
}

// Large atmospheric gradient orbs that drift slowly, creating a sky-like feel.
// Uses radial-gradient with CSS custom properties for theme adaptation.
export function CloudsBackground() {
  const { theme } = useTheme();
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Sky gradient base */}
      <div className="absolute inset-0" style={{ background: "var(--sky-gradient)" }} />
      {/* Stars (dark only) */}
      {theme === "dark" && <StarsLayer />}
      {/* Cloud orbs (both themes) */}
      <CloudOrbs />
    </div>
  );
}
