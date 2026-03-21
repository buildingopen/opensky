"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const API = "https://api.flyfast.app/static";

const DESKTOP = {
  video: `${API}/launch-video-web.mp4`,
  poster: `${API}/launch-poster-video.jpg`,
  blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xABiAAADAQEBAQAAAAAAAAAAAAAABgQCAQMHAQEAAwEBAAAAAAAAAAAAAAAEAAEDAgUQAAICAwEBAQAAAAAAAAAAAAABAhFhEwMxoVERAQEBAQEAAAAAAAAAAAAAAAATAUEC/8AAEQgAEgAgAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8A+pric0IYawelYR6NdBnhZ0Iw+CGdq1+ZVX9sKRK+lTxSAACMYl4TwKJeE8DTjjr/2Q==",
  aspect: "16/9",
};
const MOBILE = {
  video: `${API}/launch-video-vertical-web.mp4`,
  poster: `${API}/launch-poster-vertical.jpg`,
  blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xABgAAADAAMBAAAAAAAAAAAAAAADAQYABwIFAQEBAQAAAAAAAAAAAAAAAAAFAQAQAAMAAgEFAQEAAAAAAAAAAAABERITAoEDIpEhoWERAQEBAAAAAAAAAAAAAAAAAAATEf/AABEIACAAEgMBIgACEQADEQD/2gAMAwEAAhEDEQA/ANjYA9RR4iXb5Tyl/ln6MVFTTmoeoo9YsC0Sb0wfLjmo2+jaftfQ2JxVYGEGQYSDhGx//9k=",
  aspect: "9/16",
};

const FEATURES = [
  {
    label: "Natural language",
    detail: "12 languages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12h20M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Safety badges",
    detail: "19 conflict zones",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Fare heatmap",
    detail: "Dates and destinations",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
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
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
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

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-8 pb-12 sm:pt-12 sm:pb-16">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#e8f4fd] via-[#f0f4ff] to-white" />

      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity">
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
      <p className="text-sm text-[#6b7280] mb-6 sm:mb-8 text-center">
        One sentence, not six form fields.
      </p>

      {/* Video */}
      <div
        className={`w-full relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/[0.08] ${isMobile ? "max-w-sm" : "max-w-4xl"}`}
        onClick={!playing ? handlePlay : undefined}
        style={{
          cursor: !playing ? "pointer" : undefined,
          aspectRatio: config.aspect,
          maxHeight: isMobile ? "65vh" : undefined,
        }}
      >
        {/* Poster image (real <img> for reliable loading) */}
        {!playing && (
          <>
            {/* Blur base64 shown instantly, hidden when real poster loads */}
            <img
              src={config.blur}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: posterLoaded ? 0 : 1, transition: "opacity 0.4s" }}
            />
            {/* Real poster fades in on load */}
            <img
              src={config.poster}
              alt="FlyFast demo preview"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ opacity: posterLoaded ? 1 : 0, transition: "opacity 0.4s" }}
              onLoad={() => setPosterLoaded(true)}
            />
          </>
        )}

        <video
          ref={videoRef}
          key={config.video}
          src={config.video}
          playsInline
          controls={playing}
          preload="auto"
          className="w-full h-full object-cover"
        />

        {/* Play overlay */}
        {!playing && (
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 bg-black/5 transition-all hover:bg-black/10">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-transform hover:scale-105">
              <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 text-[#0a0a0a] ml-1" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-black/20 text-white/90 backdrop-blur-sm">
              Watch demo · 0:28
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className={`flex flex-col items-center gap-2 ${
        playing && isMobile
          ? "fixed bottom-6 left-4 right-4 z-40"
          : "mt-6 sm:mt-8"
      }`}>
        <Link
          href="/"
          className={`px-8 py-3.5 rounded-full bg-[#22c55e] text-white font-semibold text-lg shadow-lg hover:bg-[#16a34a] hover:shadow-xl transition-all ${
            playing && isMobile ? "w-full text-center" : ""
          }`}
        >
          Try FlyFast
        </Link>
        {!(playing && isMobile) && (
          <p className="text-xs text-[#6b7280]">
            Free. No login. Open source.
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-3xl w-full">
        {FEATURES.map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1.5 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center text-[#16a34a]">
              {f.icon}
            </div>
            <span className="text-sm font-semibold text-[#1a1a1a] mt-1">{f.label}</span>
            <span className="text-xs text-[#6b7280]">{f.detail}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
