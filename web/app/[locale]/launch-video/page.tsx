"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const VIDEO_URL = "https://api.flyfast.app/static/launch-video-desktop.mp4";

export default function LaunchVideoPage() {
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <video
          ref={videoRef}
          src={VIDEO_URL}
          autoPlay
          playsInline
          controls
          onEnded={() => setEnded(true)}
          className="w-full rounded-2xl shadow-2xl"
          style={{ aspectRatio: "16/9" }}
        />
      </div>

      <div
        className={`mt-8 flex flex-col items-center gap-4 transition-all duration-700 ${
          ended ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <Link
          href="/"
          className="px-8 py-3 rounded-full bg-[#22c55e] text-white font-semibold text-lg shadow-lg hover:bg-[#16a34a] transition-colors"
        >
          Try FlyFast
        </Link>
        <p className="text-sm text-[var(--color-text-muted)]">
          Free. No login. Open source.
        </p>
      </div>
    </main>
  );
}
