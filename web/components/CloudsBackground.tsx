"use client";

// Seeded random for deterministic SSR/client hydration
function seeded(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

interface Cloud {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  delay: number;
}

// Small, subtle cloud wisps scattered across the page
const clouds: Cloud[] = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.round(seeded(i * 5 + 1) * 10000) / 100,
  y: Math.round(seeded(i * 5 + 2) * 10000) / 100,
  w: 60 + Math.round(seeded(i * 5 + 3) * 120),
  h: 8 + Math.round(seeded(i * 5 + 4) * 16),
  opacity: 0.015 + seeded(i * 5 + 5) * 0.025,
  delay: Math.round(seeded(i * 5 + 6) * 300) / 10,
}));

export function CloudsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {clouds.map((c) => (
        <div
          key={c.id}
          className="cloud-wisp absolute rounded-full"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            width: `${c.w}px`,
            height: `${c.h}px`,
            opacity: c.opacity,
            background: "white",
            filter: `blur(${c.h + 4}px)`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
