"use client";

import { useState } from "react";
import Link from "next/link";

const API = "https://api.flyfast.app/static";
const VIDEO_URL = `${API}/launch-video-web.mp4`;
const POSTER_URL = `${API}/launch-poster.jpg`;

export default function LaunchPage() {
  const [ended, setEnded] = useState(false);
  const [ready, setReady] = useState(false);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl relative">
        {!ready && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center justify-center"
            style={{
              aspectRatio: "16/9",
              backgroundImage: `url(${POSTER_URL})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <video
          src={VIDEO_URL}
          poster={POSTER_URL}
          autoPlay
          playsInline
          controls
          preload="auto"
          onCanPlay={() => setReady(true)}
          onEnded={() => setEnded(true)}
          className={`w-full rounded-2xl shadow-2xl transition-opacity duration-300 ${ready ? "opacity-100" : "opacity-0"}`}
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
