"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
/* full-page <a> used instead of <Link> so the launch layout CSS
   (header/footer hidden) doesn't leak into the main app */

const API = "https://api.flyfast.app/static";

const DESKTOP = {
  video: `${API}/launch-video-web.mp4`,
  poster: `${API}/launch-poster-video.jpg`,
  blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xABmAAADAQEBAAAAAAAAAAAAAAAEBQIBAwcBAQEBAQAAAAAAAAAAAAAAAAIDBAEQAAIBAgUFAQAAAAAAAAAAAAABAiERcTLhAxJhckJRQVIRAAMBAQEAAAAAAAAAAAAAAAABAhExQf/AABEIABIAIAMBIgACEQADEQD/2gAMAwEAAhEDEQA/APUVtr67LC5jhD9U7NB610ObibXbIqEJ1CD8qe+OhEtmN6O6wsO1A6pBV1vTtROcDiCyDOVMBY5gsEjmGvQM/9k=",
  aspect: "16/9",
};
const MOBILE = {
  video: `${API}/launch-video-vertical-web.mp4`,
  poster: `${API}/launch-poster-vertical.jpg`,
  blur: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgUFBcUFxsbGxsbGyAeICEhISAgICAhISEkJCQqKiokJCQhISQkKCgqKi4vLisrKisvLzIyMjw8OTlGRkhWVmf/xAByAAACAwEBAQAAAAAAAAAAAAAABQIDAQQHBgEBAQEAAAAAAAAAAAAAAAAAAwUEEAACAQIDBwUBAAAAAAAAAAAAAQIhExIRcZHwUvIjFDLBgoFhZGMRAAEEAQUBAAAAAAAAAAAAAAARAhMBEqFB8TLRYf/AABEIACAAEgMBIgACEQADEQD/2gAMAwEAAhEDEQA/APRrUmqJv4K+3lwy2DpvDS9GH08HrUFP9EdOmU5HfNfDFG1OBHbNtn0GALY0oMZZKj8FLXlZBS/nHf2DJxIURGRd7LGVJ1ozI3I6AFAP/9k=",
  aspect: "1/1",
};

