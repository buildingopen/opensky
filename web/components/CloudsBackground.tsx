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

// Cloud wisps: 6-14% opacity, large enough to register visually
const clouds: Cloud[] = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: Math.round(seeded(i * 5 + 1) * 10000) / 100,
  y: Math.round(seeded(i * 5 + 2) * 10000) / 100,
  w: 100 + Math.round(seeded(i * 5 + 3) * 200),
  h: 14 + Math.round(seeded(i * 5 + 4) * 24),
  opacity: 0.06 + seeded(i * 5 + 5) * 0.08,
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
            background: c.id % 5 === 0 ? "rgba(34, 197, 94, 0.35)" : "white",
            filter: `blur(${Math.round(c.h * 0.7)}px)`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${20 + Math.round(seeded(c.id * 7) * 25)}s`,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
