"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const API = "https://api.flyfast.app/static";
const VIDEO_URL = `${API}/launch-video-web.mp4`;
const POSTER_URL = `${API}/launch-poster.jpg`;

export default function LaunchPage() {
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl relative cursor-pointer" onClick={!playing ? handlePlay : undefined}>
        <video
          ref={videoRef}
          src={VIDEO_URL}
          poster={POSTER_URL}
          playsInline
          controls={playing}
          preload="auto"
          onEnded={() => setEnded(true)}
          className="w-full rounded-2xl shadow-2xl"
          style={{ aspectRatio: "16/9" }}
        />
        {!playing && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/20 transition-opacity hover:bg-black/30">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a0a0a] ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
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