const FEATURE_ICONS = [
  <svg key="lang" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12h20M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="safety" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="heatmap" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
  <svg key="alerts" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
  </svg>,
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

export default function LaunchPage() {
  const [playing, setPlaying] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  const t = useTranslations("launch");
  const locale = useLocale();
  const config = isMobile ? MOBILE : DESKTOP;

  const FEATURES = [
    { label: t("feature1Label"), detail: t("feature1Detail") },
    { label: t("feature2Label"), detail: t("feature2Detail") },
    { label: t("feature3Label"), detail: t("feature3Detail") },
    { label: t("feature4Label"), detail: t("feature4Detail") },
  ];

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.play();
    setPlaying(true);
  }

  return (
    <main id="main-content" className="min-h-screen flex flex-col items-center px-4 pt-8 pb-12 sm:pt-12 sm:pb-16">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes softPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        .entrance-1 { animation: fadeUp 0.6s ease-out both; }
        .entrance-2 { animation: fadeUp 0.6s ease-out 0.1s both; }
        .entrance-3 { animation: fadeUp 0.7s ease-out 0.2s both; }
        .entrance-4 { animation: fadeUp 0.6s ease-out 0.4s both; }
        .entrance-5 { animation: fadeUp 0.6s ease-out 0.55s both; }
      `}</style>
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10" style={{ background: "var(--sky-gradient)" }} />

      {/* Logo */}
      <a href={`/${locale}`} className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity entrance-1">
        <svg viewBox="0 0 32 32" className="w-8 h-8 sm:w-10 sm:h-10" fill="none">
          <rect width="32" height="32" rx="6" fill="var(--color-text)" />
          <path d="M10 26V12L15 5" stroke="var(--color-interactive)" strokeWidth="2.5" strokeLinecap="square" />
          <path d="M20 26V12L25 5" stroke="var(--color-interactive)" strokeWidth="2.5" strokeLinecap="square" />
          <line x1="5" y1="15.5" x2="27" y2="15.5" stroke="var(--color-interactive)" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
        <span className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] font-[var(--font-brand)]">
          <span className="text-[var(--color-interactive)]">Fly</span>Fast
        </span>
      </a>

      <h1 className="text-lg sm:text-xl text-[var(--color-text-muted)] font-medium mb-1 text-center entrance-2">
        {t("headline")}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 sm:mb-8 text-center entrance-2">
        {t("subheadline")}
      </p>

      {/* Video */}
      <div
        className={`w-full relative overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/[0.08] entrance-3 ${isMobile ? "max-w-sm" : "max-w-4xl"}`}
        onClick={!playing ? handlePlay : undefined}
        style={{
          cursor: !playing ? "pointer" : undefined,
          aspectRatio: config.aspect,
          maxHeight: isMobile ? "65vh" : undefined,
        }}
      >
        {/* Blur placeholder - fades out when real poster loads or video plays */}
        <img
          src={config.blur}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: posterLoaded || playing ? 0 : 1,
            transition: "opacity 0.4s",
            pointerEvents: "none",
          }}
        />
        {/* Real poster - fades in on load, fades out when video plays */}
        <img
          src={config.poster}
          alt="FlyFast demo preview"
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: posterLoaded && !playing ? 1 : 0,
            transition: "opacity 0.5s ease-out",
            pointerEvents: "none",
          }}
          onLoad={() => setPosterLoaded(true)}
        />

        <video
          ref={videoRef}
          key={config.video}
          src={config.video}
          playsInline
          controls={playing}
          preload="auto"
          className="w-full h-full object-cover"
          onEnded={() => setPlaying(false)}
        />

        {/* Play overlay - fades out when playing */}
        <div
          className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/5 hover:bg-black/10"
          style={{
            opacity: playing ? 0 : 1,
            transition: "opacity 0.3s ease-out",
            pointerEvents: playing ? "none" : undefined,
          }}
        >
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg"
            style={{ animation: posterLoaded && !playing ? "softPulse 2.5s ease-in-out infinite" : "none" }}
          >
            <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--color-text)] ml-1" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          {/* Badge at bottom of overlay, not competing with poster text */}
          <span className="absolute bottom-3 sm:bottom-4 text-xs font-medium px-3 py-1 rounded-full bg-black/30 text-white backdrop-blur-sm">
            {t("watchDemo")}
          </span>
        </div>
      </div>

      {/* CTA */}
      <div className={`flex flex-col items-center gap-2 ${
        playing && isMobile
          ? "fixed bottom-6 left-4 right-4 z-40"
          : "mt-6 sm:mt-8 entrance-4"
      }`}>
        <a
          href={`/${locale}`}
          className={`px-8 py-3.5 rounded-full bg-[var(--color-interactive)] text-white font-semibold text-lg shadow-lg hover:bg-[var(--color-interactive-hover)] hover:shadow-xl transition-all ${
            playing && isMobile ? "w-full text-center" : ""
          }`}
        >
          {t("cta")}
        </a>
        {!(playing && isMobile) && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("ctaSubtext")}
          </p>
        )}
      </div>

      {/* Features */}
      <div className="mt-8 sm:mt-12 flex flex-wrap justify-center gap-x-1.5 gap-y-1.5 max-w-xl w-full entrance-5">
        {FEATURES.map((f, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] text-[var(--color-text-muted)]"
          >
            <span className="text-[var(--color-interactive)]">{FEATURE_ICONS[i]}</span>
            <span className="font-medium text-[var(--color-text)]">{f.label}</span>
            <span className="text-[var(--color-text-muted)]">{f.detail}</span>
            {i < FEATURES.length - 1 && <span className="text-[var(--color-border)] mx-1">·</span>}
          </span>
        ))}
      </div>
    </main>
  );
}
