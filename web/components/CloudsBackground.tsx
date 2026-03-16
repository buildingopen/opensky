"use client";

// Large atmospheric gradient orbs that drift slowly, creating a sky-like feel.
// Inspired by Rocketlist's gradient orb approach (proven visible + performant).
export function CloudsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Primary cloud mass - upper left */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "500px",
          height: "300px",
          top: "-80px",
          left: "-100px",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)",
          animationDuration: "18s",
        }}
      />
      {/* Secondary - upper right, green tint */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "400px",
          height: "250px",
          top: "-40px",
          right: "-60px",
          background: "radial-gradient(ellipse, rgba(34,197,94,0.04) 0%, transparent 70%)",
          animationDelay: "-5s",
          animationDuration: "22s",
        }}
      />
      {/* Mid-left wisp */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "350px",
          height: "180px",
          top: "30%",
          left: "-50px",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.05) 0%, transparent 70%)",
          animationDelay: "-8s",
          animationDuration: "25s",
        }}
      />
      {/* Center-right, larger, very subtle */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "600px",
          height: "300px",
          top: "20%",
          right: "-150px",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.035) 0%, transparent 65%)",
          animationDelay: "-12s",
          animationDuration: "28s",
        }}
      />
      {/* Lower left, green accent */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "450px",
          height: "220px",
          bottom: "15%",
          left: "10%",
          background: "radial-gradient(ellipse, rgba(34,197,94,0.03) 0%, transparent 70%)",
          animationDelay: "-15s",
          animationDuration: "20s",
        }}
      />
      {/* Bottom right */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "500px",
          height: "280px",
          bottom: "-60px",
          right: "5%",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.045) 0%, transparent 70%)",
          animationDelay: "-3s",
          animationDuration: "24s",
        }}
      />
    </div>
  );
}
