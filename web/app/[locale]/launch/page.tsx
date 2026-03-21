"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const API = "https://api.flyfast.app/static";

const DESKTOP = {
  video: `${API}/launch-video-web.mp4`,
  poster: `${API}/launch-poster-video.jpg`,
  aspect: "16/9" as const,
};
const MOBILE = {
  video: `${API}/launch-video-vertical-web.mp4`,
  poster: `${API}/launch-poster-vertical.jpg`,
  aspect: "9/16" as const,
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

function useHideCookieConsent() {
  useEffect(() => {
    // Hide cookie consent on launch page
    const interval = setInterval(() => {
      const el = document.querySelector("div.fixed.bottom-0");
      if (el instanceof HTMLElement) {
        el.style.display = "none";
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);
}

export default function LaunchPage() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  useHideCookieConsent();
  const config = isMobile ? MOBILE : DESKTOP;

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-6 sm:py-10 bg-gradient-to-b from-[#e8f4fd] via-[#f0f4ff] to-white">
      {/* Logo + headline */}
      <div className="flex items-center gap-3 mb-2">
        <svg viewBox="0 0 32 32" className="w-8 h-8 sm:w-10 sm:h-10" fill="none">
          <rect width="32" height="32" rx="6" fill="#0a0a0a" />
          <path d="M10 26V12L15 5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
          <path d="M20 26V12L25 5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
          <line x1="5" y1="15.5" x2="27" y2="15.5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] font-[var(--font-brand)]">
          <span className="text-[#22c55e]">Fly</span>Fast is live.
        </h1>
      </div>
      <p className="text-sm sm:text-base text-[#6b7280] mb-6 sm:mb-8 text-center">
        Search flights in plain English. One sentence, not six form fields.
      </p>

      {/* Video */}
      <div
        className={`w-full relative cursor-pointer ${
          isMobile ? "max-w-sm" : "max-w-4xl"
        }`}
        onClick={!playing ? handlePlay : undefined}
      >
        <video
          ref={videoRef}
          key={config.video}
          src={config.video}
          poster={config.poster}
          playsInline
          controls={playing}
          preload="auto"
          className="w-full rounded-2xl shadow-2xl"
          style={{ aspectRatio: config.aspect }}
        />
        {!playing && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/10 transition-opacity hover:bg-black/20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a0a0a] ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* CTA - always visible */}
      <div className="mt-6 sm:mt-8 flex flex-col items-center gap-3">
        <Link
          href="/"
          className="px-8 py-3 rounded-full bg-[#22c55e] text-white font-semibold text-lg shadow-lg hover:bg-[#16a34a] transition-colors"
        >
          Try FlyFast
        </Link>
        <p className="text-xs sm:text-sm text-[#9ca3af]">
          Free. No login. Open source.
        </p>
      </div>

      {/* Feature bullets */}
      <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl w-full text-center">
        {[
          { label: "Natural language", detail: "12 languages" },
          { label: "Safety badges", detail: "19 conflict zones" },
          { label: "Fare heatmap", detail: "Dates and destinations" },
          { label: "Price alerts", detail: "Via email" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-[#1a1a1a]">{f.label}</span>
            <span className="text-xs text-[#9ca3af]">{f.detail}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
