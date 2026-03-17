"use client";

// Large atmospheric gradient orbs that drift slowly, creating a sky-like feel.
// Uses radial-gradient with 10-15% center opacity (fades to transparent at edges).
export function CloudsBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Primary cloud mass - upper left, white */}
      <div
        className="cloud-orb absolute rounded-full"
        style={{
          width: "600px",
          height: "350px",
          top: "-100px",
          left: "-120px",
          background: "radial-gradient(ellipse, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)",
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
          background: "radial-gradient(ellipse, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 40%, transparent 70%)",
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
          background: "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 45%, transparent 70%)",
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
          background: "radial-gradient(ellipse, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 45%, transparent 65%)",
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
          background: "radial-gradient(ellipse, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0.04) 40%, transparent 70%)",
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
          background: "radial-gradient(ellipse, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.07) 40%, transparent 70%)",
          filter: "blur(45px)",
          animationDelay: "-2s",
          animationDuration: "14s",
        }}
      />
    </div>
  );
}
