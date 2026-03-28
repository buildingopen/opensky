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
      {/* Primary cloud mass - upper left */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "650px",
          height: "380px",
          top: "-100px",
          left: "-120px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 40%, transparent 70%)",
          filter: "blur(20px)",
          animationDuration: "10s",
        }}
      />
      {/* Upper right, green tint */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "550px",
          height: "320px",
          top: "-50px",
          right: "-80px",
          background: "radial-gradient(ellipse, var(--cloud-green-start) 0%, var(--cloud-green-end) 40%, transparent 70%)",
          filter: "blur(22px)",
          animationDelay: "-3s",
          animationDuration: "12s",
        }}
      />
      {/* Mid-left wisp */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "500px",
          height: "260px",
          top: "28%",
          left: "-60px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 45%, transparent 70%)",
          filter: "blur(18px)",
          animationDelay: "-5s",
          animationDuration: "13s",
        }}
      />
      {/* Center-right, larger */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "700px",
          height: "380px",
          top: "18%",
          right: "-150px",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 45%, transparent 65%)",
          filter: "blur(22px)",
          animationDelay: "-7s",
          animationDuration: "15s",
        }}
      />
      {/* Lower left, green accent */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "550px",
          height: "280px",
          bottom: "12%",
          left: "8%",
          background: "radial-gradient(ellipse, var(--cloud-green-start) 0%, var(--cloud-green-end) 40%, transparent 70%)",
          filter: "blur(20px)",
          animationDelay: "-9s",
          animationDuration: "11s",
        }}
      />
      {/* Bottom right */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "600px",
          height: "320px",
          bottom: "-80px",
          right: "3%",
          background: "radial-gradient(ellipse, var(--cloud-white-start) 0%, var(--cloud-white-end) 40%, transparent 70%)",
          filter: "blur(20px)",
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
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Stars: always mounted, fade in/out over 3s */}
      <div
        className="absolute inset-0 transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: theme === "dark" ? 1 : 0 }}
      >
        <StarsLayer />
      </div>
      {/* Cloud orbs: dark mode only (light mode uses photo background) */}
      <div
        className="absolute inset-0 transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: theme === "dark" ? 1 : 0 }}
      >
        <CloudOrbs />
      </div>
    </div>
  );
}
