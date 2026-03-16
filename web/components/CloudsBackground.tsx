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

// Subtle cloud wisps scattered across the page (5-8% opacity range)
const clouds: Cloud[] = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.round(seeded(i * 5 + 1) * 10000) / 100,
  y: Math.round(seeded(i * 5 + 2) * 10000) / 100,
  w: 80 + Math.round(seeded(i * 5 + 3) * 140),
  h: 10 + Math.round(seeded(i * 5 + 4) * 20),
  opacity: 0.06 + seeded(i * 5 + 5) * 0.06,
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
            background: c.id % 5 === 0 ? "rgba(34, 197, 94, 0.3)" : "white",
            filter: `blur(${c.h}px)`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${20 + Math.round(seeded(c.id * 7) * 25)}s`,
            willChange: "transform",
          }}
        />
      ))}
    </div>
  );
}
