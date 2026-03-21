"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const API = "https://api.flyfast.app/static";

const DESKTOP = {
  video: `${API}/launch-video-web.mp4`,
  poster: `${API}/launch-poster-video.jpg`,
  blur: "data:image/jpeg;base64,/9j//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xABcAAADAQEBAQAAAAAAAAAAAAAABAIDBwEFAQADAQEAAAAAAAAAAAAAAAAAAQIDBBABAQEBAQEBAQAAAAAAAAAAAAECEQMEMRIRAQEAAAAAAAAAAAAAAAAAAAAR/8AAEQgAEgAgAwESAAISAAMSAP/aAAwDAQACEQMRAD8A7RbxOs9dCnItjn1lv6V8/nmbaEGp9Wbif54ojBvpbpqUzqgkEFQRIWHoMEGFFaBmH//Z",
  aspect: "16/9",
};
const MOBILE = {
  video: `${API}/launch-video-vertical-web.mp4`,
  poster: `${API}/launch-poster-vertical.jpg`,
  blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xABbAAACAwEBAAAAAAAAAAAAAAAAAwIFBAcBAQEBAQAAAAAAAAAAAAAAAAAABQQQAQACAwEBAAAAAAAAAAAAAAABERIDEwIxEQEBAQAAAAAAAAAAAAAAAAAAEhP/wAARCAAgABIDASIAAhEAAxEA/9oADAMBAAIRAxEAPwDo2JWNrnZ4mmXVrmPq3olSxcxzX+AwNCFlMPI8no2mN6NCjQD/2Q==",
  aspect: "9/16",
};

const FEATURES = [
  {
    label: "Natural language",
    detail: "12 languages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12h20M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Safety badges",
    detail: "19 conflict zones",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Fare heatmap",
    detail: "Dates and destinations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Price alerts",
    detail: "Via email",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

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
  const [posterLoaded, setPosterLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  useHideCookieConsent();
  const config = isMobile ? MOBILE : DESKTOP;

  useEffect(() => {
    // Preload the real poster
    const img = new Image();
    img.onload = () => setPosterLoaded(true);
    img.src = config.poster;
  }, [config.poster]);

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-8 pb-12 sm:pt-12 sm:pb-16">
      {/* Background gradient - force light regardless of theme */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#e8f4fd] via-[#f0f4ff] to-white" />

      {/* Logo links home */}
      <Link href="/" className="flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity">
        <svg viewBox="0 0 32 32" className="w-8 h-8 sm:w-10 sm:h-10" fill="none">
          <rect width="32" height="32" rx="6" fill="#0a0a0a" />
          <path d="M10 26V12L15 5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
          <path d="M20 26V12L25 5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
          <line x1="5" y1="15.5" x2="27" y2="15.5" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
        <span className="text-2xl sm:text-3xl font-bold text-[#0a0a0a] font-[var(--font-brand)]">
          <span className="text-[#22c55e]">Fly</span>Fast
        </span>
      </Link>

      <h1 className="text-lg sm:text-xl text-[#374151] font-medium mb-1 text-center">
        Search flights in plain English.
      </h1>
      <p className="text-sm text-[#9ca3af] mb-6 sm:mb-8 text-center">
        One sentence, not six form fields.
      </p>

      {/* Video container with blur placeholder */}
      <div
        className={`w-full relative ${isMobile ? "max-w-sm" : "max-w-4xl"}`}
        onClick={!playing ? handlePlay : undefined}
        style={{ cursor: !playing ? "pointer" : undefined }}
      >
        {/* Blur placeholder (inline, instant) */}
        <div
          className="absolute inset-0 rounded-2xl transition-opacity duration-500"
          style={{
            backgroundImage: `url(${posterLoaded ? config.poster : config.blur})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: playing ? 0 : 1,
            pointerEvents: "none",
          }}
        />

        <video
          ref={videoRef}
          key={config.video}
          src={config.video}
          poster={config.poster}
          playsInline
          controls={playing}
          preload="auto"
          className="w-full rounded-2xl shadow-2xl relative"
          style={{ aspectRatio: config.aspect }}
        />

        {/* Play button overlay */}
        {!playing && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 bg-black/5 transition-all hover:bg-black/15">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform hover:scale-105">
              <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a0a0a] ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-xs text-white/80 font-medium bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
              0:28
            </span>
          </div>
        )}
      </div>

      {/* CTA - always visible, fixed on mobile during video playback */}
      <div className={`flex flex-col items-center gap-2 ${
        playing && isMobile
          ? "fixed bottom-6 left-4 right-4 z-40"
          : "mt-6 sm:mt-8"
      }`}>
        <Link
          href="/"
          className={`px-8 py-3 rounded-full bg-[#22c55e] text-white font-semibold text-lg shadow-lg hover:bg-[#16a34a] transition-colors ${
            playing && isMobile ? "w-full text-center" : ""
          }`}
        >
          Try FlyFast
        </Link>
        {!(playing && isMobile) && (
          <p className="text-xs text-[#9ca3af]">
            Free. No login. Open source.
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mt-10 sm:mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-3xl w-full">
        {FEATURES.map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-2 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#f0fdf4] flex items-center justify-center text-[#22c55e]">
              {f.icon}
            </div>
            <span className="text-sm font-semibold text-[#1a1a1a]">{f.label}</span>
            <span className="text-xs text-[#9ca3af]">{f.detail}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
